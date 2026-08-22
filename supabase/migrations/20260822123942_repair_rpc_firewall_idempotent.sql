begin;


-- ===========================================================
-- ORBIQ
-- RECOVERY 1.7B.2B.3
-- RPC FIREWALL IDEMPOTENTE
-- ===========================================================


create schema if not exists
orbiq_private;


revoke all
on schema
orbiq_private
from public;


revoke all
on schema
orbiq_private
from anon;


revoke all
on schema
orbiq_private
from authenticated;


-- ===========================================================
-- ASSERT
-- ===========================================================

create or replace function
public.orbiq_assert_permission(

    target_org_id uuid,

    target_permission text
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin

    if auth.uid() is null then

        raise exception
            'Authentication required'
            using errcode = '42501';

    end if;


    if target_org_id is null then

        raise exception
            'Organization is required'
            using errcode = '42501';

    end if;


    if not public.is_org_member(
        target_org_id
    )
    then

        raise exception
            'User does not belong to organization'
            using errcode = '42501';

    end if;


    if not public.orbiq_has_permission(
        target_org_id,
        target_permission
    )
    then

        raise exception
            'Permission denied: %',
            target_permission
            using errcode = '42501';

    end if;

end;
$$;


revoke all
on function
public.orbiq_assert_permission(
    uuid,
    text
)
from public,
anon,
authenticated;


-- ===========================================================
-- ALVOS
-- ===========================================================

create temporary table
orbiq_rpc_targets (

    function_name text
        primary key,

    required_permission text
        not null

)
on commit drop;


insert into
orbiq_rpc_targets (
    function_name,
    required_permission
)
values

    ('create_quote_v2', 'quotes.manage'),

    ('prepare_quote_supplier_requests', 'supplier_quotes.manage'),

    ('save_supplier_response', 'supplier_quotes.manage'),

    ('award_supplier_quote_item', 'supplier_quotes.manage'),

    ('finalize_quote_supplier_awards', 'supplier_quotes.manage'),

    ('save_quote_commercial', 'commercial.manage'),

    ('approve_quote_commercial', 'commercial.manage'),

    ('reject_quote_commercial', 'commercial.manage'),

    ('reopen_quote_commercial', 'commercial.manage'),

    ('create_quote_public_link', 'commercial.manage'),

    ('revoke_quote_public_link', 'commercial.manage'),

    ('sync_quote_purchase_orders', 'purchases.manage'),

    ('mark_purchase_order_ordered', 'purchases.manage'),

    ('refresh_quote_material_status', 'purchases.manage'),

    ('receive_purchase_order_item', 'purchases.manage'),

    ('receive_purchase_order_all', 'purchases.manage'),

    ('sync_quote_work_order', 'execution.manage'),

    ('set_work_order_service_labor', 'execution.manage'),

    ('start_work_order_service', 'execution.manage'),

    ('complete_work_order_service', 'execution.manage'),

    ('list_organization_team', 'team.view'),

    ('list_organization_invites', 'team.manage'),

    ('create_organization_invite', 'team.manage'),

    ('update_organization_member_role', 'team.manage'),

    ('set_organization_member_status', 'team.manage'),

    ('revoke_organization_invite', 'team.manage');


-- ===========================================================
-- RECONCILIAR
-- ===========================================================

do $reconcile$
declare

    target_row record;

    public_count integer;

    private_count integer;

    public_oid oid;

    private_oid oid;

    public_source text;

    public_signature text;

    private_signature text;

    argument_names text[];

    argument_types oidvector;

    argument_count integer;

    argument_defaults integer;

    result_declaration text;

    returns_set boolean;

    first_argument_name text;

    first_argument_type text;

    argument_declarations text;

    call_arguments text;

    argument_name text;

    argument_type text;

    return_statement text;

    index_value integer;

begin

    for target_row in

        select
            function_name,
            required_permission

        from
            orbiq_rpc_targets

        order by
            function_name

    loop

        -- ===================================================
        -- CONTAR
        -- ===================================================

        select
            count(*)

        into
            public_count

        from
            pg_proc p

        join
            pg_namespace n

            on
                n.oid =
                p.pronamespace

        where
            n.nspname =
                'public'

            and
            p.proname =
                target_row.function_name;


        select
            count(*)

        into
            private_count

        from
            pg_proc p

        join
            pg_namespace n

            on
                n.oid =
                p.pronamespace

        where
            n.nspname =
                'orbiq_private'

            and
            p.proname =
                target_row.function_name;


        if public_count > 1 then

            raise exception
                'RPC % possui mais de um overload em public',
                target_row.function_name;

        end if;


        if private_count > 1 then

            raise exception
                'RPC % possui mais de um overload em orbiq_private',
                target_row.function_name;

        end if;


        if public_count = 0 and private_count = 0 then

            raise exception
                'RPC % nao encontrada',
                target_row.function_name;

        end if;


        -- ===================================================
        -- PUBLIC + PRIVATE
        --
        -- Provavel estado ja protegido.
        -- ===================================================

        if public_count = 1 and private_count = 1 then

            select
                p.oid,
                p.prosrc,
                pg_catalog.oidvectortypes(
                    p.proargtypes
                )

            into
                public_oid,
                public_source,
                public_signature

            from
                pg_proc p

            join
                pg_namespace n

                on
                    n.oid =
                    p.pronamespace

            where
                n.nspname =
                    'public'

                and
                p.proname =
                    target_row.function_name;


            select
                p.oid,
                pg_catalog.oidvectortypes(
                    p.proargtypes
                )

            into
                private_oid,
                private_signature

            from
                pg_proc p

            join
                pg_namespace n

                on
                    n.oid =
                    p.pronamespace

            where
                n.nspname =
                    'orbiq_private'

                and
                p.proname =
                    target_row.function_name;


            if public_signature <> private_signature then

                raise exception
                    'RPC % possui assinaturas diferentes entre public e private',
                    target_row.function_name;

            end if;


            if position(
                'orbiq_assert_permission'
                in
                public_source
            ) = 0
            then

                raise exception
                    'RPC % existe em public e private, mas public nao e o wrapper protegido. Estado ambiguo.',
                    target_row.function_name;

            end if;


            if position(
                'orbiq_private.'
                in
                public_source
            ) = 0
            then

                raise exception
                    'RPC % possui wrapper public inesperado',
                    target_row.function_name;

            end if;


            execute format(

                'revoke all on function public.%I(%s) from public',

                target_row.function_name,

                public_signature

            );


            execute format(

                'revoke all on function public.%I(%s) from anon',

                target_row.function_name,

                public_signature

            );


            execute format(

                'grant execute on function public.%I(%s) to authenticated',

                target_row.function_name,

                public_signature

            );


            execute format(

                'revoke all on function orbiq_private.%I(%s) from public',

                target_row.function_name,

                private_signature

            );


            execute format(

                'revoke all on function orbiq_private.%I(%s) from anon',

                target_row.function_name,

                private_signature

            );


            execute format(

                'revoke all on function orbiq_private.%I(%s) from authenticated',

                target_row.function_name,

                private_signature

            );


            continue;

        end if;


        -- ===================================================
        -- SOMENTE PUBLIC
        --
        -- Move implementacao original.
        -- ===================================================

        if public_count = 1 and private_count = 0 then

            select
                p.oid,
                pg_catalog.oidvectortypes(
                    p.proargtypes
                ),
                p.pronargdefaults,
                p.proargnames[1],
                pg_catalog.format_type(
                    p.proargtypes[0],
                    null
                )

            into
                public_oid,
                public_signature,
                argument_defaults,
                first_argument_name,
                first_argument_type

            from
                pg_proc p

            join
                pg_namespace n

                on
                    n.oid =
                    p.pronamespace

            where
                n.nspname =
                    'public'

                and
                p.proname =
                    target_row.function_name;


            if argument_defaults <> 0 then

                raise exception
                    'RPC % possui argumentos default. Conversao automatica bloqueada.',
                    target_row.function_name;

            end if;


            if first_argument_name <> 'target_org_id' then

                raise exception
                    'RPC % nao inicia com target_org_id',
                    target_row.function_name;

            end if;


            if first_argument_type <> 'uuid' then

                raise exception
                    'RPC % target_org_id nao e UUID',
                    target_row.function_name;

            end if;


            execute format(

                'alter function public.%I(%s) set schema orbiq_private',

                target_row.function_name,

                public_signature

            );

        end if;


        -- ===================================================
        -- A PARTIR DAQUI A IMPLEMENTACAO DEVE ESTAR PRIVATE
        -- ===================================================

        select

            p.oid,

            p.proargnames,

            p.proargtypes,

            p.pronargs,

            p.pronargdefaults,

            pg_catalog.pg_get_function_result(
                p.oid
            ),

            p.proretset,

            pg_catalog.oidvectortypes(
                p.proargtypes
            ),

            p.proargnames[1],

            pg_catalog.format_type(
                p.proargtypes[0],
                null
            )

        into

            private_oid,

            argument_names,

            argument_types,

            argument_count,

            argument_defaults,

            result_declaration,

            returns_set,

            private_signature,

            first_argument_name,

            first_argument_type

        from
            pg_proc p

        join
            pg_namespace n

            on
                n.oid =
                    p.pronamespace

        where
            n.nspname =
                'orbiq_private'

            and
            p.proname =
                target_row.function_name;


        if private_oid is null then

            raise exception
                'Implementacao privada ausente para %',
                target_row.function_name;

        end if;


        if argument_defaults <> 0 then

            raise exception
                'RPC privada % possui argumentos default',
                target_row.function_name;

        end if;


        if first_argument_name <> 'target_org_id' then

            raise exception
                'RPC privada % nao inicia com target_org_id',
                target_row.function_name;

        end if;


        if first_argument_type <> 'uuid' then

            raise exception
                'RPC privada % target_org_id nao e UUID',
                target_row.function_name;

        end if;


        -- ===================================================
        -- ARGUMENTOS
        -- ===================================================

        argument_declarations :=
            '';


        call_arguments :=
            '';


        for index_value in 0..(argument_count - 1)

        loop

            argument_name :=
                argument_names[
                    index_value + 1
                ];


            if argument_name is null then

                argument_name :=
                    'arg_' ||
                    (index_value + 1)::text;

            end if;


            if btrim(argument_name) = '' then

                argument_name :=
                    'arg_' ||
                    (index_value + 1)::text;

            end if;


            argument_type :=
                pg_catalog.format_type(
                    argument_types[
                        index_value
                    ],
                    null
                );


            if index_value > 0 then

                argument_declarations :=
                    argument_declarations ||
                    ', ';


                call_arguments :=
                    call_arguments ||
                    ', ';

            end if;


            argument_declarations :=
                argument_declarations ||
                format(
                    '%I %s',
                    argument_name,
                    argument_type
                );


            call_arguments :=
                call_arguments ||
                '$' ||
                (index_value + 1)::text;

        end loop;


        -- ===================================================
        -- RETORNO
        -- ===================================================

        if result_declaration = 'void' then

            return_statement :=
                format(
                    'perform orbiq_private.%I(%s); return;',
                    target_row.function_name,
                    call_arguments
                );

        elsif returns_set then

            return_statement :=
                format(
                    'return query select * from orbiq_private.%I(%s);',
                    target_row.function_name,
                    call_arguments
                );

        else

            return_statement :=
                format(
                    'return orbiq_private.%I(%s);',
                    target_row.function_name,
                    call_arguments
                );

        end if;


        -- ===================================================
        -- CRIAR WRAPPER PUBLIC
        -- ===================================================

        execute format(

$wrapper$
create function public.%I(
    %s
)
returns %s
language plpgsql
security definer
set search_path =
    public,
    orbiq_private
as $protected$
begin

    perform
        public.orbiq_assert_permission(
            $1::uuid,
            %L
        );

    %s

end;
$protected$;
$wrapper$,

            target_row.function_name,

            argument_declarations,

            result_declaration,

            target_row.required_permission,

            return_statement

        );


        -- ===================================================
        -- GRANTS
        -- ===================================================

        execute format(

            'revoke all on function public.%I(%s) from public',

            target_row.function_name,

            private_signature

        );


        execute format(

            'revoke all on function public.%I(%s) from anon',

            target_row.function_name,

            private_signature

        );


        execute format(

            'grant execute on function public.%I(%s) to authenticated',

            target_row.function_name,

            private_signature

        );


        execute format(

            'revoke all on function orbiq_private.%I(%s) from public',

            target_row.function_name,

            private_signature

        );


        execute format(

            'revoke all on function orbiq_private.%I(%s) from anon',

            target_row.function_name,

            private_signature

        );


        execute format(

            'revoke all on function orbiq_private.%I(%s) from authenticated',

            target_row.function_name,

            private_signature

        );

    end loop;

end;
$reconcile$;


-- ===========================================================
-- VALIDACAO 26 + 26
-- ===========================================================

do $verify$
declare

    expected_count integer;

    public_rpc_count integer;

    private_rpc_count integer;

    invalid_wrapper_count integer;

    exposed_private_count integer;

begin

    select
        count(*)

    into
        expected_count

    from
        orbiq_rpc_targets;


    if expected_count <> 26 then

        raise exception
            'Tabela de alvos deveria possuir 26 RPCs e possui %',
            expected_count;

    end if;


    select
        count(*)

    into
        public_rpc_count

    from
        pg_proc p

    join
        pg_namespace n

        on
            n.oid =
                p.pronamespace

    join
        orbiq_rpc_targets t

        on
            t.function_name =
                p.proname

    where
        n.nspname =
            'public';


    select
        count(*)

    into
        private_rpc_count

    from
        pg_proc p

    join
        pg_namespace n

        on
            n.oid =
                p.pronamespace

    join
        orbiq_rpc_targets t

        on
            t.function_name =
                p.proname

    where
        n.nspname =
            'orbiq_private';


    if public_rpc_count <> 26 then

        raise exception
            'PUBLIC deveria possuir 26 RPCs protegidas. Encontrado: %',
            public_rpc_count;

    end if;


    if private_rpc_count <> 26 then

        raise exception
            'PRIVATE deveria possuir 26 implementacoes. Encontrado: %',
            private_rpc_count;

    end if;


    select
        count(*)

    into
        invalid_wrapper_count

    from
        pg_proc p

    join
        pg_namespace n

        on
            n.oid =
                p.pronamespace

    join
        orbiq_rpc_targets t

        on
            t.function_name =
                p.proname

    where
        n.nspname =
            'public'

        and
        (
            position(
                'orbiq_assert_permission'
                in
                p.prosrc
            ) = 0

            or

            position(
                'orbiq_private.'
                in
                p.prosrc
            ) = 0
        );


    if invalid_wrapper_count <> 0 then

        raise exception
            'Existem % wrappers publicos invalidos',
            invalid_wrapper_count;

    end if;


    select
        count(*)

    into
        exposed_private_count

    from
        pg_proc p

    join
        pg_namespace n

        on
            n.oid =
                p.pronamespace

    join
        orbiq_rpc_targets t

        on
            t.function_name =
                p.proname

    where
        n.nspname =
            'orbiq_private'

        and
        (
            has_function_privilege(
                'authenticated',
                p.oid,
                'EXECUTE'
            )

            or

            has_function_privilege(
                'anon',
                p.oid,
                'EXECUTE'
            )
        );


    if exposed_private_count <> 0 then

        raise exception
            'Existem % RPCs privadas expostas',
            exposed_private_count;

    end if;

end;
$verify$;


notify pgrst, 'reload schema';


commit;