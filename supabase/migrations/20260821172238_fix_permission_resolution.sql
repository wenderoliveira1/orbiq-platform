begin;


-- ===========================================================
-- ORBIQ PLATFORM
-- HOTFIX 1.7B.2A.1
--
-- CORRECAO DE RESOLUCAO DE PERMISSOES
--
-- Fonte definitiva:
--
-- organization_members
--      ↓
-- has_org_role()
--      ↓
-- orbiq_has_permission()
--
-- OWNER e ADMIN sao superusuarios da organizacao
-- dentro da camada Orbiq.
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

    permission_name text;

begin

    -- =======================================================
    -- AUTENTICACAO
    -- =======================================================

    if
        auth.uid() is null
    then

        return false;

    end if;


    permission_name :=
        lower(
            btrim(
                coalesce(
                    target_permission,
                    ''
                )
            )
        );


    if
        permission_name = ''
    then

        return false;

    end if;


    -- =======================================================
    -- OWNER / ADMIN
    --
    -- ACESSO INTEGRAL A TODOS OS MODULOS INTERNOS
    -- =======================================================

    if
        public.has_org_role(
            target_org_id,
            array[
                'owner',
                'admin'
            ]::text[]
        )
    then

        return true;

    end if;


    -- =======================================================
    -- DASHBOARD
    -- =======================================================

    if
        permission_name =
            'dashboard.view'
    then

        return
            public.has_org_role(
                target_org_id,
                array[
                    'manager',
                    'estimator',
                    'technician',
                    'viewer'
                ]::text[]
            );

    end if;


    -- =======================================================
    -- INDICADORES
    -- =======================================================

    if
        permission_name =
            'indicators.view'
    then

        return
            public.has_org_role(
                target_org_id,
                array[
                    'manager'
                ]::text[]
            );

    end if;


    -- =======================================================
    -- AUDITORIA
    -- =======================================================

    if
        permission_name =
            'audit.view'
    then

        return
            public.has_org_role(
                target_org_id,
                array[
                    'manager'
                ]::text[]
            );

    end if;


    -- =======================================================
    -- EQUIPE - LEITURA
    -- =======================================================

    if
        permission_name =
            'team.view'
    then

        return
            public.has_org_role(
                target_org_id,
                array[
                    'manager'
                ]::text[]
            );

    end if;


    -- =======================================================
    -- EQUIPE - GESTAO
    --
    -- Somente owner/admin.
    -- Ja retornaram TRUE no topo.
    -- =======================================================

    if
        permission_name =
            'team.manage'
    then

        return false;

    end if;


    -- =======================================================
    -- CLIENTES
    -- =======================================================

    if
        permission_name =
            'customers.manage'
    then

        return
            public.has_org_role(
                target_org_id,
                array[
                    'manager',
                    'estimator'
                ]::text[]
            );

    end if;


    -- =======================================================
    -- VEICULOS
    -- =======================================================

    if
        permission_name =
            'vehicles.manage'
    then

        return
            public.has_org_role(
                target_org_id,
                array[
                    'manager',
                    'estimator'
                ]::text[]
            );

    end if;


    -- =======================================================
    -- ORCAMENTOS - LEITURA
    -- =======================================================

    if
        permission_name =
            'quotes.view'
    then

        return
            public.has_org_role(
                target_org_id,
                array[
                    'manager',
                    'estimator',
                    'technician',
                    'viewer'
                ]::text[]
            );

    end if;


    -- =======================================================
    -- ORCAMENTOS - GESTAO
    -- =======================================================

    if
        permission_name =
            'quotes.manage'
    then

        return
            public.has_org_role(
                target_org_id,
                array[
                    'manager',
                    'estimator'
                ]::text[]
            );

    end if;


    -- =======================================================
    -- COTACOES
    -- =======================================================

    if
        permission_name =
            'supplier_quotes.manage'
    then

        return
            public.has_org_role(
                target_org_id,
                array[
                    'manager',
                    'estimator'
                ]::text[]
            );

    end if;


    -- =======================================================
    -- COMERCIAL
    -- =======================================================

    if
        permission_name =
            'commercial.manage'
    then

        return
            public.has_org_role(
                target_org_id,
                array[
                    'manager'
                ]::text[]
            );

    end if;


    -- =======================================================
    -- COMPRAS
    -- =======================================================

    if
        permission_name =
            'purchases.manage'
    then

        return
            public.has_org_role(
                target_org_id,
                array[
                    'manager'
                ]::text[]
            );

    end if;


    -- =======================================================
    -- EXECUCAO
    -- =======================================================

    if
        permission_name =
            'execution.manage'
    then

        return
            public.has_org_role(
                target_org_id,
                array[
                    'manager',
                    'technician'
                ]::text[]
            );

    end if;


    -- =======================================================
    -- MAO DE OBRA
    -- =======================================================

    if
        permission_name =
            'labor.manage'
    then

        return
            public.has_org_role(
                target_org_id,
                array[
                    'manager',
                    'estimator'
                ]::text[]
            );

    end if;


    -- =======================================================
    -- FORNECEDORES
    -- =======================================================

    if
        permission_name =
            'suppliers.manage'
    then

        return
            public.has_org_role(
                target_org_id,
                array[
                    'manager',
                    'estimator'
                ]::text[]
            );

    end if;


    -- =======================================================
    -- DESCONHECIDA
    -- =======================================================

    return false;

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
-- LISTAGEM DAS PERMISSOES
--
-- Mantemos esta RPC coerente com a funcao acima,
-- embora o frontend nao dependa dela para renderizar o menu.
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

    candidates constant text[] :=
        array[

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

        ]::text[];

    result_permissions text[] :=
        array[]::text[];

    permission_name text;

begin

    foreach
        permission_name
    in array
        candidates

    loop

        if
            public.orbiq_has_permission(
                target_org_id,
                permission_name
            )
        then

            result_permissions :=
                array_append(
                    result_permissions,
                    permission_name
                );

        end if;

    end loop;


    return
        result_permissions;

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


commit;