-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 1.3A
--
-- COMPRAS + PEDIDOS + RECEBIMENTO
-- ===========================================================


-- ===========================================================
-- PEDIDOS DE COMPRA
-- ===========================================================

create table if not exists
public.purchase_orders (

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

    supplier_id uuid
        not null
        references public.suppliers(id)
        on delete restrict,

    code text
        not null
        default (
            'PO-' ||
            upper(
                substr(
                    replace(
                        gen_random_uuid()::text,
                        '-',
                        ''
                    ),
                    1,
                    8
                )
            )
        ),

    status text
        not null
        default 'approved'
        check (
            status in (
                'approved',
                'ordered',
                'partially_received',
                'received',
                'cancelled'
            )
        ),

    total_amount numeric(12,2)
        not null
        default 0
        check (
            total_amount >= 0
        ),

    ordered_at timestamptz,

    received_at timestamptz,

    notes text,

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now(),

    unique (
        organization_id,
        quote_id,
        supplier_id
    ),

    unique (
        organization_id,
        code
    )
);


-- ===========================================================
-- ITENS DOS PEDIDOS
--
-- Snapshot da compra.
--
-- Mesmo que futuramente o cadastro do orcamento mude,
-- o pedido mantem aquilo que realmente foi comprado.
-- ===========================================================

create table if not exists
public.purchase_order_items (

    id uuid
        primary key
        default gen_random_uuid(),

    organization_id uuid
        not null
        references public.organizations(id)
        on delete cascade,

    order_id uuid
        not null
        references public.purchase_orders(id)
        on delete cascade,

    quote_item_id uuid
        not null
        references public.quote_items(id)
        on delete restrict,

    category text
        not null,

    description text
        not null,

    quantity numeric
        not null
        check (
            quantity > 0
        ),

    unit text
        not null,

    side text,

    specification text,

    unit_amount numeric(12,2)
        not null
        check (
            unit_amount >= 0
        ),

    total_amount numeric(12,2)
        not null
        check (
            total_amount >= 0
        ),

    status text
        not null
        default 'approved'
        check (
            status in (
                'approved',
                'ordered',
                'received'
            )
        ),

    received_quantity numeric
        not null
        default 0
        check (
            received_quantity >= 0
        ),

    received_at timestamptz,

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now(),

    unique (
        order_id,
        quote_item_id
    )
);


-- ===========================================================
-- INDICES
-- ===========================================================

create index if not exists
purchase_orders_org_status_idx
on public.purchase_orders (
    organization_id,
    status
);


create index if not exists
purchase_orders_quote_idx
on public.purchase_orders (
    organization_id,
    quote_id
);


create index if not exists
purchase_orders_supplier_idx
on public.purchase_orders (
    organization_id,
    supplier_id
);


create index if not exists
purchase_order_items_order_idx
on public.purchase_order_items (
    organization_id,
    order_id
);


create index if not exists
purchase_order_items_quote_item_idx
on public.purchase_order_items (
    quote_item_id
);


create index if not exists
purchase_order_items_status_idx
on public.purchase_order_items (
    organization_id,
    status
);


-- ===========================================================
-- UPDATED_AT
-- ===========================================================

create or replace function
public.orbiq_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin

    new.updated_at :=
        now();

    return new;

end;
$$;


drop trigger if exists
orbiq_purchase_orders_updated_at
on public.purchase_orders;


create trigger
orbiq_purchase_orders_updated_at
before update
on public.purchase_orders
for each row
execute function
public.orbiq_set_updated_at();


drop trigger if exists
orbiq_purchase_order_items_updated_at
on public.purchase_order_items;


create trigger
orbiq_purchase_order_items_updated_at
before update
on public.purchase_order_items
for each row
execute function
public.orbiq_set_updated_at();


-- ===========================================================
-- RLS
-- ===========================================================

alter table
public.purchase_orders
enable row level security;


alter table
public.purchase_order_items
enable row level security;


drop policy if exists
orbiq_purchase_orders_member_all
on public.purchase_orders;


create policy
orbiq_purchase_orders_member_all
on public.purchase_orders
for all
to authenticated
using (
    (
        select
        public.is_org_member(
            organization_id
        )
    )
)
with check (
    (
        select
        public.is_org_member(
            organization_id
        )
    )
);


drop policy if exists
orbiq_purchase_order_items_member_all
on public.purchase_order_items;


create policy
orbiq_purchase_order_items_member_all
on public.purchase_order_items
for all
to authenticated
using (
    (
        select
        public.is_org_member(
            organization_id
        )
    )
)
with check (
    (
        select
        public.is_org_member(
            organization_id
        )
    )
);


-- ===========================================================
-- GRANTS
-- ===========================================================

grant
    select,
    insert,
    update,
    delete
on table
public.purchase_orders
to authenticated;


grant
    select,
    insert,
    update,
    delete
on table
public.purchase_order_items
to authenticated;


-- ===========================================================
-- SINCRONIZAR COMPRAS APROVADAS -> PEDIDOS
--
-- Cada fornecedor recebe um pedido proprio.
--
-- Exemplo:
--
-- Fornecedor A
--   Coxim
--   Pastilha
--
-- Fornecedor B
--   Radiador
--
-- =>
--
-- PO-XXXX -> Fornecedor A
-- PO-YYYY -> Fornecedor B
--
-- A funcao e idempotente.
-- Pode executar novamente sem duplicar pedidos.
-- ===========================================================

create or replace function
public.sync_quote_purchase_orders(

    target_org_id uuid,

    target_quote_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare

    current_quote_status text;

    supplier_uuid uuid;

    order_uuid uuid;

    order_state text;

    order_count integer :=
        0;

begin

    -- =======================================================
    -- AUTH
    -- =======================================================

    if auth.uid() is null then

        raise exception
            'Authentication required';

    end if;


    if not public.is_org_member(
        target_org_id
    ) then

        raise exception
            'User does not belong to organization';

    end if;


    -- =======================================================
    -- ORCAMENTO
    -- =======================================================

    select
        status

    into
        current_quote_status

    from
        public.quotes

    where
        id =
            target_quote_id

        and
        organization_id =
            target_org_id;


    if
        current_quote_status is null
    then

        raise exception
            'Quote not found';

    end if;


    if
        current_quote_status not in (
            'awaiting_parts',
            'in_progress'
        )
    then

        raise exception
            'Quote purchases have not been approved yet';

    end if;


    -- =======================================================
    -- PRECISA EXISTIR PECA COM FORNECEDOR ESCOLHIDO
    -- =======================================================

    if not exists (

        select 1

        from
            public.quote_items

        where
            organization_id =
                target_org_id

            and
            quote_id =
                target_quote_id

            and
            supplier_id is not null

            and
            chosen_amount is not null

    ) then

        raise exception
            'No approved purchase items found';

    end if;


    -- =======================================================
    -- UM PEDIDO PARA CADA FORNECEDOR
    -- =======================================================

    for supplier_uuid in

        select distinct
            supplier_id

        from
            public.quote_items

        where
            organization_id =
                target_org_id

            and
            quote_id =
                target_quote_id

            and
            supplier_id is not null

            and
            chosen_amount is not null

    loop

        -- ===================================================
        -- CRIAR OU RECUPERAR PEDIDO
        -- ===================================================

        insert into
            public.purchase_orders (

                organization_id,

                quote_id,

                supplier_id,

                status

            )
        values (

            target_org_id,

            target_quote_id,

            supplier_uuid,

            'approved'

        )

        on conflict (
            organization_id,
            quote_id,
            supplier_id
        )
        do update
        set
            status =
                case

                    when
                        public.purchase_orders.status =
                            'cancelled'
                    then
                        'approved'

                    else
                        public.purchase_orders.status

                end,

            ordered_at =
                case

                    when
                        public.purchase_orders.status =
                            'cancelled'
                    then
                        null

                    else
                        public.purchase_orders.ordered_at

                end,

            received_at =
                case

                    when
                        public.purchase_orders.status =
                            'cancelled'
                    then
                        null

                    else
                        public.purchase_orders.received_at

                end

        returning
            id,
            status

        into
            order_uuid,
            order_state;


        -- ===================================================
        -- SOMENTE PEDIDOS AINDA NAO ENVIADOS PODEM SER
        -- RESSINCRONIZADOS
        -- ===================================================

        if
            order_state =
                'approved'
        then

            delete from
                public.purchase_order_items

            where
                organization_id =
                    target_org_id

                and
                order_id =
                    order_uuid;


            insert into
                public.purchase_order_items (

                    organization_id,

                    order_id,

                    quote_item_id,

                    category,

                    description,

                    quantity,

                    unit,

                    side,

                    specification,

                    unit_amount,

                    total_amount,

                    status

                )

            select

                target_org_id,

                order_uuid,

                quote_item.id,

                quote_item.category,

                quote_item.description,

                quote_item.quantity,

                quote_item.unit,

                quote_item.side,

                quote_item.specification,

                round(
                    quote_item.chosen_amount /
                    quote_item.quantity,
                    2
                ),

                quote_item.chosen_amount,

                'approved'

            from
                public.quote_items
                    as quote_item

            where
                quote_item.organization_id =
                    target_org_id

                and
                quote_item.quote_id =
                    target_quote_id

                and
                quote_item.supplier_id =
                    supplier_uuid

                and
                quote_item.chosen_amount
                    is not null;


            update
                public.purchase_orders

            set
                total_amount =
                    coalesce(
                        (
                            select
                                sum(
                                    item.total_amount
                                )

                            from
                                public.purchase_order_items
                                    as item

                            where
                                item.organization_id =
                                    target_org_id

                                and
                                item.order_id =
                                    order_uuid
                        ),
                        0
                    )

            where
                id =
                    order_uuid

                and
                organization_id =
                    target_org_id;

        end if;


        order_count :=
            order_count +
            1;

    end loop;


    -- =======================================================
    -- CANCELAR PEDIDO AINDA NAO ENVIADO CASO O FORNECEDOR
    -- TENHA DEIXADO DE SER VENCEDOR
    -- =======================================================

    update
        public.purchase_orders
            as purchase_order

    set
        status =
            'cancelled'

    where
        purchase_order.organization_id =
            target_org_id

        and
        purchase_order.quote_id =
            target_quote_id

        and
        purchase_order.status =
            'approved'

        and not exists (

            select 1

            from
                public.quote_items
                    as quote_item

            where
                quote_item.organization_id =
                    target_org_id

                and
                quote_item.quote_id =
                    target_quote_id

                and
                quote_item.supplier_id =
                    purchase_order.supplier_id

                and
                quote_item.chosen_amount
                    is not null

        );


    return
        order_count;

end;
$$;


revoke all
on function
public.sync_quote_purchase_orders(
    uuid,
    uuid
)
from public,
anon;


grant execute
on function
public.sync_quote_purchase_orders(
    uuid,
    uuid
)
to authenticated;


-- ===========================================================
-- MARCAR PEDIDO COMO REALIZADO
-- ===========================================================

create or replace function
public.mark_purchase_order_ordered(

    target_org_id uuid,

    target_order_id uuid
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare

    result_code text;

begin

    if auth.uid() is null then

        raise exception
            'Authentication required';

    end if;


    if not public.is_org_member(
        target_org_id
    ) then

        raise exception
            'User does not belong to organization';

    end if;


    update
        public.purchase_orders

    set
        status =
            'ordered',

        ordered_at =
            coalesce(
                ordered_at,
                now()
            )

    where
        id =
            target_order_id

        and
        organization_id =
            target_org_id

        and
        status in (
            'approved',
            'ordered'
        )

    returning
        code

    into
        result_code;


    if
        result_code is null
    then

        raise exception
            'Purchase order cannot be marked as ordered';

    end if;


    update
        public.purchase_order_items

    set
        status =
            'ordered'

    where
        organization_id =
            target_org_id

        and
        order_id =
            target_order_id

        and
        status =
            'approved';


    return
        result_code;

end;
$$;


revoke all
on function
public.mark_purchase_order_ordered(
    uuid,
    uuid
)
from public,
anon;


grant execute
on function
public.mark_purchase_order_ordered(
    uuid,
    uuid
)
to authenticated;


-- ===========================================================
-- VERIFICAR SE TODAS AS PECAS DO ORCAMENTO CHEGARAM
-- ===========================================================

create or replace function
public.refresh_quote_material_status(

    target_org_id uuid,

    target_quote_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare

    active_orders integer;

    pending_orders integer;

begin

    if auth.uid() is null then

        raise exception
            'Authentication required';

    end if;


    if not public.is_org_member(
        target_org_id
    ) then

        raise exception
            'User does not belong to organization';

    end if;


    select
        count(*)

    into
        active_orders

    from
        public.purchase_orders

    where
        organization_id =
            target_org_id

        and
        quote_id =
            target_quote_id

        and
        status <>
            'cancelled';


    if
        active_orders =
            0
    then

        return
            false;

    end if;


    select
        count(*)

    into
        pending_orders

    from
        public.purchase_orders

    where
        organization_id =
            target_org_id

        and
        quote_id =
            target_quote_id

        and
        status not in (
            'received',
            'cancelled'
        );


    if
        pending_orders =
            0
    then

        update
            public.quotes

        set
            status =
                'in_progress'

        where
            id =
                target_quote_id

            and
            organization_id =
                target_org_id

            and
            status =
                'awaiting_parts';


        return
            true;

    end if;


    return
        false;

end;
$$;


revoke all
on function
public.refresh_quote_material_status(
    uuid,
    uuid
)
from public,
anon;


grant execute
on function
public.refresh_quote_material_status(
    uuid,
    uuid
)
to authenticated;


-- ===========================================================
-- RECEBER UMA PECA
-- ===========================================================

create or replace function
public.receive_purchase_order_item(

    target_org_id uuid,

    target_order_item_id uuid
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare

    order_uuid uuid;

    quote_uuid uuid;

    item_quantity numeric;

    total_items integer;

    received_items integer;

    new_order_status text;

begin

    if auth.uid() is null then

        raise exception
            'Authentication required';

    end if;


    if not public.is_org_member(
        target_org_id
    ) then

        raise exception
            'User does not belong to organization';

    end if;


    -- =======================================================
    -- ITEM + PEDIDO
    -- =======================================================

    select
        purchase_item.order_id,
        purchase_order.quote_id,
        purchase_item.quantity

    into
        order_uuid,
        quote_uuid,
        item_quantity

    from
        public.purchase_order_items
            as purchase_item

    join
        public.purchase_orders
            as purchase_order

        on
            purchase_order.id =
                purchase_item.order_id

    where
        purchase_item.id =
            target_order_item_id

        and
        purchase_item.organization_id =
            target_org_id

        and
        purchase_order.organization_id =
            target_org_id

        and
        purchase_order.status <>
            'cancelled';


    if
        order_uuid is null
    then

        raise exception
            'Purchase order item not found';

    end if;


    -- =======================================================
    -- RECEBER
    -- =======================================================

    update
        public.purchase_order_items

    set
        status =
            'received',

        received_quantity =
            item_quantity,

        received_at =
            coalesce(
                received_at,
                now()
            )

    where
        id =
            target_order_item_id

        and
        organization_id =
            target_org_id;


    -- =======================================================
    -- RECALCULAR PEDIDO
    -- =======================================================

    select
        count(*),

        count(*) filter (
            where
                status =
                    'received'
        )

    into
        total_items,
        received_items

    from
        public.purchase_order_items

    where
        organization_id =
            target_org_id

        and
        order_id =
            order_uuid;


    if
        received_items =
            total_items
    then

        new_order_status :=
            'received';


        update
            public.purchase_orders

        set
            status =
                'received',

            received_at =
                coalesce(
                    received_at,
                    now()
                )

        where
            id =
                order_uuid

            and
            organization_id =
                target_org_id;

    elseif
        received_items >
            0
    then

        new_order_status :=
            'partially_received';


        update
            public.purchase_orders

        set
            status =
                'partially_received'

        where
            id =
                order_uuid

            and
            organization_id =
                target_org_id;

    else

        new_order_status :=
            'ordered';

    end if;


    perform
        public.refresh_quote_material_status(
            target_org_id,
            quote_uuid
        );


    return
        new_order_status;

end;
$$;


revoke all
on function
public.receive_purchase_order_item(
    uuid,
    uuid
)
from public,
anon;


grant execute
on function
public.receive_purchase_order_item(
    uuid,
    uuid
)
to authenticated;


-- ===========================================================
-- RECEBER PEDIDO INTEIRO
-- ===========================================================

create or replace function
public.receive_purchase_order_all(

    target_org_id uuid,

    target_order_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare

    quote_uuid uuid;

    affected_items integer;

begin

    if auth.uid() is null then

        raise exception
            'Authentication required';

    end if;


    if not public.is_org_member(
        target_org_id
    ) then

        raise exception
            'User does not belong to organization';

    end if;


    select
        quote_id

    into
        quote_uuid

    from
        public.purchase_orders

    where
        id =
            target_order_id

        and
        organization_id =
            target_org_id

        and
        status <>
            'cancelled';


    if
        quote_uuid is null
    then

        raise exception
            'Purchase order not found';

    end if;


    update
        public.purchase_order_items

    set
        status =
            'received',

        received_quantity =
            quantity,

        received_at =
            coalesce(
                received_at,
                now()
            )

    where
        organization_id =
            target_org_id

        and
        order_id =
            target_order_id

        and
        status <>
            'received';


    get diagnostics
        affected_items =
            row_count;


    update
        public.purchase_orders

    set
        status =
            'received',

        ordered_at =
            coalesce(
                ordered_at,
                now()
            ),

        received_at =
            coalesce(
                received_at,
                now()
            )

    where
        id =
            target_order_id

        and
        organization_id =
            target_org_id;


    perform
        public.refresh_quote_material_status(
            target_org_id,
            quote_uuid
        );


    return
        affected_items;

end;
$$;


revoke all
on function
public.receive_purchase_order_all(
    uuid,
    uuid
)
from public,
anon;


grant execute
on function
public.receive_purchase_order_all(
    uuid,
    uuid
)
to authenticated;


notify pgrst, 'reload schema';