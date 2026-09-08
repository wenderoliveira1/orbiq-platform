-- ===========================================================
-- ORBIQ PLATFORM
-- IDENTIDADE DO CLIENTE + TEXTO EM MAIUSCULO + ORCAMENTO
-- ===========================================================

-- ===========================================================
-- 1. NUMERO UNICO DO CLIENTE
-- ===========================================================

create sequence if not exists public.customer_number_seq;

alter table public.customers
    add column if not exists customer_number bigint;

update public.customers
set customer_number = nextval('public.customer_number_seq')
where customer_number is null;

alter sequence public.customer_number_seq
    owned by public.customers.customer_number;

alter table public.customers
    alter column customer_number set default nextval('public.customer_number_seq');

alter table public.customers
    alter column customer_number set not null;

create unique index if not exists customers_org_customer_number_uidx
on public.customers (organization_id, customer_number);

create index if not exists customers_org_customer_number_idx
on public.customers (organization_id, customer_number);

-- ===========================================================
-- 2. NORMALIZACAO DE TEXTO: TUDO QUE O USUARIO DIGITA
--    FICA EM MAIUSCULO NO BANCO.
-- ===========================================================

create or replace function public.orbiq_uppercase_business_text()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if TG_TABLE_NAME = 'customers' then
        new.name := upper(btrim(coalesce(new.name, '')));
        new.email := nullif(upper(btrim(coalesce(new.email, ''))), '');
        new.notes := nullif(upper(btrim(coalesce(new.notes, ''))), '');
    elsif TG_TABLE_NAME = 'vehicles' then
        new.plate := upper(btrim(coalesce(new.plate, '')));
        new.brand := nullif(upper(btrim(coalesce(new.brand, ''))), '');
        new.model := upper(btrim(coalesce(new.model, '')));
        new.version := nullif(upper(btrim(coalesce(new.version, ''))), '');
        new.notes := nullif(upper(btrim(coalesce(new.notes, ''))), '');
    elsif TG_TABLE_NAME = 'service_catalog' then
        new.category := upper(btrim(coalesce(new.category, '')));
        new.description := upper(btrim(coalesce(new.description, '')));
    elsif TG_TABLE_NAME = 'quotes' then
        new.notes := nullif(upper(btrim(coalesce(new.notes, ''))), '');
    elsif TG_TABLE_NAME = 'quote_services' then
        new.category := upper(btrim(coalesce(new.category, '')));
        new.description := upper(btrim(coalesce(new.description, '')));
    elsif TG_TABLE_NAME = 'quote_items' then
        new.category := upper(btrim(coalesce(new.category, '')));
        new.description := upper(btrim(coalesce(new.description, '')));
        new.unit := upper(btrim(coalesce(new.unit, 'UN')));
        new.side := nullif(upper(btrim(coalesce(new.side, ''))), '');
        new.specification := nullif(upper(btrim(coalesce(new.specification, ''))), '');
        new.notes := nullif(upper(btrim(coalesce(new.notes, ''))), '');
    elsif TG_TABLE_NAME = 'suppliers' then
        new.name := upper(btrim(coalesce(new.name, '')));
        new.notes := nullif(upper(btrim(coalesce(new.notes, ''))), '');
    elsif TG_TABLE_NAME = 'supplier_categories' then
        new.name := upper(btrim(coalesce(new.name, '')));
    elsif TG_TABLE_NAME = 'labor_items' then
        new.name := upper(btrim(coalesce(new.name, '')));
    end if;

    return new;
end;
$$;

-- Clientes
 drop trigger if exists orbiq_uppercase_customers on public.customers;
create trigger orbiq_uppercase_customers
before insert or update on public.customers
for each row execute function public.orbiq_uppercase_business_text();

-- Veiculos
 drop trigger if exists orbiq_uppercase_vehicles on public.vehicles;
create trigger orbiq_uppercase_vehicles
before insert or update on public.vehicles
for each row execute function public.orbiq_uppercase_business_text();

-- Servicos
 drop trigger if exists orbiq_uppercase_service_catalog on public.service_catalog;
create trigger orbiq_uppercase_service_catalog
before insert or update on public.service_catalog
for each row execute function public.orbiq_uppercase_business_text();

-- Orcamentos
 drop trigger if exists orbiq_uppercase_quotes on public.quotes;
create trigger orbiq_uppercase_quotes
before insert or update on public.quotes
for each row execute function public.orbiq_uppercase_business_text();

-- Servicos do orcamento
 drop trigger if exists orbiq_uppercase_quote_services on public.quote_services;
create trigger orbiq_uppercase_quote_services
before insert or update on public.quote_services
for each row execute function public.orbiq_uppercase_business_text();

-- Pecas
 drop trigger if exists orbiq_uppercase_quote_items on public.quote_items;
create trigger orbiq_uppercase_quote_items
before insert or update on public.quote_items
for each row execute function public.orbiq_uppercase_business_text();

-- Fornecedores / categorias / mao de obra
 drop trigger if exists orbiq_uppercase_suppliers on public.suppliers;
create trigger orbiq_uppercase_suppliers
before insert or update on public.suppliers
for each row execute function public.orbiq_uppercase_business_text();

 drop trigger if exists orbiq_uppercase_supplier_categories on public.supplier_categories;
create trigger orbiq_uppercase_supplier_categories
before insert or update on public.supplier_categories
for each row execute function public.orbiq_uppercase_business_text();

 drop trigger if exists orbiq_uppercase_labor_items on public.labor_items;
create trigger orbiq_uppercase_labor_items
before insert or update on public.labor_items
for each row execute function public.orbiq_uppercase_business_text();

-- Normaliza dados existentes sem alterar IDs/numeros.
update public.customers set name = upper(btrim(name)), email = nullif(upper(btrim(coalesce(email, ''))), ''), notes = nullif(upper(btrim(coalesce(notes, ''))), '');
update public.vehicles set plate = upper(btrim(plate)), brand = nullif(upper(btrim(coalesce(brand, ''))), ''), model = upper(btrim(model)), version = nullif(upper(btrim(coalesce(version, ''))), ''), notes = nullif(upper(btrim(coalesce(notes, ''))), '');
update public.service_catalog set category = upper(btrim(category)), description = upper(btrim(description));
update public.quotes set notes = nullif(upper(btrim(coalesce(notes, ''))), '');
update public.quote_services set category = upper(btrim(category)), description = upper(btrim(description));
update public.quote_items set category = upper(btrim(category)), description = upper(btrim(description)), unit = upper(btrim(coalesce(unit, 'UN'))), side = nullif(upper(btrim(coalesce(side, ''))), ''), specification = nullif(upper(btrim(coalesce(specification, ''))), ''), notes = nullif(upper(btrim(coalesce(notes, ''))), '');
update public.suppliers set name = upper(btrim(name)), notes = nullif(upper(btrim(coalesce(notes, ''))), '');
update public.supplier_categories set name = upper(btrim(name));
update public.labor_items set name = upper(btrim(name));

-- ===========================================================
-- 3. CATALOGO INICIAL DE SERVICOS EM MAIUSCULO
-- ===========================================================

insert into public.service_catalog (organization_id, category, description, default_labor_amount)
select o.id, seed.category, seed.description, 0
from public.organizations o
cross join (values
    ('MECANICA', 'TROCA COXIM MOTOR'),
    ('MECANICA', 'TROCA BOMBA DE COMBUSTIVEL'),
    ('MECANICA', 'TROCA CORREIA DE ACESSORIOS'),
    ('MECANICA', 'TROCA BOMBA D AGUA'),
    ('MECANICA', 'TROCA VELAS DE IGNICAO'),
    ('MECANICA', 'TROCA FILTRO DE COMBUSTIVEL'),
    ('SUSPENSAO', 'TROCA PIVO'),
    ('SUSPENSAO', 'TROCA AMORTECEDOR'),
    ('FREIOS', 'TROCA PASTILHAS DE FREIO'),
    ('FREIOS', 'TROCA DISCO DE FREIO'),
    ('DIRECAO', 'TROCA TERMINAL DE DIRECAO'),
    ('ARREFECIMENTO', 'SUBSTITUIR RADIADOR'),
    ('ELETRICA', 'DIAGNOSTICO ELETRICO'),
    ('MOTOR', 'DIAGNOSTICO DE FALHA DO MOTOR'),
    ('CAMBIO', 'TROCA DE OLEO DO CAMBIO')
) as seed(category, description)
on conflict do nothing;

-- ===========================================================
-- 4. RPC DE ORCAMENTO CORRIGIDA
--    A TELA USA service_catalog; a RPC antiga buscava
--    labor_services. Agora o servico selecionado consulta
--    o valor salvo no service_catalog.
-- ===========================================================

create or replace function public.create_quote_v2(
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
    service_labor_amount numeric;
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
        select 1
        from public.customers
        where id = target_customer_id
          and organization_id = target_org_id
    ) then
        raise exception 'Customer does not belong to organization';
    end if;

    if not exists (
        select 1
        from public.vehicles
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
        organization_id, customer_id, vehicle_id, protocol, priority, status, mileage, notes, created_by
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
        service_catalog_id := null;
        if nullif(btrim(coalesce(service_entry ->> 'service_catalog_id', '')), '') is not null then
            service_catalog_id := (service_entry ->> 'service_catalog_id')::uuid;
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
                service_labor_amount
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
            service_labor_amount := coalesce((service_entry ->> 'labor_amount')::numeric, 0);
            if char_length(service_description) < 2 then
                raise exception 'Service description is required';
            end if;
            if service_labor_amount < 0 then
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
            labor_amount
        )
        values (
            target_org_id,
            new_quote_id,
            null,
            service_category,
            service_description,
            service_needs_part,
            round(service_labor_amount, 2)
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

        if item_quantity <= 0 then
            raise exception 'Purchase item quantity must be greater than zero';
        end if;

        insert into public.quote_items (
            organization_id,
            quote_id,
            category,
            description,
            quantity,
            unit,
            side,
            specification,
            notes,
            purchase_status
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

    quote_id := new_quote_id;
    protocol := new_protocol;
    return next;
end;
$$;

revoke all on function public.create_quote_v2(uuid, uuid, uuid, text, integer, text, jsonb, jsonb) from public, anon;
grant execute on function public.create_quote_v2(uuid, uuid, uuid, text, integer, text, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
