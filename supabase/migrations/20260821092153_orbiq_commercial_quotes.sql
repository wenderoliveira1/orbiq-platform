-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 1.5A
--
-- ORCAMENTO COMERCIAL
-- ===========================================================


-- ===========================================================
-- QUOTE ITEMS
--
-- chosen_amount:
-- custo total escolhido no fornecedor
--
-- sale_unit_amount:
-- preco unitario vendido ao cliente
--
-- sale_total_amount:
-- preco total vendido ao cliente
-- ===========================================================

alter table
public.quote_items

add column if not exists
sale_unit_amount numeric(12,2);


alter table
public.quote_items

add column if not exists
sale_total_amount numeric(12,2);


-- ===========================================================
-- QUOTES
-- ===========================================================

alter table
public.quotes

add column if not exists
commercial_status text
not null
default 'draft';


alter table
public.quotes

add column if not exists
parts_cost_amount numeric(12,2)
not null
default 0;


alter table
public.quotes

add column if not exists
parts_sale_amount numeric(12,2)
not null
default 0;


alter table
public.quotes

add column if not exists
labor_sale_amount numeric(12,2)
not null
default 0;


alter table
public.quotes

add column if not exists
subtotal_amount numeric(12,2)
not null
default 0;


alter table
public.quotes

add column if not exists
discount_type text
not null
default 'none';


alter table
public.quotes

add column if not exists
discount_value numeric(12,2)
not null
default 0;


alter table
public.quotes

add column if not exists
discount_amount numeric(12,2)
not null
default 0;


alter table
public.quotes

add column if not exists
commercial_approved_at timestamptz;


alter table
public.quotes

add column if not exists
commercial_rejected_at timestamptz;


alter table
public.quotes

add column if not exists
commercial_rejection_reason text;


-- ===========================================================
-- CONSTRAINTS
-- ===========================================================

do $$
begin

    if not exists (

        select 1

        from pg_constraint

        where
            conname =
                'quotes_commercial_status_check'

    ) then

        alter table
        public.quotes

        add constraint
        quotes_commercial_status_check

        check (
            commercial_status in (
                'draft',
                'ready',
                'approved',
                'rejected'
            )
        );

    end if;

end;
$$;


do $$
begin

    if not exists (

        select 1

        from pg_constraint

        where
            conname =
                'quotes_discount_type_check'

    ) then

        alter table
        public.quotes

        add constraint
        quotes_discount_type_check

        check (
            discount_type in (
                'none',
                'fixed',
                'percentage'
            )
        );

    end if;

end;
$$;


do $$
begin

    if not exists (

        select 1

        from pg_constraint

        where
            conname =
                'quotes_commercial_amounts_check'

    ) then

        alter table
        public.quotes

        add constraint
        quotes_commercial_amounts_check

        check (
            parts_cost_amount >= 0
            and
            parts_sale_amount >= 0
            and
            labor_sale_amount >= 0
            and
            subtotal_amount >= 0
            and
            discount_value >= 0
            and
            discount_amount >= 0
            and
            (
                final_amount is null
                or
                final_amount >= 0
            )
        );

    end if;

end;
$$;


do $$
begin

    if not exists (

        select 1

        from pg_constraint

        where
            conname =
                'quote_items_sale_amounts_check'

    ) then

        alter table
        public.quote_items

        add constraint
        quote_items_sale_amounts_check

        check (
            (
                sale_unit_amount is null
                or
                sale_unit_amount >= 0
            )
            and
            (
                sale_total_amount is null
                or
                sale_total_amount >= 0
            )
        );

    end if;

end;
$$;


-- ===========================================================
-- INDICES
-- ===========================================================

create index if not exists
quotes_org_commercial_status_idx
on public.quotes (
    organization_id,
    commercial_status
);


-- ===========================================================
-- INTERCEPTAR FLUXO ANTIGO
--
-- Antes:
-- fornecedores finalizados -> aguardando peças
--
-- Agora:
-- fornecedores finalizados -> aguardando avaliação
--
-- Somente approve_quote_commercial define commercial_status
-- = approved e permite entrar em awaiting_parts.
-- ===========================================================

create or replace function
public.orbiq_require_commercial_approval()
returns trigger
language plpgsql
set search_path = public
as $$
begin

    if
        new.status =
            'awaiting_parts'

        and
        coalesce(
            new.commercial_status,
            'draft'
        ) <>
        'approved'

    then

        new.status :=
            'awaiting_evaluation';

    end if;


    return new;

end;
$$;


drop trigger if exists
orbiq_quotes_require_commercial_approval
on public.quotes;


create trigger
orbiq_quotes_require_commercial_approval
before insert or update
on public.quotes
for each row
execute function
public.orbiq_require_commercial_approval();


-- ===========================================================
-- SALVAR ORCAMENTO COMERCIAL
-- ===========================================================

create or replace function
public.save_quote_commercial(

    target_org_id uuid,

    target_quote_id uuid,

    target_items jsonb,

    target_discount_type text,

    target_discount_value numeric
)
returns table (

    parts_cost_amount numeric,

    parts_sale_amount numeric,

    labor_sale_amount numeric,

    subtotal_amount numeric,

    discount_amount numeric,

    final_amount numeric
)
language plpgsql
security invoker
set search_path = public
as $$
declare

    quote_commercial_status text;

    quote_workflow_status text;

    quote_items_count integer;

    payload_count integer;

    payload_distinct_count integer;

    item_entry jsonb;

    item_uuid uuid;

    item_quantity numeric;

    sale_unit numeric;

    calculated_sale_total numeric;

    result_parts_cost numeric;

    result_parts_sale numeric;

    result_labor_sale numeric;

    result_subtotal numeric;

    result_discount numeric;

    result_final numeric;

    normalized_discount_type text;

    normalized_discount_value numeric;

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
        commercial_status,
        status

    into
        quote_commercial_status,
        quote_workflow_status

    from
        public.quotes

    where
        id =
            target_quote_id

        and
        organization_id =
            target_org_id;


    if
        quote_workflow_status is null
    then

        raise exception
            'Quote not found';

    end if;


    if
        quote_commercial_status =
            'approved'
    then

        raise exception
            'Approved commercial quote is locked';

    end if;


    if
        quote_workflow_status in (
            'in_progress',
            'completed'
        )
    then

        raise exception
            'Quote is already in execution';

    end if;


    -- =======================================================
    -- DESCONTO
    -- =======================================================

    normalized_discount_type :=
        lower(
            btrim(
                coalesce(
                    target_discount_type,
                    'none'
                )
            )
        );


    if
        normalized_discount_type not in (
            'none',
            'fixed',
            'percentage'
        )
    then

        raise exception
            'Invalid discount type';

    end if;


    normalized_discount_value :=
        coalesce(
            target_discount_value,
            0
        );


    if
        normalized_discount_value <
            0
    then

        raise exception
            'Invalid discount value';

    end if;


    if
        normalized_discount_type =
            'none'
    then

        normalized_discount_value :=
            0;

    end if;


    if
        normalized_discount_type =
            'percentage'

        and
        normalized_discount_value >
            100
    then

        raise exception
            'Percentage discount cannot exceed 100';

    end if;


    -- =======================================================
    -- QUANTIDADE DE PECAS
    -- =======================================================

    select
        count(*)

    into
        quote_items_count

    from
        public.quote_items

    where
        organization_id =
            target_org_id

        and
        quote_id =
            target_quote_id;


    if
        target_items is null
        or
        jsonb_typeof(
            target_items
        ) <>
        'array'
    then

        raise exception
            'Commercial items must be a JSON array';

    end if;


    payload_count :=
        jsonb_array_length(
            target_items
        );


    if
        payload_count <>
            quote_items_count
    then

        raise exception
            'Commercial payload must contain every quote item';

    end if;


    select
        count(
            distinct (
                value ->>
                'quote_item_id'
            )
        )

    into
        payload_distinct_count

    from
        jsonb_array_elements(
            target_items
        );


    if
        payload_distinct_count <>
            quote_items_count
    then

        raise exception
            'Commercial payload contains duplicate or missing items';

    end if;


    -- =======================================================
    -- PRECOS DE VENDA DAS PECAS
    -- =======================================================

    for item_entry in

        select value

        from
            jsonb_array_elements(
                target_items
            )

    loop

        item_uuid :=
            (
                item_entry ->>
                'quote_item_id'
            )::uuid;


        sale_unit :=
            (
                item_entry ->>
                'sale_unit_amount'
            )::numeric;


        if
            sale_unit is null
            or
            sale_unit <
                0
        then

            raise exception
                'Invalid sale unit amount';

        end if;


        select
            quantity

        into
            item_quantity

        from
            public.quote_items

        where
            id =
                item_uuid

            and
            organization_id =
                target_org_id

            and
            quote_id =
                target_quote_id;


        if
            item_quantity is null
        then

            raise exception
                'Quote item does not belong to quote';

        end if;


        calculated_sale_total :=
            round(
                item_quantity *
                sale_unit,
                2
            );


        update
            public.quote_items

        set
            sale_unit_amount =
                round(
                    sale_unit,
                    2
                ),

            sale_total_amount =
                calculated_sale_total

        where
            id =
                item_uuid

            and
            organization_id =
                target_org_id

            and
            quote_id =
                target_quote_id;

    end loop;


    -- =======================================================
    -- TOTAIS
    -- =======================================================

    select
        coalesce(
            sum(
                chosen_amount
            ),
            0
        ),

        coalesce(
            sum(
                sale_total_amount
            ),
            0
        )

    into
        result_parts_cost,
        result_parts_sale

    from
        public.quote_items

    where
        organization_id =
            target_org_id

        and
        quote_id =
            target_quote_id;


    select
        coalesce(
            sum(
                labor_amount
            ),
            0
        )

    into
        result_labor_sale

    from
        public.quote_services

    where
        organization_id =
            target_org_id

        and
        quote_id =
            target_quote_id;


    result_subtotal :=
        round(
            result_parts_sale +
            result_labor_sale,
            2
        );


    if
        normalized_discount_type =
            'percentage'
    then

        result_discount :=
            round(
                result_subtotal *
                (
                    normalized_discount_value /
                    100
                ),
                2
            );

    elseif
        normalized_discount_type =
            'fixed'
    then

        if
            normalized_discount_value >
            result_subtotal
        then

            raise exception
                'Fixed discount cannot exceed subtotal';

        end if;


        result_discount :=
            round(
                normalized_discount_value,
                2
            );

    else

        result_discount :=
            0;

    end if;


    result_final :=
        round(
            result_subtotal -
            result_discount,
            2
        );


    -- =======================================================
    -- SALVAR
    -- =======================================================

    update
        public.quotes

    set
        commercial_status =
            'ready',

        parts_cost_amount =
            round(
                result_parts_cost,
                2
            ),

        parts_sale_amount =
            round(
                result_parts_sale,
                2
            ),

        labor_sale_amount =
            round(
                result_labor_sale,
                2
            ),

        subtotal_amount =
            result_subtotal,

        discount_type =
            normalized_discount_type,

        discount_value =
            round(
                normalized_discount_value,
                2
            ),

        discount_amount =
            result_discount,

        final_amount =
            result_final,

        commercial_rejected_at =
            null,

        commercial_rejection_reason =
            null,

        status =
            case

                when
                    status in (
                        'estimating',
                        'awaiting_quote',
                        'awaiting_evaluation',
                        'rejected'
                    )
                then
                    'awaiting_evaluation'

                else
                    status

            end

    where
        id =
            target_quote_id

        and
        organization_id =
            target_org_id;


    parts_cost_amount :=
        round(
            result_parts_cost,
            2
        );


    parts_sale_amount :=
        round(
            result_parts_sale,
            2
        );


    labor_sale_amount :=
        round(
            result_labor_sale,
            2
        );


    subtotal_amount :=
        result_subtotal;


    discount_amount :=
        result_discount;


    final_amount :=
        result_final;


    return next;

end;
$$;


revoke all
on function
public.save_quote_commercial(
    uuid,
    uuid,
    jsonb,
    text,
    numeric
)
from public,
anon;


grant execute
on function
public.save_quote_commercial(
    uuid,
    uuid,
    jsonb,
    text,
    numeric
)
to authenticated;


-- ===========================================================
-- APROVAR ORCAMENTO COMERCIAL
-- ===========================================================

create or replace function
public.approve_quote_commercial(

    target_org_id uuid,

    target_quote_id uuid
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare

    current_commercial_status text;

    current_final_amount numeric;

    items_count integer;

    incomplete_supplier_items integer;

    incomplete_sale_items integer;

    next_status text;

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
        commercial_status,
        final_amount

    into
        current_commercial_status,
        current_final_amount

    from
        public.quotes

    where
        id =
            target_quote_id

        and
        organization_id =
            target_org_id;


    if
        current_commercial_status is null
    then

        raise exception
            'Quote not found';

    end if;


    if
        current_commercial_status <>
            'ready'
    then

        raise exception
            'Commercial quote must be saved before approval';

    end if;


    if
        current_final_amount is null
    then

        raise exception
            'Commercial quote has no final amount';

    end if;


    select
        count(*),

        count(*) filter (
            where
                supplier_id is null
                or
                chosen_amount is null
        ),

        count(*) filter (
            where
                sale_unit_amount is null
                or
                sale_total_amount is null
        )

    into
        items_count,
        incomplete_supplier_items,
        incomplete_sale_items

    from
        public.quote_items

    where
        organization_id =
            target_org_id

        and
        quote_id =
            target_quote_id;


    if
        incomplete_sale_items >
            0
    then

        raise exception
            'All quote items need a sale price';

    end if;


    if
        items_count >
            0

        and
        incomplete_supplier_items >
            0
    then

        raise exception
            'Supplier selection is incomplete';

    end if;


    if
        items_count >
            0
    then

        next_status :=
            'awaiting_parts';

    else

        next_status :=
            'approved';

    end if;


    update
        public.quotes

    set
        commercial_status =
            'approved',

        commercial_approved_at =
            now(),

        commercial_rejected_at =
            null,

        commercial_rejection_reason =
            null,

        status =
            next_status

    where
        id =
            target_quote_id

        and
        organization_id =
            target_org_id;


    return
        next_status;

end;
$$;


revoke all
on function
public.approve_quote_commercial(
    uuid,
    uuid
)
from public,
anon;


grant execute
on function
public.approve_quote_commercial(
    uuid,
    uuid
)
to authenticated;


-- ===========================================================
-- REPROVAR
-- ===========================================================

create or replace function
public.reject_quote_commercial(

    target_org_id uuid,

    target_quote_id uuid,

    target_reason text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
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


    if exists (

        select 1

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
                'cancelled'

    ) then

        raise exception
            'Quote already has active purchase orders';

    end if;


    if exists (

        select 1

        from
            public.work_orders

        where
            organization_id =
                target_org_id

            and
            quote_id =
                target_quote_id

            and
            status in (
                'in_progress',
                'completed'
            )

    ) then

        raise exception
            'Quote already entered workshop execution';

    end if;


    update
        public.quotes

    set
        commercial_status =
            'rejected',

        commercial_approved_at =
            null,

        commercial_rejected_at =
            now(),

        commercial_rejection_reason =
            nullif(
                btrim(
                    coalesce(
                        target_reason,
                        ''
                    )
                ),
                ''
            ),

        status =
            'rejected'

    where
        id =
            target_quote_id

        and
        organization_id =
            target_org_id;


    if not found then

        raise exception
            'Quote not found';

    end if;

end;
$$;


revoke all
on function
public.reject_quote_commercial(
    uuid,
    uuid,
    text
)
from public,
anon;


grant execute
on function
public.reject_quote_commercial(
    uuid,
    uuid,
    text
)
to authenticated;


-- ===========================================================
-- REABRIR COMERCIAL
-- ===========================================================

create or replace function
public.reopen_quote_commercial(

    target_org_id uuid,

    target_quote_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
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


    if exists (

        select 1

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
                'cancelled'

    ) then

        raise exception
            'Quote already has active purchase orders';

    end if;


    if exists (

        select 1

        from
            public.work_orders

        where
            organization_id =
                target_org_id

            and
            quote_id =
                target_quote_id

            and
            status in (
                'in_progress',
                'completed'
            )

    ) then

        raise exception
            'Quote already entered workshop execution';

    end if;


    update
        public.quotes

    set
        commercial_status =
            case

                when
                    final_amount is null
                then
                    'draft'

                else
                    'ready'

            end,

        commercial_approved_at =
            null,

        commercial_rejected_at =
            null,

        commercial_rejection_reason =
            null,

        status =
            'awaiting_evaluation'

    where
        id =
            target_quote_id

        and
        organization_id =
            target_org_id;


    if not found then

        raise exception
            'Quote not found';

    end if;

end;
$$;


revoke all
on function
public.reopen_quote_commercial(
    uuid,
    uuid
)
from public,
anon;


grant execute
on function
public.reopen_quote_commercial(
    uuid,
    uuid
)
to authenticated;


notify pgrst, 'reload schema';