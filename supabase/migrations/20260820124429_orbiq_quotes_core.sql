-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 1.1
-- CORE DE ORCAMENTOS
-- ===========================================================


-- ===========================================================
-- ORCAMENTOS
-- ===========================================================

create table if not exists public.quotes (

    id uuid
        primary key
        default gen_random_uuid(),

    organization_id uuid
        not null
        references public.organizations(id)
        on delete cascade,

    customer_id uuid
        not null
        references public.customers(id)
        on delete restrict,

    vehicle_id uuid
        not null
        references public.vehicles(id)
        on delete restrict,

    protocol text
        not null,

    priority text
        not null
        default 'normal'
        check (
            priority in (
                'normal',
                'customer_waiting',
                'vehicle_stopped'
            )
        ),

    status text
        not null
        default 'estimating'
        check (
            status in (
                'awaiting_evaluation',
                'awaiting_quote',
                'estimating',
                'approved',
                'rejected',
                'awaiting_parts',
                'in_progress',
                'completed'
            )
        ),

    mileage integer
        check (
            mileage is null
            or mileage >= 0
        ),

    notes text,

    final_amount numeric(12,2)
        check (
            final_amount is null
            or final_amount >= 0
        ),

    created_by uuid
        references auth.users(id)
        on delete set null,

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now(),

    unique (
        organization_id,
        protocol
    )
);


create index if not exists
quotes_org_created_idx
on public.quotes (
    organization_id,
    created_at desc
);


create index if not exists
quotes_org_status_idx
on public.quotes (
    organization_id,
    status
);


create index if not exists
quotes_customer_idx
on public.quotes (
    organization_id,
    customer_id
);


create index if not exists
quotes_vehicle_idx
on public.quotes (
    organization_id,
    vehicle_id
);


-- ===========================================================
-- SERVICOS DO ORCAMENTO
-- ===========================================================

create table if not exists public.quote_services (

    id uuid
        primary key
        default gen_random_uuid(),

    organization_id uuid
        not null
        references public.organizations(id)
        on delete cascade,

    quote_id uuid
        not null
        references public.quotes(id)
        on delete cascade,

    category text
        not null,

    description text
        not null,

    needs_part boolean
        not null
        default false,

    labor_amount numeric(12,2)
        check (
            labor_amount is null
            or labor_amount >= 0
        ),

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now()
);


create index if not exists
quote_services_quote_idx
on public.quote_services (
    organization_id,
    quote_id
);


-- ===========================================================
-- PECAS / ITENS PARA COMPRA
-- ===========================================================

create table if not exists public.quote_items (

    id uuid
        primary key
        default gen_random_uuid(),

    organization_id uuid
        not null
        references public.organizations(id)
        on delete cascade,

    quote_id uuid
        not null
        references public.quotes(id)
        on delete cascade,

    category text
        not null,

    description text
        not null,

    quantity numeric(12,3)
        not null
        default 1
        check (
            quantity > 0
        ),

    unit text
        not null
        default 'un',

    side text,

    specification text,

    notes text,

    purchase_status text
        not null
        default 'pending'
        check (
            purchase_status in (
                'pending',
                'quoting',
                'approved',
                'ordered',
                'received',
                'cancelled'
            )
        ),

    supplier_id uuid
        references public.suppliers(id)
        on delete set null,

    chosen_amount numeric(12,2)
        check (
            chosen_amount is null
            or chosen_amount >= 0
        ),

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now()
);


create index if not exists
quote_items_quote_idx
on public.quote_items (
    organization_id,
    quote_id
);


create index if not exists
quote_items_status_idx
on public.quote_items (
    organization_id,
    purchase_status
);


-- ===========================================================
-- UPDATED_AT
-- ===========================================================

drop trigger if exists
quotes_set_updated_at
on public.quotes;


create trigger
quotes_set_updated_at
before update
on public.quotes
for each row
execute function public.set_updated_at();


drop trigger if exists
quote_services_set_updated_at
on public.quote_services;


create trigger
quote_services_set_updated_at
before update
on public.quote_services
for each row
execute function public.set_updated_at();


drop trigger if exists
quote_items_set_updated_at
on public.quote_items;


create trigger
quote_items_set_updated_at
before update
on public.quote_items
for each row
execute function public.set_updated_at();


-- ===========================================================
-- RLS
-- ===========================================================

alter table public.quotes
enable row level security;


alter table public.quote_services
enable row level security;


alter table public.quote_items
enable row level security;


-- ===========================================================
-- POLICIES - QUOTES
-- ===========================================================

drop policy if exists
quotes_member_select
on public.quotes;


create policy
quotes_member_select
on public.quotes
for select
to authenticated
using (
    (
        select public.is_org_member(
            organization_id
        )
    )
);


drop policy if exists
quotes_member_insert
on public.quotes;


create policy
quotes_member_insert
on public.quotes
for insert
to authenticated
with check (
    (
        select public.is_org_member(
            organization_id
        )
    )
);


drop policy if exists
quotes_member_update
on public.quotes;


create policy
quotes_member_update
on public.quotes
for update
to authenticated
using (
    (
        select public.is_org_member(
            organization_id
        )
    )
)
with check (
    (
        select public.is_org_member(
            organization_id
        )
    )
);


drop policy if exists
quotes_member_delete
on public.quotes;


create policy
quotes_member_delete
on public.quotes
for delete
to authenticated
using (
    (
        select public.is_org_member(
            organization_id
        )
    )
);


-- ===========================================================
-- POLICIES - SERVICES
-- ===========================================================

drop policy if exists
quote_services_member_all
on public.quote_services;


create policy
quote_services_member_all
on public.quote_services
for all
to authenticated
using (
    (
        select public.is_org_member(
            organization_id
        )
    )
)
with check (
    (
        select public.is_org_member(
            organization_id
        )
    )
);


-- ===========================================================
-- POLICIES - ITEMS
-- ===========================================================

drop policy if exists
quote_items_member_all
on public.quote_items;


create policy
quote_items_member_all
on public.quote_items
for all
to authenticated
using (
    (
        select public.is_org_member(
            organization_id
        )
    )
)
with check (
    (
        select public.is_org_member(
            organization_id
        )
    )
);


-- ===========================================================
-- DATA API GRANTS
-- ===========================================================

grant
    select,
    insert,
    update,
    delete
on table public.quotes
to authenticated;


grant
    select,
    insert,
    update,
    delete
on table public.quote_services
to authenticated;


grant
    select,
    insert,
    update,
    delete
on table public.quote_items
to authenticated;


-- ===========================================================
-- RPC TRANSACIONAL
--
-- Salva:
-- 1. Orcamento
-- 2. Servicos
-- 3. Pecas
--
-- Tudo dentro da mesma transacao PostgreSQL.
-- ===========================================================

create or replace function public.create_quote(

    target_org_id uuid,

    target_customer_id uuid,

    target_vehicle_id uuid,

    target_priority text,

    target_mileage integer
        default null,

    target_notes text
        default null,

    services jsonb
        default '[]'::jsonb,

    items jsonb
        default '[]'::jsonb
)
returns table (

    quote_id uuid,

    protocol text
)
language plpgsql
security invoker
set search_path = public
as $$
declare

    new_quote_id uuid;

    new_protocol text;

    entry jsonb;

begin

    -- =======================================================
    -- AUTENTICACAO
    -- =======================================================

    if auth.uid() is null then

        raise exception
            'Authentication required';

    end if;


    -- =======================================================
    -- ORGANIZACAO
    -- =======================================================

    if not public.is_org_member(
        target_org_id
    ) then

        raise exception
            'User does not belong to organization';

    end if;


    -- =======================================================
    -- PRIORIDADE
    -- =======================================================

    if target_priority not in (

        'normal',

        'customer_waiting',

        'vehicle_stopped'

    ) then

        raise exception
            'Invalid quote priority';

    end if;


    -- =======================================================
    -- KM
    -- =======================================================

    if
        target_mileage is not null
        and target_mileage < 0
    then

        raise exception
            'Invalid mileage';

    end if;


    -- =======================================================
    -- CLIENTE
    -- =======================================================

    if not exists (

        select 1

        from public.customers

        where id =
            target_customer_id

          and organization_id =
            target_org_id

    ) then

        raise exception
            'Customer does not belong to organization';

    end if;


    -- =======================================================
    -- VEICULO
    -- =======================================================

    if not exists (

        select 1

        from public.vehicles

        where id =
            target_vehicle_id

          and organization_id =
            target_org_id

          and customer_id =
            target_customer_id

    ) then

        raise exception
            'Vehicle does not belong to selected customer';

    end if;


    -- =======================================================
    -- PROTOCOLO
    -- =======================================================

    new_protocol :=

        'ORB-' ||

        to_char(
            now(),
            'YYMMDD-HH24MISS'
        ) ||

        '-' ||

        upper(
            substr(
                replace(
                    gen_random_uuid()::text,
                    '-',
                    ''
                ),
                1,
                4
            )
        );


    -- =======================================================
    -- ORCAMENTO
    -- =======================================================

    insert into public.quotes (

        organization_id,

        customer_id,

        vehicle_id,

        protocol,

        priority,

        status,

        mileage,

        notes,

        created_by

    )
    values (

        target_org_id,

        target_customer_id,

        target_vehicle_id,

        new_protocol,

        target_priority,

        'estimating',

        target_mileage,

        nullif(
            btrim(
                coalesce(
                    target_notes,
                    ''
                )
            ),
            ''
        ),

        auth.uid()

    )
    returning id
    into new_quote_id;


    -- =======================================================
    -- SERVICOS
    -- =======================================================

    for entry in

        select value

        from jsonb_array_elements(
            coalesce(
                services,
                '[]'::jsonb
            )
        )

    loop

        if nullif(
            btrim(
                entry ->> 'description'
            ),
            ''
        ) is null then

            continue;

        end if;


        insert into public.quote_services (

            organization_id,

            quote_id,

            category,

            description,

            needs_part,

            labor_amount

        )
        values (

            target_org_id,

            new_quote_id,

            coalesce(
                nullif(
                    btrim(
                        entry ->> 'category'
                    ),
                    ''
                ),
                'Outros'
            ),

            btrim(
                entry ->> 'description'
            ),

            case

                when lower(
                    coalesce(
                        entry ->> 'needs_part',
                        'false'
                    )
                ) in (
                    'true',
                    '1',
                    'yes',
                    'sim'
                )
                then true

                else false

            end,

            case

                when nullif(
                    btrim(
                        coalesce(
                            entry ->> 'labor_amount',
                            ''
                        )
                    ),
                    ''
                ) is null
                then null

                else (
                    entry ->> 'labor_amount'
                )::numeric

            end

        );

    end loop;


    -- =======================================================
    -- PECAS / ITENS
    -- =======================================================

    for entry in

        select value

        from jsonb_array_elements(
            coalesce(
                items,
                '[]'::jsonb
            )
        )

    loop

        if nullif(
            btrim(
                entry ->> 'description'
            ),
            ''
        ) is null then

            continue;

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

            coalesce(
                nullif(
                    btrim(
                        entry ->> 'category'
                    ),
                    ''
                ),
                'Outros'
            ),

            btrim(
                entry ->> 'description'
            ),

            case

                when nullif(
                    btrim(
                        coalesce(
                            entry ->> 'quantity',
                            ''
                        )
                    ),
                    ''
                ) is null
                then 1

                else (
                    entry ->> 'quantity'
                )::numeric

            end,

            coalesce(
                nullif(
                    btrim(
                        entry ->> 'unit'
                    ),
                    ''
                ),
                'un'
            ),

            nullif(
                btrim(
                    coalesce(
                        entry ->> 'side',
                        ''
                    )
                ),
                ''
            ),

            nullif(
                btrim(
                    coalesce(
                        entry ->> 'specification',
                        ''
                    )
                ),
                ''
            ),

            nullif(
                btrim(
                    coalesce(
                        entry ->> 'notes',
                        ''
                    )
                ),
                ''
            ),

            'pending'

        );

    end loop;


    -- =======================================================
    -- RESULTADO
    -- =======================================================

    return query

    select
        new_quote_id,
        new_protocol;

end;
$$;


revoke all
on function public.create_quote(
    uuid,
    uuid,
    uuid,
    text,
    integer,
    text,
    jsonb,
    jsonb
)
from public,
anon;


grant execute
on function public.create_quote(
    uuid,
    uuid,
    uuid,
    text,
    integer,
    text,
    jsonb,
    jsonb
)
to authenticated;


notify pgrst, 'reload schema';