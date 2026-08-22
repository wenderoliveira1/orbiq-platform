begin;


-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 1.7B.2A
--
-- RLS + DATA API + GUARDS DE MUTACAO
-- ===========================================================


do $$
begin

    if
        to_regprocedure(
            'public.orbiq_has_permission(uuid,text)'
        )
        is null
    then

        raise exception
            'Fase 1.7B.1 ausente: orbiq_has_permission não existe';

    end if;

end;
$$;


-- ===========================================================
-- QUALQUER UMA DAS PERMISSOES
-- ===========================================================

create or replace function
public.orbiq_has_any_permission(

    target_org_id uuid,

    target_permissions text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$

    select exists (

        select 1

        from
            unnest(
                coalesce(
                    target_permissions,
                    array[]::text[]
                )
            )
                as permission_name

        where
            public.orbiq_has_permission(
                target_org_id,
                permission_name
            )

    );

$$;


revoke all
on function
public.orbiq_has_any_permission(
    uuid,
    text[]
)
from public,
anon;


grant execute
on function
public.orbiq_has_any_permission(
    uuid,
    text[]
)
to authenticated;


-- ===========================================================
-- GUARD GENERICO DE MUTACAO
--
-- IMPORTANTE:
--
-- auth.uid() IS NULL:
-- fluxo interno/publico controlado por SECURITY DEFINER.
--
-- A Data API anonima continua sem GRANT nas tabelas.
-- ===========================================================

create or replace function
public.orbiq_guard_permission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare

    target_org_id uuid;

    required_permission text;

begin

    if
        auth.uid() is null
    then

        if
            tg_op = 'DELETE'
        then
            return old;
        end if;

        return new;

    end if;


    required_permission :=
        nullif(
            btrim(
                coalesce(
                    tg_argv[0],
                    ''
                )
            ),
            ''
        );


    if
        required_permission is null
    then

        raise exception
            'Orbiq permission trigger is misconfigured'
            using errcode = '42501';

    end if;


    if
        tg_op = 'DELETE'
    then

        target_org_id :=
            old.organization_id;

    else

        target_org_id :=
            new.organization_id;

    end if;


    if not public.orbiq_has_permission(
        target_org_id,
        required_permission
    )
    then

        raise exception
            'Permissão negada: %',
            required_permission
            using errcode = '42501';

    end if;


    if
        tg_op = 'DELETE'
    then

        return old;

    end if;


    return new;

end;
$$;


revoke all
on function
public.orbiq_guard_permission()
from public,
anon,
authenticated;


-- ===========================================================
-- QUOTES
--
-- PROTECAO POR CAMPO.
-- ===========================================================

create or replace function
public.orbiq_guard_quotes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare

    target_org_id uuid;

    can_quote boolean;

    can_commercial boolean;

    can_execution boolean;

begin

    -- Fluxos públicos validados por RPC própria.
    if
        auth.uid() is null
    then

        if
            tg_op = 'DELETE'
        then
            return old;
        end if;

        return new;

    end if;


    target_org_id :=
        case
            when tg_op = 'DELETE'
                then old.organization_id
            else new.organization_id
        end;


    can_quote :=
        public.orbiq_has_permission(
            target_org_id,
            'quotes.manage'
        );


    can_commercial :=
        public.orbiq_has_permission(
            target_org_id,
            'commercial.manage'
        );


    can_execution :=
        public.orbiq_has_permission(
            target_org_id,
            'execution.manage'
        );


    -- =======================================================
    -- INSERT
    -- =======================================================

    if
        tg_op = 'INSERT'
    then

        if not can_quote then

            raise exception
                'Permissão negada: quotes.manage'
                using errcode = '42501';

        end if;


        if
            new.created_by is not null

            and
            new.created_by <>
                auth.uid()
        then

            raise exception
                'created_by inválido'
                using errcode = '42501';

        end if;


        return new;

    end if;


    -- =======================================================
    -- DELETE
    --
    -- Exclusao de orçamento é administrativa/comercial.
    -- =======================================================

    if
        tg_op = 'DELETE'
    then

        if not can_commercial then

            raise exception
                'Permissão negada para excluir orçamento'
                using errcode = '42501';

        end if;


        return old;

    end if;


    -- =======================================================
    -- CAMPOS IMUTAVEIS
    -- =======================================================

    if
        new.id
            is distinct from
            old.id

        or
        new.organization_id
            is distinct from
            old.organization_id

        or
        new.protocol
            is distinct from
            old.protocol

        or
        new.created_by
            is distinct from
            old.created_by

        or
        new.created_at
            is distinct from
            old.created_at
    then

        raise exception
            'Campos estruturais do orçamento são imutáveis'
            using errcode = '42501';

    end if;


    -- =======================================================
    -- DADOS TECNICOS
    -- =======================================================

    if
        new.customer_id
            is distinct from
            old.customer_id

        or
        new.vehicle_id
            is distinct from
            old.vehicle_id

        or
        new.priority
            is distinct from
            old.priority

        or
        new.mileage
            is distinct from
            old.mileage

        or
        new.notes
            is distinct from
            old.notes
    then

        if not can_quote then

            raise exception
                'Permissão negada: quotes.manage'
                using errcode = '42501';

        end if;

    end if;


    -- =======================================================
    -- COMERCIAL / FINANCEIRO
    -- =======================================================

    if
        new.commercial_status
            is distinct from
            old.commercial_status

        or
        new.commercial_approved_at
            is distinct from
            old.commercial_approved_at

        or
        new.commercial_rejected_at
            is distinct from
            old.commercial_rejected_at

        or
        new.commercial_rejection_reason
            is distinct from
            old.commercial_rejection_reason

        or
        new.parts_cost_amount
            is distinct from
            old.parts_cost_amount

        or
        new.parts_sale_amount
            is distinct from
            old.parts_sale_amount

        or
        new.labor_sale_amount
            is distinct from
            old.labor_sale_amount

        or
        new.subtotal_amount
            is distinct from
            old.subtotal_amount

        or
        new.discount_type
            is distinct from
            old.discount_type

        or
        new.discount_value
            is distinct from
            old.discount_value

        or
        new.discount_amount
            is distinct from
            old.discount_amount

        or
        new.final_amount
            is distinct from
            old.final_amount
    then

        if not can_commercial then

            raise exception
                'Permissão negada: commercial.manage'
                using errcode = '42501';

        end if;

    end if;


    -- =======================================================
    -- STATUS OPERACIONAL
    -- =======================================================

    if
        new.status
            is distinct from
            old.status
    then

        -- Gestão possui controle completo.
        if can_commercial then

            null;


        -- Orçamentista:
        -- somente fluxo pré-aprovação.
        elsif can_quote then

            if
                old.status not in (
                    'awaiting_evaluation',
                    'awaiting_quote',
                    'estimating'
                )

                or
                new.status not in (
                    'awaiting_evaluation',
                    'awaiting_quote',
                    'estimating'
                )
            then

                raise exception
                    'Orçamentista não pode avançar para aprovação, compras ou execução'
                    using errcode = '42501';

            end if;


        -- Técnico:
        -- apenas transições geradas pela execução.
        elsif can_execution then

            if
                old.status = 'approved'
                and
                new.status = 'in_progress'
            then

                if not exists (

                    select 1

                    from
                        public.work_orders
                            as work_order

                    where
                        work_order.organization_id =
                            target_org_id

                        and
                        work_order.quote_id =
                            new.id

                        and
                        work_order.status =
                            'in_progress'

                )
                then

                    raise exception
                        'A OS precisa estar em execução antes do orçamento'
                        using errcode = '42501';

                end if;


            elsif
                old.status = 'in_progress'
                and
                new.status = 'completed'
            then

                if not exists (

                    select 1

                    from
                        public.work_orders
                            as work_order

                    where
                        work_order.organization_id =
                            target_org_id

                        and
                        work_order.quote_id =
                            new.id

                        and
                        work_order.status =
                            'completed'

                )
                then

                    raise exception
                        'A OS precisa estar concluída antes do orçamento'
                        using errcode = '42501';

                end if;


            else

                raise exception
                    'Transição de status não permitida para Técnico'
                    using errcode = '42501';

            end if;


        else

            raise exception
                'Permissão negada para alterar status do orçamento'
                using errcode = '42501';

        end if;

    end if;


    return new;

end;
$$;


revoke all
on function
public.orbiq_guard_quotes()
from public,
anon,
authenticated;


-- ===========================================================
-- QUOTE SERVICES
-- ===========================================================

create or replace function
public.orbiq_guard_quote_services()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare

    target_org_id uuid;

    can_quote boolean;

    can_execution boolean;

begin

    if
        auth.uid() is null
    then

        if tg_op = 'DELETE' then
            return old;
        end if;

        return new;

    end if;


    target_org_id :=
        case
            when tg_op = 'DELETE'
                then old.organization_id
            else new.organization_id
        end;


    can_quote :=
        public.orbiq_has_permission(
            target_org_id,
            'quotes.manage'
        );


    can_execution :=
        public.orbiq_has_permission(
            target_org_id,
            'execution.manage'
        );


    if
        tg_op = 'INSERT'
    then

        if not can_quote then

            raise exception
                'Permissão negada: quotes.manage'
                using errcode = '42501';

        end if;

        return new;

    end if;


    if
        tg_op = 'DELETE'
    then

        if not can_quote then

            raise exception
                'Permissão negada: quotes.manage'
                using errcode = '42501';

        end if;

        return old;

    end if;


    if
        new.id
            is distinct from
            old.id

        or
        new.organization_id
            is distinct from
            old.organization_id

        or
        new.quote_id
            is distinct from
            old.quote_id

        or
        new.created_at
            is distinct from
            old.created_at
    then

        raise exception
            'Campos estruturais do serviço são imutáveis'
            using errcode = '42501';

    end if;


    if can_quote then

        return new;

    end if;


    if can_execution then

        if
            new.category
                is distinct from
                old.category

            or
            new.description
                is distinct from
                old.description

            or
            new.needs_part
                is distinct from
                old.needs_part
        then

            raise exception
                'Técnico não pode alterar a definição original do serviço'
                using errcode = '42501';

        end if;


        return new;

    end if;


    raise exception
        'Permissão negada para alterar serviço'
        using errcode = '42501';

end;
$$;


revoke all
on function
public.orbiq_guard_quote_services()
from public,
anon,
authenticated;


-- ===========================================================
-- QUOTE ITEMS
-- ===========================================================

create or replace function
public.orbiq_guard_quote_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare

    target_org_id uuid;

    can_quote boolean;

    can_supplier_quote boolean;

    can_commercial boolean;

    can_purchase boolean;

begin

    if
        auth.uid() is null
    then

        if tg_op = 'DELETE' then
            return old;
        end if;

        return new;

    end if;


    target_org_id :=
        case
            when tg_op = 'DELETE'
                then old.organization_id
            else new.organization_id
        end;


    can_quote :=
        public.orbiq_has_permission(
            target_org_id,
            'quotes.manage'
        );


    can_supplier_quote :=
        public.orbiq_has_permission(
            target_org_id,
            'supplier_quotes.manage'
        );


    can_commercial :=
        public.orbiq_has_permission(
            target_org_id,
            'commercial.manage'
        );


    can_purchase :=
        public.orbiq_has_permission(
            target_org_id,
            'purchases.manage'
        );


    if
        tg_op = 'INSERT'
    then

        if not can_quote then

            raise exception
                'Permissão negada: quotes.manage'
                using errcode = '42501';

        end if;

        return new;

    end if;


    if
        tg_op = 'DELETE'
    then

        if not can_quote then

            raise exception
                'Permissão negada: quotes.manage'
                using errcode = '42501';

        end if;

        return old;

    end if;


    if
        new.id
            is distinct from
            old.id

        or
        new.organization_id
            is distinct from
            old.organization_id

        or
        new.quote_id
            is distinct from
            old.quote_id

        or
        new.created_at
            is distinct from
            old.created_at
    then

        raise exception
            'Campos estruturais da peça são imutáveis'
            using errcode = '42501';

    end if;


    -- =======================================================
    -- DADOS TECNICOS
    -- =======================================================

    if
        new.category
            is distinct from
            old.category

        or
        new.description
            is distinct from
            old.description

        or
        new.quantity
            is distinct from
            old.quantity

        or
        new.unit
            is distinct from
            old.unit

        or
        new.side
            is distinct from
            old.side

        or
        new.specification
            is distinct from
            old.specification

        or
        new.notes
            is distinct from
            old.notes
    then

        if not can_quote then

            raise exception
                'Permissão negada: quotes.manage'
                using errcode = '42501';

        end if;

    end if;


    -- =======================================================
    -- FORNECEDOR / COMPRA
    -- =======================================================

    if
        new.supplier_id
            is distinct from
            old.supplier_id

        or
        new.chosen_amount
            is distinct from
            old.chosen_amount
    then

        if
            not can_supplier_quote
            and
            not can_purchase
        then

            raise exception
                'Permissão negada para escolher fornecedor'
                using errcode = '42501';

        end if;

    end if;


    if
        new.purchase_status
            is distinct from
            old.purchase_status
    then

        if can_purchase then

            null;

        elsif can_supplier_quote then

            if
                new.purchase_status not in (
                    'pending',
                    'quoting',
                    'approved',
                    'cancelled'
                )
            then

                raise exception
                    'Cotação não pode marcar peça como pedida ou recebida'
                    using errcode = '42501';

            end if;

        else

            raise exception
                'Permissão negada para alterar estado da peça'
                using errcode = '42501';

        end if;

    end if;


    -- =======================================================
    -- PRECO DE VENDA
    -- =======================================================

    if
        new.sale_unit_amount
            is distinct from
            old.sale_unit_amount

        or
        new.sale_total_amount
            is distinct from
            old.sale_total_amount
    then

        if not can_commercial then

            raise exception
                'Permissão negada: commercial.manage'
                using errcode = '42501';

        end if;

    end if;


    return new;

end;
$$;


revoke all
on function
public.orbiq_guard_quote_items()
from public,
anon,
authenticated;


-- ===========================================================
-- REMOVE POLICIES ANTIGAS DOS RECURSOS GERENCIADOS
-- ===========================================================

do $$
declare

    policy_record record;

begin

    for policy_record in

        select
            schemaname,
            tablename,
            policyname

        from
            pg_policies

        where
            schemaname =
                'public'

            and
            tablename =
            any (
                array[

                    'organizations',

                    'profiles',

                    'organization_members',

                    'customers',

                    'vehicles',

                    'supplier_categories',

                    'suppliers',

                    'supplier_category_links',

                    'labor_items',

                    'labor_services',

                    'quotes',

                    'quote_services',

                    'quote_items',

                    'quote_supplier_requests',

                    'quote_supplier_request_items',

                    'quote_supplier_item_responses',

                    'purchase_orders',

                    'purchase_order_items',

                    'work_orders',

                    'work_order_services',

                    'quote_public_links',

                    'audit_logs',

                    'organization_invites'

                ]::text[]
            )

    loop

        execute format(

            'drop policy if exists %I on public.%I',

            policy_record.policyname,

            policy_record.tablename

        );

    end loop;

end;
$$;


-- ===========================================================
-- GARANTIR RLS
-- ===========================================================

alter table public.organizations
enable row level security;

alter table public.profiles
enable row level security;

alter table public.organization_members
enable row level security;

alter table public.organization_invites
enable row level security;

alter table public.customers
enable row level security;

alter table public.vehicles
enable row level security;

alter table public.supplier_categories
enable row level security;

alter table public.suppliers
enable row level security;

alter table public.supplier_category_links
enable row level security;

alter table public.labor_items
enable row level security;

alter table public.labor_services
enable row level security;

alter table public.quotes
enable row level security;

alter table public.quote_services
enable row level security;

alter table public.quote_items
enable row level security;

alter table public.quote_supplier_requests
enable row level security;

alter table public.quote_supplier_request_items
enable row level security;

alter table public.quote_supplier_item_responses
enable row level security;

alter table public.purchase_orders
enable row level security;

alter table public.purchase_order_items
enable row level security;

alter table public.work_orders
enable row level security;

alter table public.work_order_services
enable row level security;

alter table public.quote_public_links
enable row level security;

alter table public.audit_logs
enable row level security;


-- ===========================================================
-- ORGANIZATIONS
-- ===========================================================

create policy
orbiq_organizations_select

on public.organizations

for select

to authenticated

using (
    public.is_org_member(
        id
    )
);


create policy
orbiq_organizations_update

on public.organizations

for update

to authenticated

using (
    public.has_org_role(
        id,
        array[
            'owner',
            'admin'
        ]::text[]
    )
)

with check (
    public.has_org_role(
        id,
        array[
            'owner',
            'admin'
        ]::text[]
    )
);


-- ===========================================================
-- PROFILES
-- ===========================================================

create policy
orbiq_profiles_select_self

on public.profiles

for select

to authenticated

using (
    user_id =
        auth.uid()
);


create policy
orbiq_profiles_update_self

on public.profiles

for update

to authenticated

using (
    user_id =
        auth.uid()
)

with check (
    user_id =
        auth.uid()
);


-- ===========================================================
-- ORGANIZATION MEMBERS
-- ===========================================================

create policy
orbiq_members_select

on public.organization_members

for select

to authenticated

using (
    public.is_org_member(
        organization_id
    )
);


create policy
orbiq_members_insert

on public.organization_members

for insert

to authenticated

with check (
    public.orbiq_has_permission(
        organization_id,
        'team.manage'
    )
);


create policy
orbiq_members_update

on public.organization_members

for update

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'team.manage'
    )
)

with check (
    public.orbiq_has_permission(
        organization_id,
        'team.manage'
    )
);


create policy
orbiq_members_delete

on public.organization_members

for delete

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'team.manage'
    )
);


-- ===========================================================
-- CUSTOMERS
-- ===========================================================

create policy
orbiq_customers_select

on public.customers

for select

to authenticated

using (
    public.orbiq_has_any_permission(
        organization_id,
        array[
            'customers.manage',
            'quotes.view'
        ]::text[]
    )
);


create policy
orbiq_customers_insert

on public.customers

for insert

to authenticated

with check (
    public.orbiq_has_permission(
        organization_id,
        'customers.manage'
    )
);


create policy
orbiq_customers_update

on public.customers

for update

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'customers.manage'
    )
)

with check (
    public.orbiq_has_permission(
        organization_id,
        'customers.manage'
    )
);


create policy
orbiq_customers_delete

on public.customers

for delete

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'customers.manage'
    )
);


-- ===========================================================
-- VEHICLES
-- ===========================================================

create policy
orbiq_vehicles_select

on public.vehicles

for select

to authenticated

using (
    public.orbiq_has_any_permission(
        organization_id,
        array[
            'vehicles.manage',
            'quotes.view'
        ]::text[]
    )
);


create policy
orbiq_vehicles_insert

on public.vehicles

for insert

to authenticated

with check (
    public.orbiq_has_permission(
        organization_id,
        'vehicles.manage'
    )
);


create policy
orbiq_vehicles_update

on public.vehicles

for update

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'vehicles.manage'
    )
)

with check (
    public.orbiq_has_permission(
        organization_id,
        'vehicles.manage'
    )
);


create policy
orbiq_vehicles_delete

on public.vehicles

for delete

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'vehicles.manage'
    )
);


-- ===========================================================
-- SUPPLIERS
-- ===========================================================

create policy
orbiq_supplier_categories_select

on public.supplier_categories

for select

to authenticated

using (
    public.orbiq_has_any_permission(
        organization_id,
        array[
            'suppliers.manage',
            'supplier_quotes.manage',
            'purchases.manage'
        ]::text[]
    )
);


create policy
orbiq_supplier_categories_write

on public.supplier_categories

for all

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'suppliers.manage'
    )
)

with check (
    public.orbiq_has_permission(
        organization_id,
        'suppliers.manage'
    )
);


create policy
orbiq_suppliers_select

on public.suppliers

for select

to authenticated

using (
    public.orbiq_has_any_permission(
        organization_id,
        array[
            'suppliers.manage',
            'supplier_quotes.manage',
            'purchases.manage'
        ]::text[]
    )
);


create policy
orbiq_suppliers_write

on public.suppliers

for all

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'suppliers.manage'
    )
)

with check (
    public.orbiq_has_permission(
        organization_id,
        'suppliers.manage'
    )
);


create policy
orbiq_supplier_links_select

on public.supplier_category_links

for select

to authenticated

using (
    public.orbiq_has_any_permission(
        organization_id,
        array[
            'suppliers.manage',
            'supplier_quotes.manage',
            'purchases.manage'
        ]::text[]
    )
);


create policy
orbiq_supplier_links_write

on public.supplier_category_links

for all

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'suppliers.manage'
    )
)

with check (
    public.orbiq_has_permission(
        organization_id,
        'suppliers.manage'
    )
);


-- ===========================================================
-- LABOR
-- ===========================================================

create policy
orbiq_labor_items_select

on public.labor_items

for select

to authenticated

using (
    public.orbiq_has_any_permission(
        organization_id,
        array[
            'labor.manage',
            'quotes.manage',
            'execution.manage'
        ]::text[]
    )
);


create policy
orbiq_labor_items_write

on public.labor_items

for all

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'labor.manage'
    )
)

with check (
    public.orbiq_has_permission(
        organization_id,
        'labor.manage'
    )
);


create policy
orbiq_labor_services_select

on public.labor_services

for select

to authenticated

using (
    public.orbiq_has_any_permission(
        organization_id,
        array[
            'labor.manage',
            'quotes.manage',
            'execution.manage'
        ]::text[]
    )
);


create policy
orbiq_labor_services_write

on public.labor_services

for all

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'labor.manage'
    )
)

with check (
    public.orbiq_has_permission(
        organization_id,
        'labor.manage'
    )
);


-- ===========================================================
-- QUOTES
-- ===========================================================

create policy
orbiq_quotes_select

on public.quotes

for select

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'quotes.view'
    )
);


create policy
orbiq_quotes_insert

on public.quotes

for insert

to authenticated

with check (
    public.orbiq_has_permission(
        organization_id,
        'quotes.manage'
    )
);


create policy
orbiq_quotes_update

on public.quotes

for update

to authenticated

using (
    public.orbiq_has_any_permission(
        organization_id,
        array[
            'quotes.manage',
            'supplier_quotes.manage',
            'commercial.manage',
            'purchases.manage',
            'execution.manage'
        ]::text[]
    )
)

with check (
    public.orbiq_has_any_permission(
        organization_id,
        array[
            'quotes.manage',
            'supplier_quotes.manage',
            'commercial.manage',
            'purchases.manage',
            'execution.manage'
        ]::text[]
    )
);


create policy
orbiq_quotes_delete

on public.quotes

for delete

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'commercial.manage'
    )
);


-- ===========================================================
-- QUOTE SERVICES
-- ===========================================================

create policy
orbiq_quote_services_select

on public.quote_services

for select

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'quotes.view'
    )
);


create policy
orbiq_quote_services_insert

on public.quote_services

for insert

to authenticated

with check (
    public.orbiq_has_permission(
        organization_id,
        'quotes.manage'
    )
);


create policy
orbiq_quote_services_update

on public.quote_services

for update

to authenticated

using (
    public.orbiq_has_any_permission(
        organization_id,
        array[
            'quotes.manage',
            'execution.manage'
        ]::text[]
    )
)

with check (
    public.orbiq_has_any_permission(
        organization_id,
        array[
            'quotes.manage',
            'execution.manage'
        ]::text[]
    )
);


create policy
orbiq_quote_services_delete

on public.quote_services

for delete

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'quotes.manage'
    )
);


-- ===========================================================
-- QUOTE ITEMS
-- ===========================================================

create policy
orbiq_quote_items_select

on public.quote_items

for select

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'quotes.view'
    )
);


create policy
orbiq_quote_items_insert

on public.quote_items

for insert

to authenticated

with check (
    public.orbiq_has_permission(
        organization_id,
        'quotes.manage'
    )
);


create policy
orbiq_quote_items_update

on public.quote_items

for update

to authenticated

using (
    public.orbiq_has_any_permission(
        organization_id,
        array[
            'quotes.manage',
            'supplier_quotes.manage',
            'commercial.manage',
            'purchases.manage'
        ]::text[]
    )
)

with check (
    public.orbiq_has_any_permission(
        organization_id,
        array[
            'quotes.manage',
            'supplier_quotes.manage',
            'commercial.manage',
            'purchases.manage'
        ]::text[]
    )
);


create policy
orbiq_quote_items_delete

on public.quote_items

for delete

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'quotes.manage'
    )
);


-- ===========================================================
-- SUPPLIER QUOTATION
-- ===========================================================

create policy
orbiq_supplier_requests_select

on public.quote_supplier_requests

for select

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'supplier_quotes.manage'
    )
);


create policy
orbiq_supplier_requests_write

on public.quote_supplier_requests

for all

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'supplier_quotes.manage'
    )
)

with check (
    public.orbiq_has_permission(
        organization_id,
        'supplier_quotes.manage'
    )
);


create policy
orbiq_supplier_request_items_select

on public.quote_supplier_request_items

for select

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'supplier_quotes.manage'
    )
);


create policy
orbiq_supplier_request_items_write

on public.quote_supplier_request_items

for all

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'supplier_quotes.manage'
    )
)

with check (
    public.orbiq_has_permission(
        organization_id,
        'supplier_quotes.manage'
    )
);


create policy
orbiq_supplier_responses_select

on public.quote_supplier_item_responses

for select

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'supplier_quotes.manage'
    )
);


create policy
orbiq_supplier_responses_write

on public.quote_supplier_item_responses

for all

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'supplier_quotes.manage'
    )
)

with check (
    public.orbiq_has_permission(
        organization_id,
        'supplier_quotes.manage'
    )
);


-- ===========================================================
-- PURCHASES
-- ===========================================================

create policy
orbiq_purchase_orders_select

on public.purchase_orders

for select

to authenticated

using (
    public.orbiq_has_any_permission(
        organization_id,
        array[
            'purchases.manage',
            'execution.manage'
        ]::text[]
    )
);


create policy
orbiq_purchase_orders_write

on public.purchase_orders

for all

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'purchases.manage'
    )
)

with check (
    public.orbiq_has_permission(
        organization_id,
        'purchases.manage'
    )
);


create policy
orbiq_purchase_items_select

on public.purchase_order_items

for select

to authenticated

using (
    public.orbiq_has_any_permission(
        organization_id,
        array[
            'purchases.manage',
            'execution.manage'
        ]::text[]
    )
);


create policy
orbiq_purchase_items_write

on public.purchase_order_items

for all

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'purchases.manage'
    )
)

with check (
    public.orbiq_has_permission(
        organization_id,
        'purchases.manage'
    )
);


-- ===========================================================
-- EXECUTION
-- ===========================================================

create policy
orbiq_work_orders_select

on public.work_orders

for select

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'execution.manage'
    )
);


create policy
orbiq_work_orders_write

on public.work_orders

for all

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'execution.manage'
    )
)

with check (
    public.orbiq_has_permission(
        organization_id,
        'execution.manage'
    )
);


create policy
orbiq_work_services_select

on public.work_order_services

for select

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'execution.manage'
    )
);


create policy
orbiq_work_services_write

on public.work_order_services

for all

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'execution.manage'
    )
)

with check (
    public.orbiq_has_permission(
        organization_id,
        'execution.manage'
    )
);


-- ===========================================================
-- PUBLIC QUOTE LINKS
-- ===========================================================

create policy
orbiq_public_links_select

on public.quote_public_links

for select

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'commercial.manage'
    )
);


create policy
orbiq_public_links_write

on public.quote_public_links

for all

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'commercial.manage'
    )
)

with check (
    public.orbiq_has_permission(
        organization_id,
        'commercial.manage'
    )
);


-- ===========================================================
-- AUDIT
-- ===========================================================

create policy
orbiq_audit_select

on public.audit_logs

for select

to authenticated

using (
    public.orbiq_has_permission(
        organization_id,
        'audit.view'
    )
);


revoke
    insert,
    update,
    delete
on table
public.audit_logs
from authenticated;


-- ===========================================================
-- INVITES
--
-- Sem acesso direto pela Data API.
-- Fluxo continua exclusivamente por RPC.
-- ===========================================================

revoke all
on table
public.organization_invites
from anon,
authenticated;


-- ===========================================================
-- GUARDS DE MUTACAO
--
-- Esses triggers tambem protegem mutacoes realizadas
-- por SECURITY DEFINER quando existe usuario autenticado.
-- ===========================================================


-- CUSTOMERS

drop trigger if exists
orbiq_permission_customers
on public.customers;


create trigger
orbiq_permission_customers

before insert or update or delete

on public.customers

for each row

execute function
public.orbiq_guard_permission(
    'customers.manage'
);


-- VEHICLES

drop trigger if exists
orbiq_permission_vehicles
on public.vehicles;


create trigger
orbiq_permission_vehicles

before insert or update or delete

on public.vehicles

for each row

execute function
public.orbiq_guard_permission(
    'vehicles.manage'
);


-- SUPPLIER CATEGORIES

drop trigger if exists
orbiq_permission_supplier_categories
on public.supplier_categories;


create trigger
orbiq_permission_supplier_categories

before insert or update or delete

on public.supplier_categories

for each row

execute function
public.orbiq_guard_permission(
    'suppliers.manage'
);


-- SUPPLIERS

drop trigger if exists
orbiq_permission_suppliers
on public.suppliers;


create trigger
orbiq_permission_suppliers

before insert or update or delete

on public.suppliers

for each row

execute function
public.orbiq_guard_permission(
    'suppliers.manage'
);


-- SUPPLIER LINKS

drop trigger if exists
orbiq_permission_supplier_links
on public.supplier_category_links;


create trigger
orbiq_permission_supplier_links

before insert or update or delete

on public.supplier_category_links

for each row

execute function
public.orbiq_guard_permission(
    'suppliers.manage'
);


-- LABOR ITEMS

drop trigger if exists
orbiq_permission_labor_items
on public.labor_items;


create trigger
orbiq_permission_labor_items

before insert or update or delete

on public.labor_items

for each row

execute function
public.orbiq_guard_permission(
    'labor.manage'
);


-- LABOR SERVICES

drop trigger if exists
orbiq_permission_labor_services
on public.labor_services;


create trigger
orbiq_permission_labor_services

before insert or update or delete

on public.labor_services

for each row

execute function
public.orbiq_guard_permission(
    'labor.manage'
);


-- QUOTES

drop trigger if exists
orbiq_permission_quotes
on public.quotes;


create trigger
orbiq_permission_quotes

before insert or update or delete

on public.quotes

for each row

execute function
public.orbiq_guard_quotes();


-- QUOTE SERVICES

drop trigger if exists
orbiq_permission_quote_services
on public.quote_services;


create trigger
orbiq_permission_quote_services

before insert or update or delete

on public.quote_services

for each row

execute function
public.orbiq_guard_quote_services();


-- QUOTE ITEMS

drop trigger if exists
orbiq_permission_quote_items
on public.quote_items;


create trigger
orbiq_permission_quote_items

before insert or update or delete

on public.quote_items

for each row

execute function
public.orbiq_guard_quote_items();


-- SUPPLIER REQUESTS

drop trigger if exists
orbiq_permission_supplier_requests
on public.quote_supplier_requests;


create trigger
orbiq_permission_supplier_requests

before insert or update or delete

on public.quote_supplier_requests

for each row

execute function
public.orbiq_guard_permission(
    'supplier_quotes.manage'
);


-- SUPPLIER REQUEST ITEMS

drop trigger if exists
orbiq_permission_supplier_request_items
on public.quote_supplier_request_items;


create trigger
orbiq_permission_supplier_request_items

before insert or update or delete

on public.quote_supplier_request_items

for each row

execute function
public.orbiq_guard_permission(
    'supplier_quotes.manage'
);


-- SUPPLIER RESPONSES

drop trigger if exists
orbiq_permission_supplier_responses
on public.quote_supplier_item_responses;


create trigger
orbiq_permission_supplier_responses

before insert or update or delete

on public.quote_supplier_item_responses

for each row

execute function
public.orbiq_guard_permission(
    'supplier_quotes.manage'
);


-- PURCHASE ORDERS

drop trigger if exists
orbiq_permission_purchase_orders
on public.purchase_orders;


create trigger
orbiq_permission_purchase_orders

before insert or update or delete

on public.purchase_orders

for each row

execute function
public.orbiq_guard_permission(
    'purchases.manage'
);


-- PURCHASE ITEMS

drop trigger if exists
orbiq_permission_purchase_items
on public.purchase_order_items;


create trigger
orbiq_permission_purchase_items

before insert or update or delete

on public.purchase_order_items

for each row

execute function
public.orbiq_guard_permission(
    'purchases.manage'
);


-- WORK ORDERS

drop trigger if exists
orbiq_permission_work_orders
on public.work_orders;


create trigger
orbiq_permission_work_orders

before insert or update or delete

on public.work_orders

for each row

execute function
public.orbiq_guard_permission(
    'execution.manage'
);


-- WORK ORDER SERVICES

drop trigger if exists
orbiq_permission_work_order_services
on public.work_order_services;


create trigger
orbiq_permission_work_order_services

before insert or update or delete

on public.work_order_services

for each row

execute function
public.orbiq_guard_permission(
    'execution.manage'
);


-- PUBLIC LINKS

drop trigger if exists
orbiq_permission_public_links
on public.quote_public_links;


create trigger
orbiq_permission_public_links

before insert or update or delete

on public.quote_public_links

for each row

execute function
public.orbiq_guard_permission(
    'commercial.manage'
);


-- ===========================================================
-- VALIDACAO INTERNA
-- ===========================================================

do $$
declare

    permission_trigger_count integer;

begin

    select
        count(*)

    into
        permission_trigger_count

    from
        pg_trigger
            as trigger_row

    join
        pg_class
            as relation

        on
            relation.oid =
                trigger_row.tgrelid

    join
        pg_namespace
            as namespace

        on
            namespace.oid =
                relation.relnamespace

    where
        namespace.nspname =
            'public'

        and
        trigger_row.tgname like
            'orbiq_permission_%'

        and
        not trigger_row.tgisinternal;


    if
        permission_trigger_count <
            16
    then

        raise exception
            'Quantidade inesperada de guards: %',
            permission_trigger_count;

    end if;


    if exists (

        select 1

        from
            pg_policies

        where
            schemaname =
                'public'

            and
            tablename in (
                'customers',
                'vehicles',
                'quotes',
                'quote_services',
                'quote_items',
                'suppliers',
                'labor_services',
                'purchase_orders',
                'work_orders'
            )

            and
            (
                coalesce(
                    qual,
                    ''
                ) like
                    '%is_org_member%'

                or

                coalesce(
                    with_check,
                    ''
                ) like
                    '%is_org_member%'
            )

    )
    then

        raise exception
            'Policy antiga baseada somente em is_org_member ainda existe';

    end if;

end;
$$;


notify pgrst, 'reload schema';


commit;