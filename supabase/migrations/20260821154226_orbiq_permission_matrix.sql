-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 1.7B.1
--
-- MATRIZ CENTRAL DE PERMISSOES
-- ===========================================================


create or replace function
public.orbiq_permissions_for_role(

    target_role text
)
returns text[]
language sql
immutable
set search_path = public
as $$

    select

        case
            lower(
                btrim(
                    coalesce(
                        target_role,
                        ''
                    )
                )
            )


            -- =================================================
            -- PROPRIETARIO
            -- =================================================

            when 'owner'
            then array[

                'dashboard.view',

                'indicators.view',

                'audit.view',

                'team.view',

                'team.manage',

                'customers.manage',

                'vehicles.manage',

                'quotes.view',

                'quotes.manage',

                'supplier_quotes.manage',

                'commercial.manage',

                'purchases.manage',

                'execution.manage',

                'labor.manage',

                'suppliers.manage'

            ]::text[]


            -- =================================================
            -- ADMINISTRADOR
            -- =================================================

            when 'admin'
            then array[

                'dashboard.view',

                'indicators.view',

                'audit.view',

                'team.view',

                'team.manage',

                'customers.manage',

                'vehicles.manage',

                'quotes.view',

                'quotes.manage',

                'supplier_quotes.manage',

                'commercial.manage',

                'purchases.manage',

                'execution.manage',

                'labor.manage',

                'suppliers.manage'

            ]::text[]


            -- =================================================
            -- GERENTE
            -- =================================================

            when 'manager'
            then array[

                'dashboard.view',

                'indicators.view',

                'audit.view',

                'team.view',

                'customers.manage',

                'vehicles.manage',

                'quotes.view',

                'quotes.manage',

                'supplier_quotes.manage',

                'commercial.manage',

                'purchases.manage',

                'execution.manage',

                'labor.manage',

                'suppliers.manage'

            ]::text[]


            -- =================================================
            -- ORCAMENTISTA
            -- =================================================

            when 'estimator'
            then array[

                'dashboard.view',

                'customers.manage',

                'vehicles.manage',

                'quotes.view',

                'quotes.manage',

                'supplier_quotes.manage',

                'labor.manage',

                'suppliers.manage'

            ]::text[]


            -- =================================================
            -- TECNICO
            -- =================================================

            when 'technician'
            then array[

                'dashboard.view',

                'quotes.view',

                'execution.manage'

            ]::text[]


            -- =================================================
            -- SOMENTE LEITURA
            -- =================================================

            when 'viewer'
            then array[

                'dashboard.view',

                'quotes.view'

            ]::text[]


            else
                array[]::text[]

        end;

$$;


revoke all
on function
public.orbiq_permissions_for_role(
    text
)
from public,
anon;


grant execute
on function
public.orbiq_permissions_for_role(
    text
)
to authenticated;


-- ===========================================================
-- VERIFICAR PERMISSAO DO USUARIO ATUAL
-- ===========================================================

create or replace function
public.orbiq_has_permission(

    target_org_id uuid,

    target_permission text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare

    current_role text;

    permissions text[];

    clean_permission text;

begin

    if
        auth.uid() is null
    then

        return false;

    end if;


    clean_permission :=
        lower(
            btrim(
                coalesce(
                    target_permission,
                    ''
                )
            )
        );


    if
        clean_permission = ''
    then

        return false;

    end if;


    select
        member.role

    into
        current_role

    from
        public.organization_members
            as member

    where
        member.organization_id =
            target_org_id

        and
        member.user_id =
            auth.uid()

        and
        member.status =
            'active'

    limit 1;


    if
        current_role is null
    then

        return false;

    end if;


    permissions :=
        public.orbiq_permissions_for_role(
            current_role
        );


    return
        clean_permission =
        any(
            permissions
        );

end;
$$;


revoke all
on function
public.orbiq_has_permission(
    uuid,
    text
)
from public,
anon;


grant execute
on function
public.orbiq_has_permission(
    uuid,
    text
)
to authenticated;


-- ===========================================================
-- LISTAR PERMISSOES DO USUARIO ATUAL
-- ===========================================================

create or replace function
public.orbiq_list_my_permissions(

    target_org_id uuid
)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare

    current_role text;

begin

    if
        auth.uid() is null
    then

        return
            array[]::text[];

    end if;


    select
        member.role

    into
        current_role

    from
        public.organization_members
            as member

    where
        member.organization_id =
            target_org_id

        and
        member.user_id =
            auth.uid()

        and
        member.status =
            'active'

    limit 1;


    if
        current_role is null
    then

        return
            array[]::text[];

    end if;


    return
        public.orbiq_permissions_for_role(
            current_role
        );

end;
$$;


revoke all
on function
public.orbiq_list_my_permissions(
    uuid
)
from public,
anon;


grant execute
on function
public.orbiq_list_my_permissions(
    uuid
)
to authenticated;


notify pgrst, 'reload schema';