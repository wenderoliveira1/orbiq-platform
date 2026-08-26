-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 1.9E
-- GOVERNANCA E AUDITORIA CONSOLIDADA DA REDE
-- ===========================================================

drop function if exists
public.get_owned_network_activity(
    uuid,
    text,
    timestamptz,
    timestamptz,
    text,
    integer,
    integer
);


create or replace function
public.get_owned_network_activity(
    filter_organization_id uuid
        default null,
    filter_category text
        default null,
    filter_period_start timestamptz
        default null,
    filter_period_end timestamptz
        default null,
    filter_query text
        default null,
    result_limit integer
        default 50,
    result_offset integer
        default 0
)
returns table (
    event_id uuid,
    organization_id uuid,
    organization_name text,
    actor_user_id uuid,
    actor_type text,
    action text,
    category text,
    entity_type text,
    entity_id uuid,
    quote_id uuid,
    quote_protocol text,
    customer_name text,
    vehicle_plate text,
    metadata jsonb,
    created_at timestamptz,
    total_count bigint,
    governance_count bigint,
    client_count bigint,
    organizations_with_activity bigint
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
    current_user_id uuid;
    safe_category text;
    safe_period_start timestamptz;
    safe_period_end timestamptz;
    safe_query text;
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
            'Somente um proprietário pode consultar a auditoria da rede.'
            using errcode = '42501';
    end if;

    if
        filter_organization_id is not null
        and not exists (
            select 1
            from public.organization_members as membership
            where
                membership.organization_id = filter_organization_id
                and membership.user_id = current_user_id
                and membership.role = 'owner'
                and membership.status = 'active'
        )
    then
        raise exception
            'A oficina informada não pertence à rede do proprietário.'
            using errcode = '42501';
    end if;

    safe_category := nullif(
        lower(trim(coalesce(filter_category, ''))),
        ''
    );

    if
        safe_category is not null
        and safe_category not in (
            'quote',
            'commercial',
            'supplier',
            'purchase',
            'execution',
            'share',
            'governance',
            'other'
        )
    then
        raise exception
            'Categoria de auditoria inválida.'
            using errcode = '22023';
    end if;

    safe_period_end := coalesce(
        filter_period_end,
        now()
    );

    safe_period_start := coalesce(
        filter_period_start,
        safe_period_end - interval '30 days'
    );

    if safe_period_start >= safe_period_end then
        raise exception
            'O início do período deve ser anterior ao fim.'
            using errcode = '22023';
    end if;

    if safe_period_end - safe_period_start > interval '366 days' then
        raise exception
            'O período máximo de auditoria é de 366 dias.'
            using errcode = '22023';
    end if;

    if result_limit < 1 or result_limit > 100 then
        raise exception
            'O limite deve estar entre 1 e 100 registros.'
            using errcode = '22023';
    end if;

    if result_offset < 0 or result_offset > 10000 then
        raise exception
            'A paginação informada é inválida.'
            using errcode = '22023';
    end if;

    safe_query := nullif(
        lower(trim(coalesce(filter_query, ''))),
        ''
    );

    if char_length(coalesce(safe_query, '')) > 100 then
        raise exception
            'A pesquisa deve possuir no máximo 100 caracteres.'
            using errcode = '22023';
    end if;

    return query
    with owned_organizations as (
        select
            organization.id,
            organization.name
        from public.organization_members as membership
        inner join public.organizations as organization
            on organization.id = membership.organization_id
        where
            membership.user_id = current_user_id
            and membership.role = 'owner'
            and membership.status = 'active'
            and (
                filter_organization_id is null
                or organization.id = filter_organization_id
            )
    ),
    enriched as (
        select
            log.id as event_id,
            log.organization_id,
            owned.name as organization_name,
            log.actor_user_id,
            log.actor_type,
            log.action,
            case
                when
                    log.action like 'organization.%'
                    or log.action like 'team.%'
                    or log.action like 'settings.%'
                then 'governance'
                when log.action like 'quote.commercial%'
                then 'commercial'
                when log.action like 'quote.%'
                then 'quote'
                when log.action like 'supplier.%'
                then 'supplier'
                when log.action like 'purchase.%'
                then 'purchase'
                when log.action like 'work_order.%'
                then 'execution'
                when log.action like 'public_link.%'
                then 'share'
                else 'other'
            end as category,
            log.entity_type,
            log.entity_id,
            log.quote_id,
            quote.protocol as quote_protocol,
            customer.name as customer_name,
            vehicle.plate as vehicle_plate,
            log.metadata,
            log.created_at
        from public.audit_logs as log
        inner join owned_organizations as owned
            on owned.id = log.organization_id
        left join public.quotes as quote
            on quote.id = log.quote_id
            and quote.organization_id = log.organization_id
        left join public.customers as customer
            on customer.id = quote.customer_id
            and customer.organization_id = log.organization_id
        left join public.vehicles as vehicle
            on vehicle.id = quote.vehicle_id
            and vehicle.organization_id = log.organization_id
        where
            log.created_at >= safe_period_start
            and log.created_at < safe_period_end
    ),
    filtered as materialized (
        select enriched.*
        from enriched
        where
            (
                safe_category is null
                or enriched.category = safe_category
            )
            and (
                safe_query is null
                or lower(enriched.organization_name) like '%' || safe_query || '%'
                or lower(enriched.action) like '%' || safe_query || '%'
                or lower(coalesce(enriched.quote_protocol, '')) like '%' || safe_query || '%'
                or lower(coalesce(enriched.customer_name, '')) like '%' || safe_query || '%'
                or lower(coalesce(enriched.vehicle_plate, '')) like '%' || safe_query || '%'
                or lower(coalesce(enriched.actor_user_id::text, '')) like '%' || safe_query || '%'
                or lower(enriched.metadata::text) like '%' || safe_query || '%'
            )
    ),
    metrics as (
        select
            count(*) as total_count,
            count(*) filter (
                where filtered.category = 'governance'
            ) as governance_count,
            count(*) filter (
                where filtered.actor_type = 'client'
            ) as client_count,
            count(distinct filtered.organization_id) as organizations_with_activity
        from filtered
    )
    select
        filtered.event_id,
        filtered.organization_id,
        filtered.organization_name,
        filtered.actor_user_id,
        filtered.actor_type,
        filtered.action,
        filtered.category,
        filtered.entity_type,
        filtered.entity_id,
        filtered.quote_id,
        filtered.quote_protocol,
        filtered.customer_name,
        filtered.vehicle_plate,
        filtered.metadata,
        filtered.created_at,
        metrics.total_count,
        metrics.governance_count,
        metrics.client_count,
        metrics.organizations_with_activity
    from filtered
    cross join metrics
    order by
        filtered.created_at desc,
        filtered.event_id desc
    limit result_limit
    offset result_offset;
end;
$$;


revoke all
on function public.get_owned_network_activity(
    uuid,
    text,
    timestamptz,
    timestamptz,
    text,
    integer,
    integer
)
from public,
anon;


grant execute
on function public.get_owned_network_activity(
    uuid,
    text,
    timestamptz,
    timestamptz,
    text,
    integer,
    integer
)
to authenticated;


do $verification$
declare
    function_is_security_definer boolean;
    function_config text[];
begin
    select
        procedure_row.prosecdef,
        procedure_row.proconfig
    into
        function_is_security_definer,
        function_config
    from pg_proc as procedure_row
    inner join pg_namespace as namespace_row
        on namespace_row.oid = procedure_row.pronamespace
    where
        namespace_row.nspname = 'public'
        and procedure_row.proname = 'get_owned_network_activity'
    limit 1;

    if function_is_security_definer is null then
        raise exception
            'get_owned_network_activity não foi instalada';
    end if;

    if function_is_security_definer then
        raise exception
            'A auditoria da rede deve respeitar RLS com security invoker';
    end if;

    if not coalesce(
        'search_path=public, pg_temp' = any(function_config),
        false
    ) then
        raise exception
            'get_owned_network_activity precisa de search_path seguro';
    end if;

    if has_function_privilege(
        'anon',
        'public.get_owned_network_activity(uuid,text,timestamptz,timestamptz,text,integer,integer)',
        'EXECUTE'
    ) then
        raise exception
            'Anonymous role must not execute the network governance RPC';
    end if;

    if not has_function_privilege(
        'authenticated',
        'public.get_owned_network_activity(uuid,text,timestamptz,timestamptz,text,integer,integer)',
        'EXECUTE'
    ) then
        raise exception
            'Authenticated role must execute the network governance RPC';
    end if;
end;
$verification$;


notify pgrst, 'reload schema';
