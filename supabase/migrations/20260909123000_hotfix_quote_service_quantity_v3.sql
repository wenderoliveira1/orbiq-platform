-- ===========================================================
-- ORBIQ PLATFORM
-- HOTFIX V3: DEDICATED QUOTE CREATOR WITH SERVICE QUANTITY
-- ===========================================================

alter table public.quote_services
    add column if not exists quantity numeric(12,3) not null default 1;

alter table public.quote_services
    drop constraint if exists quote_services_quantity_check;

alter table public.quote_services
    add constraint quote_services_quantity_check
    check (quantity > 0);

create or replace function public.create_quote_with_quantities(
    target_org_id uuid,
    target_customer_id uuid,
    target_vehicle_id uuid,
    target_priority text,
    target_mileage integer,
    target_notes text,
    services jsonb,
    items jsonb
)
returns table (quote_id uuid, protocol text)
language plpgsql
security invoker
set search_path = public
as $$
declare
    new_quote_id uuid;
    new_protocol text;
    service_entry jsonb;
    item_entry jsonb;
    service_catalog_id uuid;
    service_description text;
    service_category text;
    service_needs_part boolean;
    service_unit_price numeric;
    service_quantity numeric;
    item_description text;
    item_category text;
    item_quantity numeric;
    item_unit text;
begin
    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

    if not public.is_org_member(target_org_id) then
        raise exception 'User does not belong to organization';
    end if;

    if target_priority not in ('normal', 'customer_waiting', 'vehicle_stopped') then
        raise exception 'Invalid quote priority';
    end if;

    if target_mileage is not null and target_mileage < 0 then
        raise exception 'Invalid mileage';
    end if;

    if not exists (
        select 1 from public.customers
        where id = target_customer_id
          and organization_id = target_org_id
    ) then
        raise exception 'Customer does not belong to organization';
    end if;

    if not exists (
        select 1 from public.vehicles
        where id = target_vehicle_id
          and organization_id = target_org_id
          and customer_id = target_customer_id
    ) then
        raise exception 'Vehicle does not belong to selected customer';
    end if;

    if services is null or jsonb_typeof(services) <> 'array' or jsonb_array_length(services) = 0 then
        raise exception 'At least one service is required';
    end if;

    if items is null or jsonb_typeof(items) <> 'array' then
        raise exception 'Items must be a JSON array';
    end if;

    new_protocol := 'ORB-' || to_char(now(), 'YYMMDD-HH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

    insert into public.quotes (
        organization_id, customer_id, vehicle_id, protocol,
        priority, status, mileage, notes, created_by
    )
    values (
        target_org_id,
        target_customer_id,
        target_vehicle_id,
        new_protocol,
        target_priority,
        'estimating',
        target_mileage,
        nullif(upper(btrim(coalesce(target_notes, ''))), ''),
        auth.uid()
    )
    returning id into new_quote_id;

    for service_entry in select value from jsonb_array_elements(services)
    loop
        service_catalog_id := nullif(btrim(coalesce(service_entry ->> 'service_catalog_id', '')), '')::uuid;
        service_quantity := coalesce((service_entry ->> 'quantity')::numeric, 1);

        if service_quantity <= 0 or service_quantity > 100000 then
            raise exception 'Invalid service quantity';
        end if;

        service_needs_part := coalesce((service_entry ->> 'needs_part')::boolean, false);

        if service_catalog_id is not null then
            select
                upper(btrim(description)),
                upper(btrim(category)),
                round(default_labor_amount, 2)
            into
                service_description,
                service_category,
                service_unit_price
            from public.service_catalog
            where id = service_catalog_id
              and organization_id = target_org_id
              and active = true;

            if service_description is null then
                raise exception 'Service catalog item not found or inactive';
            end if;
        else
            service_description := upper(btrim(coalesce(service_entry ->> 'description', '')));
            service_category := upper(btrim(coalesce(service_entry ->> 'category', 'OUTROS')));
            service_unit_price := coalesce((service_entry ->> 'labor_amount')::numeric, 0);

            if char_length(service_description) < 2 then
                raise exception 'Service description is required';
            end if;

            if service_unit_price < 0 or service_unit_price > 1000000 then
                raise exception 'Invalid labor amount';
            end if;
        end if;

        insert into public.quote_services (
            organization_id,
            quote_id,
            labor_service_id,
            category,
            description,
            needs_part,
            quantity,
            labor_amount
        )
        values (
            target_org_id,
            new_quote_id,
            null,
            service_category,
            service_description,
            service_needs_part,
            service_quantity,
            round(service_unit_price, 2)
        );
    end loop;

    for item_entry in select value from jsonb_array_elements(items)
    loop
        item_description := upper(btrim(coalesce(item_entry ->> 'description', '')));
        if char_length(item_description) < 2 then
            raise exception 'Purchase item description is required';
        end if;

        item_category := upper(btrim(coalesce(nullif(item_entry ->> 'category', ''), 'OUTROS')));
        item_quantity := coalesce((item_entry ->> 'quantity')::numeric, 1);
        item_unit := upper(btrim(coalesce(nullif(item_entry ->> 'unit', ''), 'UN')));

        if item_quantity <= 0 or item_quantity > 100000 then
            raise exception 'Purchase item quantity must be greater than zero';
        end if;

        insert into public.quote_items (
            organization_id, quote_id, category, description, quantity, unit,
            side, specification, notes, purchase_status
        )
        values (
            target_org_id,
            new_quote_id,
            item_category,
            item_description,
            item_quantity,
            item_unit,
            nullif(upper(btrim(coalesce(item_entry ->> 'side', ''))), ''),
            nullif(upper(btrim(coalesce(item_entry ->> 'specification', ''))), ''),
            nullif(upper(btrim(coalesce(item_entry ->> 'notes', ''))), ''),
            'pending'
        );
    end loop;

    update public.quotes
    set final_amount = round(
        coalesce((
            select sum(coalesce(qs.labor_amount, 0) * coalesce(qs.quantity, 1))
            from public.quote_services qs
            where qs.quote_id = new_quote_id
        ), 0)
        + coalesce((
            select sum(coalesce(qi.chosen_amount, 0) * coalesce(qi.quantity, 1))
            from public.quote_items qi
            where qi.quote_id = new_quote_id
              and qi.chosen_amount is not null
        ), 0),
        2
    )
    where id = new_quote_id;

    quote_id := new_quote_id;
    protocol := new_protocol;
    return next;
end;
$$;

revoke all on function public.create_quote_with_quantities(uuid, uuid, uuid, text, integer, text, jsonb, jsonb) from public, anon;
grant execute on function public.create_quote_with_quantities(uuid, uuid, uuid, text, integer, text, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
