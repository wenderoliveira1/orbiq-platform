-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 1.9D
-- VISAO CONSOLIDADA DA REDE
-- ===========================================================

drop function if exists
public.get_owned_organization_overview(date);


create or replace function
public.get_owned_organization_overview(
    report_month date
        default null
)
returns table (
    organization_id uuid,
    organization_name text,
    organization_slug text,
    quotes_month bigint,
    approved_quotes_month bigint,
    rejected_quotes_month bigint,
    waiting_quotes_month bigint,
    approved_amount_month numeric,
    customers_total bigint,
    vehicles_total bigint,
    active_work_orders bigint,
    open_purchase_orders bigint,
    active_members bigint,
    last_quote_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
    current_user_id uuid;
    month_start timestamptz;
    month_end timestamptz;
begin
    current_user_id := auth.uid();

    if current_user_id is null then
        raise exception
            'Authentication required'
            using errcode = '42501';
    end if;

    if not exists (
        select 1
        from public.organization_members as membership
        where
            membership.user_id = current_user_id
            and membership.role = 'owner'
            and membership.status = 'active'
    ) then
        raise exception
            'Somente um proprietário pode consultar a visão consolidada.'
            using errcode = '42501';
    end if;

    month_start := (
        date_trunc(
            'month',
            coalesce(
                report_month,
                (now() at time zone 'UTC')::date
            )::timestamp
        ) at time zone 'UTC'
    );

    month_end := month_start + interval '1 month';

    return query
    with owned_organizations as (
        select
            organization.id,
            organization.name,
            organization.slug
        from public.organization_members as membership
        inner join public.organizations as organization
            on organization.id = membership.organization_id
        where
            membership.user_id = current_user_id
            and membership.role = 'owner'
            and membership.status = 'active'
    ),
    quote_metrics as (
        select
            quote.organization_id,
            count(*) filter (
                where
                    quote.created_at >= month_start
                    and quote.created_at < month_end
            ) as quotes_month,
            count(*) filter (
                where
                    quote.created_at >= month_start
                    and quote.created_at < month_end
                    and quote.commercial_status = 'approved'
            ) as approved_quotes_month,
            count(*) filter (
                where
                    quote.created_at >= month_start
                    and quote.created_at < month_end
                    and quote.commercial_status = 'rejected'
            ) as rejected_quotes_month,
            count(*) filter (
                where
                    quote.created_at >= month_start
                    and quote.created_at < month_end
                    and quote.commercial_status = 'ready'
            ) as waiting_quotes_month,
            coalesce(
                sum(
                    coalesce(quote.final_amount, 0)
                ) filter (
                    where
                        quote.created_at >= month_start
                        and quote.created_at < month_end
                        and quote.commercial_status = 'approved'
                ),
                0
            ) as approved_amount_month,
            max(quote.created_at) as last_quote_at
        from public.quotes as quote
        inner join owned_organizations as owned
            on owned.id = quote.organization_id
        group by quote.organization_id
    ),
    customer_metrics as (
        select
            customer.organization_id,
            count(*) as customers_total
        from public.customers as customer
        inner join owned_organizations as owned
            on owned.id = customer.organization_id
        group by customer.organization_id
    ),
    vehicle_metrics as (
        select
            vehicle.organization_id,
            count(*) as vehicles_total
        from public.vehicles as vehicle
        inner join owned_organizations as owned
            on owned.id = vehicle.organization_id
        group by vehicle.organization_id
    ),
    work_order_metrics as (
        select
            work_order.organization_id,
            count(*) filter (
                where work_order.status in (
                    'pending',
                    'in_progress'
                )
            ) as active_work_orders
        from public.work_orders as work_order
        inner join owned_organizations as owned
            on owned.id = work_order.organization_id
        group by work_order.organization_id
    ),
    purchase_metrics as (
        select
            purchase_order.organization_id,
            count(*) filter (
                where purchase_order.status in (
                    'approved',
                    'ordered',
                    'partially_received'
                )
            ) as open_purchase_orders
        from public.purchase_orders as purchase_order
        inner join owned_organizations as owned
            on owned.id = purchase_order.organization_id
        group by purchase_order.organization_id
    ),
    member_metrics as (
        select
            membership.organization_id,
            count(*) filter (
                where membership.status = 'active'
            ) as active_members
        from public.organization_members as membership
        inner join owned_organizations as owned
            on owned.id = membership.organization_id
        group by membership.organization_id
    )
    select
        owned.id,
        owned.name,
        owned.slug,
        coalesce(quotes.quotes_month, 0),
        coalesce(quotes.approved_quotes_month, 0),
        coalesce(quotes.rejected_quotes_month, 0),
        coalesce(quotes.waiting_quotes_month, 0),
        coalesce(quotes.approved_amount_month, 0),
        coalesce(customers.customers_total, 0),
        coalesce(vehicles.vehicles_total, 0),
        coalesce(work_orders.active_work_orders, 0),
        coalesce(purchases.open_purchase_orders, 0),
        coalesce(members.active_members, 0),
        quotes.last_quote_at
    from owned_organizations as owned
    left join quote_metrics as quotes
        on quotes.organization_id = owned.id
    left join customer_metrics as customers
        on customers.organization_id = owned.id
    left join vehicle_metrics as vehicles
        on vehicles.organization_id = owned.id
    left join work_order_metrics as work_orders
        on work_orders.organization_id = owned.id
    left join purchase_metrics as purchases
        on purchases.organization_id = owned.id
    left join member_metrics as members
        on members.organization_id = owned.id
    order by
        owned.name,
        owned.id;
end;
$$;


revoke all
on function public.get_owned_organization_overview(date)
from public,
anon;


grant execute
on function public.get_owned_organization_overview(date)
to authenticated;


do $verification$
begin
    if has_function_privilege(
        'anon',
        'public.get_owned_organization_overview(date)',
        'EXECUTE'
    ) then
        raise exception
            'Anonymous role must not execute the network overview RPC';
    end if;

    if not has_function_privilege(
        'authenticated',
        'public.get_owned_organization_overview(date)',
        'EXECUTE'
    ) then
        raise exception
            'Authenticated role must execute the network overview RPC';
    end if;
end;
$verification$;


notify pgrst, 'reload schema';
