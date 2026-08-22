begin;


-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 1.7B.2B
--
-- RPC FIREWALL
--
-- Arquitetura:
--
-- public.funcao
--      |
--      | permission check
--      v
-- orbiq_private.funcao
--      |
--      v
-- implementacao original
--
-- As assinaturas publicas permanecem iguais.
-- ===========================================================


-- ===========================================================
-- SCHEMA PRIVADO
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
-- ASSERT DE PERMISSAO
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

    if
        auth.uid() is null
    then

        raise exception
            'Authentication required'
            using errcode = '42501';

    end if;


    if
        target_org_id is null
    then

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
-- RPCs QUE RECEBERAO FIREWALL
--
-- Todas possuem target_org_id como primeiro argumento.
-- ===========================================================

create temporary table
orbiq_rpc_guard_targets (

    function_name text
        primary key,

    required_permission text
        not null

)
on commit drop;


insert into
orbiq_rpc_guard_targets (
    function_name,
    required_permission
)
values

    -- ORCAMENTO

    (
        'create_quote_v2',
        'quotes.manage'
    ),


    -- COTACAO DE FORNECEDORES

    (
        'prepare_quote_supplier_requests',
        'supplier_quotes.manage'
    ),

    (
        'save_supplier_response',
        'supplier_quotes.manage'
    ),

    (
        'award_supplier_quote_item',
        'supplier_quotes.manage'
    ),

    (
        'finalize_quote_supplier_awards',
        'supplier_quotes.manage'
    ),


    -- COMERCIAL

    (
        'save_quote_commercial',
        'commercial.manage'
    ),

    (
        'approve_quote_commercial',
        'commercial.manage'
    ),

    (
        'reject_quote_commercial',
        'commercial.manage'
    ),

    (
        'reopen_quote_commercial',
        'commercial.manage'
    ),

    (
        'create_quote_public_link',
        'commercial.manage'
    ),

    (
        'revoke_quote_public_link',
        'commercial.manage'
    ),


    -- COMPRAS

    (
        'sync_quote_purchase_orders',
        'purchases.manage'
    ),

    (
        'mark_purchase_order_ordered',
        'purchases.manage'
    ),

    (
        'refresh_quote_material_status',
        'purchases.manage'
    ),

    (
        'receive_purchase_order_item',
        'purchases.manage'
    ),

    (
        'receive_purchase_order_all',
        'purchases.manage'
    ),


    -- EXECUCAO

    (
        'sync_quote_work_order',
        'execution.manage'
    ),

    (
        'set_work_order_service_labor',
        'execution.manage'
    ),

    (
        'start_work_order_service',
        'execution.manage'
    ),

    (
        'complete_work_order_service',
        'execution.manage'
    ),


    -- EQUIPE

    (
        'list_organization_team',
        'team.view'
    ),

    (
        'list_organization_invites',
        'team.manage'
    ),

    (
        'create_organization_invite',
        'team.manage'
    ),

    (
        'update_organization_member_role',
        'team.manage'
    ),

    (
        'set_organization_member_status',
        'team.manage'
    ),

    (
        'revoke_organization_invite',
        'team.manage'
    );


-- ===========================================================
-- VALIDAR RPCs ANTES DE ALTERAR QUALQUER UMA
-- ===========================================================

do $validation$
declare

    target_row record;

    function_count integer;

    target_oid oid;

    argument_count integer;

    default_count integer;

    first_argument_name text;

    first_argument_type text;

begin

    for target_row in

        select
            function_name,
            required_permission

        from
            orbiq_rpc_guard_targets

        order by
            function_name

    loop

        select
            count(*)

        into
            function_count

        from
            pg_proc
                as procedure_row

        join
            pg_namespace
                as namespace_row

            on
                namespace_row.oid =
                    procedure_row.pronamespace

        where
            namespace_row.nspname =
                'public'

            and
            procedure_row.proname =
                target_row.function_name;


        if
            function_count <>
            1
        then

            raise exception
                'RPC %: esperado exatamente 1 overload, encontrado %',
                target_row.function_name,
                function_count;

        end if;


        select

            procedure_row.oid,

            procedure_row.pronargs,

            procedure_row.pronargdefaults,

            procedure_row.proargnames[1],

            pg_catalog.format_type(
                procedure_row.proargtypes[0],
                null
            )

        into

            target_oid,

            argument_count,

            default_count,

            first_argument_name,

            first_argument_type

        from
            pg_proc
                as procedure_row

        join
            pg_namespace
                as namespace_row

            on
                namespace_row.oid =
                    procedure_row.pronamespace

        where
            namespace_row.nspname =
                'public'

            and
            procedure_row.proname =
                target_row.function_name;


        if
            argument_count <
            1
        then

            raise exception
                'RPC % nao possui target_org_id',
                target_row.function_name;

        end if;


        if
            default_count <>
            0
        then

            raise exception
                'RPC % possui argumentos default. Firewall cancelado por seguranca.',
                target_row.function_name;

        end if;


        if
            first_argument_name <>
            'target_org_id'
        then

            raise exception
                'RPC %: primeiro argumento inesperado: %',
                target_row.function_name,
                first_argument_name;

        end if;


        if
            first_argument_type <>
            'uuid'
        then

            raise exception
                'RPC %: target_org_id nao e UUID',
                target_row.function_name;

        end if;

    end loop;

end;
$validation$;


-- ===========================================================
-- TRANSFORMAR RPCs EM FACHADAS PROTEGIDAS
--
-- A implementacao original e movida para orbiq_private.
-- Uma funcao publica com a MESMA assinatura e recriada.
--
-- PostgREST e frontend continuam usando o mesmo nome.
-- ===========================================================

do $firewall$
declare

    target_row record;

    target_oid oid;

    argument_types text;

    result_declaration text;

    returns_set boolean;

    argument_names text[];

    raw_argument_types oidvector;

    argument_count integer;

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
            orbiq_rpc_guard_targets

        order by
            function_name

    loop

        select

            procedure_row.oid,

            pg_catalog.oidvectortypes(
                procedure_row.proargtypes
            ),

            pg_catalog.pg_get_function_result(
                procedure_row.oid
            ),

            procedure_row.proretset,

            procedure_row.proargnames,

            procedure_row.proargtypes,

            procedure_row.pronargs

        into

            target_oid,

            argument_types,

            result_declaration,

            returns_set,

            argument_names,

            raw_argument_types,

            argument_count

        from
            pg_proc
                as procedure_row

        join
            pg_namespace
                as namespace_row

            on
                namespace_row.oid =
                    procedure_row.pronamespace

        where
            namespace_row.nspname =
                'public'

            and
            procedure_row.proname =
                target_row.function_name

        limit 1;


        if
            target_oid is null
        then

            raise exception
                'RPC nao encontrada: %',
                target_row.function_name;

        end if;


        -- ===================================================
        -- DECLARACOES DOS ARGUMENTOS
        --
        -- Precisamos manter OS NOMES.
        -- PostgREST resolve os JSON args por nome.
        -- ===================================================

        argument_declarations :=
            '';


        call_arguments :=
            '';


        for index_value in
            0..(
                argument_count -
                1
            )

        loop

            argument_name :=
                argument_names[
                    index_value +
                    1
                ];


            if
                argument_name is null
                or
                btrim(
                    argument_name
                ) = ''
            then

                argument_name :=
                    'arg_' ||
                    (
                        index_value +
                        1
                    )::text;

            end if;


            argument_type :=
                pg_catalog.format_type(
                    raw_argument_types[
                        index_value
                    ],
                    null
                );


            if
                index_value >
                0
            then

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
                (
                    index_value +
                    1
                )::text;

        end loop;


        -- ===================================================
        -- MOVER IMPLEMENTACAO
        -- ===================================================

        execute format(

            'alter function public.%I(%s) set schema orbiq_private',

            target_row.function_name,

            argument_types

        );


        -- ===================================================
        -- BLOQUEAR IMPLEMENTACAO DIRETA
        -- ===================================================

        execute format(

            'revoke all on function orbiq_private.%I(%s) from public',

            target_row.function_name,

            argument_types

        );


        execute format(

            'revoke all on function orbiq_private.%I(%s) from anon',

            target_row.function_name,

            argument_types

        );


        execute format(

            'revoke all on function orbiq_private.%I(%s) from authenticated',

            target_row.function_name,

            argument_types

        );


        -- ===================================================
        -- RETORNO
        -- ===================================================

        if
            result_declaration =
            'void'
        then

            return_statement :=
                format(

                    'perform orbiq_private.%I(%s); return;',

                    target_row.function_name,

                    call_arguments

                );


        elsif
            returns_set
        then

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
        -- FACHADA PUBLICA
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
as $protected_rpc$
begin

    perform
        public.orbiq_assert_permission(
            $1::uuid,
            %L
        );

    %s

end;
$protected_rpc$;
$wrapper$,

            target_row.function_name,

            argument_declarations,

            result_declaration,

            target_row.required_permission,

            return_statement

        );


        -- ===================================================
        -- GRANTS DA FACHADA
        -- ===================================================

        execute format(

            'revoke all on function public.%I(%s) from public',

            target_row.function_name,

            argument_types

        );


        execute format(

            'revoke all on function public.%I(%s) from anon',

            target_row.function_name,

            argument_types

        );


        execute format(

            'grant execute on function public.%I(%s) to authenticated',

            target_row.function_name,

            argument_types

        );

    end loop;

end;
$firewall$;


-- ===========================================================
-- VALIDAR FIREWALL
-- ===========================================================

do $verify$
declare

    expected_count integer;

    protected_public_count integer;

    protected_private_count integer;

    private_authenticated_count integer;

    private_anon_count integer;

begin

    select
        count(*)

    into
        expected_count

    from
        orbiq_rpc_guard_targets;


    -- =======================================================
    -- FACHADAS PUBLICAS
    -- =======================================================

    select
        count(*)

    into
        protected_public_count

    from
        pg_proc
            as procedure_row

    join
        pg_namespace
            as namespace_row

        on
            namespace_row.oid =
                procedure_row.pronamespace

    join
        orbiq_rpc_guard_targets
            as target_row

        on
            target_row.function_name =
                procedure_row.proname

    where
        namespace_row.nspname =
            'public'

        and
        procedure_row.prosecdef =
            true

        and
        has_function_privilege(
            'authenticated',
            procedure_row.oid,
            'EXECUTE'
        ) =
            true

        and
        has_function_privilege(
            'anon',
            procedure_row.oid,
            'EXECUTE'
        ) =
            false;


    if
        protected_public_count <>
        expected_count
    then

        raise exception
            'RPCs publicas protegidas: esperado %, encontrado %',
            expected_count,
            protected_public_count;

    end if;


    -- =======================================================
    -- IMPLEMENTACOES PRIVADAS
    -- =======================================================

    select
        count(*)

    into
        protected_private_count

    from
        pg_proc
            as procedure_row

    join
        pg_namespace
            as namespace_row

        on
            namespace_row.oid =
                procedure_row.pronamespace

    join
        orbiq_rpc_guard_targets
            as target_row

        on
            target_row.function_name =
                procedure_row.proname

    where
        namespace_row.nspname =
            'orbiq_private';


    if
        protected_private_count <>
        expected_count
    then

        raise exception
            'RPCs privadas: esperado %, encontrado %',
            expected_count,
            protected_private_count;

    end if;


    -- =======================================================
    -- AUTHENTICATED NAO PODE EXECUTAR CORE DIRETAMENTE
    -- =======================================================

    select
        count(*)

    into
        private_authenticated_count

    from
        pg_proc
            as procedure_row

    join
        pg_namespace
            as namespace_row

        on
            namespace_row.oid =
                procedure_row.pronamespace

    join
        orbiq_rpc_guard_targets
            as target_row

        on
            target_row.function_name =
                procedure_row.proname

    where
        namespace_row.nspname =
            'orbiq_private'

        and
        has_function_privilege(
            'authenticated',
            procedure_row.oid,
            'EXECUTE'
        ) =
            true;


    if
        private_authenticated_count <>
        0
    then

        raise exception
            'Authenticated ainda consegue executar % RPC(s) privada(s)',
            private_authenticated_count;

    end if;


    -- =======================================================
    -- ANON NAO PODE EXECUTAR CORE
    -- =======================================================

    select
        count(*)

    into
        private_anon_count

    from
        pg_proc
            as procedure_row

    join
        pg_namespace
            as namespace_row

        on
            namespace_row.oid =
                procedure_row.pronamespace

    join
        orbiq_rpc_guard_targets
            as target_row

        on
            target_row.function_name =
                procedure_row.proname

    where
        namespace_row.nspname =
            'orbiq_private'

        and
        has_function_privilege(
            'anon',
            procedure_row.oid,
            'EXECUTE'
        ) =
            true;


    if
        private_anon_count <>
        0
    then

        raise exception
            'Anon ainda consegue executar % RPC(s) privada(s)',
            private_anon_count;

    end if;

end;
$verify$;


-- ===========================================================
-- FLUXOS PUBLICOS INTENCIONAIS
--
-- NAO MOVER:
--
-- public_get_quote
-- public_decide_quote
-- public_get_organization_invite
-- accept_organization_invite
--
-- Eles possuem modelos de autorizacao proprios:
--
-- token publico / aceite de convite.
-- ===========================================================


notify pgrst, 'reload schema';


commit;