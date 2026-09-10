-- ===========================================================
-- ORBIQ PLATFORM
-- Quote commercial FAST PATH: manual part cost without supplier
--
-- - chosen_amount may be set from Comercial (price_source path)
-- - supplier_id remains optional when cost + sale prices exist
-- - supplier award flow unchanged for AutoQA
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

    incomplete_cost_items integer;

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
        incomplete_cost_items,
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
        incomplete_cost_items >
            0
    then

        raise exception
            'Part cost is incomplete';

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

    cost_total numeric;

    cost_raw text;

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


        -- Optional manual cost (line total). When present, allows
        -- commercial fast path without a winning supplier.
        cost_raw :=
            item_entry ->>
            'cost_total_amount';

        if
            cost_raw is null
            or
            btrim(cost_raw) = ''
        then

            cost_total :=
                null;

        else

            cost_total :=
                cost_raw::numeric;

            if
                cost_total <
                    0
            then

                raise exception
                    'Invalid cost total amount';

            end if;

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
                calculated_sale_total,

            chosen_amount =
                case
                    when
                        cost_total is null
                    then
                        chosen_amount
                    else
                        round(
                            cost_total,
                            2
                        )
                end,

            purchase_status =
                case
                    when
                        cost_total is null
                    then
                        purchase_status
                    when
                        purchase_status =
                            'pending'
                    then
                        'approved'
                    else
                        purchase_status
                end

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

create or replace function
public.create_quote_public_link(

    target_org_id uuid,

    target_quote_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare

    generated_token text;

    current_status text;

    current_final numeric;

    missing_cost integer;

    missing_sale integer;

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

        current_status,

        current_final

    from
        public.quotes

    where
        id =
            target_quote_id

        and
        organization_id =
            target_org_id;


    if
        current_status is null
    then

        raise exception
            'Quote not found';

    end if;


    if
        current_status not in (
            'ready',
            'approved'
        )
    then

        raise exception
            'O orçamento comercial precisa ser salvo antes de compartilhar.';

    end if;


    if
        current_final is null
    then

        raise exception
            'O orçamento ainda não possui valor final.';

    end if;


    -- =======================================================
    -- REPARAR LEGADO / INCONSISTENCIA
    -- =======================================================

    perform
        public.orbiq_sync_awarded_supplier_items(
            target_org_id,
            target_quote_id
        );


    -- =======================================================
    -- VALIDAR PECAS
    -- =======================================================

    select

        count(*) filter (
            where
                chosen_amount is null
        ),

        count(*) filter (
            where
                sale_unit_amount is null
                or
                sale_total_amount is null
        )

    into
        missing_cost,
        missing_sale

    from
        public.quote_items

    where
        organization_id =
            target_org_id

        and
        quote_id =
            target_quote_id;


    if
        missing_cost >
            0
    then

        raise exception
            'Existe peça sem custo. Informe o preço direto no Comercial ou escolha um fornecedor em Cotações.';

    end if;


    if
        missing_sale >
            0
    then

        raise exception
            'Existe peça sem preço de venda. Salve novamente o orçamento Comercial.';

    end if;


    -- =======================================================
    -- REVOGAR LINK ANTERIOR
    -- =======================================================

    update
        public.quote_public_links

    set
        revoked_at =
            now()

    where
        organization_id =
            target_org_id

        and
        quote_id =
            target_quote_id

        and
        revoked_at is null;


    generated_token :=
        replace(
            gen_random_uuid()::text,
            '-',
            ''
        )
        ||
        replace(
            gen_random_uuid()::text,
            '-',
            ''
        );


    insert into
        public.quote_public_links (

            organization_id,

            quote_id,

            token,

            expires_at,

            created_by

        )
    values (

        target_org_id,

        target_quote_id,

        generated_token,

        now() +
            interval '7 days',

        auth.uid()

    );


    return
        generated_token;

end;
$$;

create or replace function
public.public_decide_quote(

    target_token text,

    target_decision text,

    target_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare

    target_quote_id uuid;

    target_org_id uuid;

    current_commercial_status text;

    items_count integer;

    missing_cost integer;

    missing_sale integer;

    next_status text;

    normalized_decision text;

begin

    normalized_decision :=
        lower(
            btrim(
                coalesce(
                    target_decision,
                    ''
                )
            )
        );


    if
        normalized_decision not in (
            'approved',
            'rejected'
        )
    then

        raise exception
            'Decisão inválida.';

    end if;


    select

        public_link.quote_id,

        public_link.organization_id

    into

        target_quote_id,

        target_org_id

    from
        public.quote_public_links
            as public_link

    where
        public_link.token =
            btrim(
                target_token
            )

        and
        public_link.revoked_at is null

        and
        public_link.expires_at >
            now();


    if
        target_quote_id is null
    then

        raise exception
            'Este link é inválido, expirou ou foi revogado.';

    end if;


    select
        commercial_status

    into
        current_commercial_status

    from
        public.quotes

    where
        id =
            target_quote_id

        and
        organization_id =
            target_org_id

    for update;


    if
        current_commercial_status is null
    then

        raise exception
            'Orçamento não encontrado.';

    end if;


    if
        current_commercial_status =
            'approved'

        and
        normalized_decision =
            'approved'
    then

        return
            jsonb_build_object(
                'decision',
                'approved'
            );

    end if;


    if
        current_commercial_status =
            'rejected'

        and
        normalized_decision =
            'rejected'
    then

        return
            jsonb_build_object(
                'decision',
                'rejected'
            );

    end if;


    if
        current_commercial_status <>
            'ready'
    then

        raise exception
            'Este orçamento não está mais aguardando uma decisão.';

    end if;


    -- =======================================================
    -- REPROVACAO NAO DEPENDE DE FORNECEDOR
    -- =======================================================

    if
        normalized_decision =
            'rejected'
    then

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


        return
            jsonb_build_object(

                'decision',
                'rejected',

                'workflow_status',
                'rejected'

            );

    end if;


    -- =======================================================
    -- APROVACAO
    --
    -- PRIMEIRO RECONCILIA EVENTUAL VENCEDOR JA REGISTRADO.
    -- =======================================================

    perform
        public.orbiq_sync_awarded_supplier_items(
            target_org_id,
            target_quote_id
        );


    select

        count(*),

        count(*) filter (
            where
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

        missing_cost,

        missing_sale

    from
        public.quote_items

    where
        organization_id =
            target_org_id

        and
        quote_id =
            target_quote_id;


    if
        missing_cost >
            0
    then

        raise exception
            'Existe peça sem custo. A oficina precisa informar o preço direto ou finalizar a cotação.';

    end if;


    if
        missing_sale >
            0
    then

        raise exception
            'Existe peça sem preço de venda. A oficina precisa revisar o orçamento comercial.';

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
        jsonb_build_object(

            'decision',
            'approved',

            'workflow_status',
            next_status

        );

end;
$$;

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
            and
            not can_commercial
        then

            raise exception
                'Permissão negada para escolher fornecedor ou custo da peça'
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


revoke all
on function
public.create_quote_public_link(
    uuid,
    uuid
)
from public,
anon;

grant execute
on function
public.create_quote_public_link(
    uuid,
    uuid
)
to authenticated;


revoke all
on function
public.public_decide_quote(
    text,
    text,
    text
)
from public,
anon;

grant execute
on function
public.public_decide_quote(
    text,
    text,
    text
)
to anon,
authenticated;


revoke all
on function
public.orbiq_guard_quote_items()
from public,
anon,
authenticated;



-- ===========================================================
-- CREATE QUOTE: optional manual chosen_amount / sale at insert
-- ===========================================================

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
  item_chosen numeric;
  item_sale_unit numeric;
  item_purchase_status text;
  chosen_raw text;
  sale_raw text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_org_member(target_org_id) then raise exception 'User does not belong to organization'; end if;
  if target_priority not in ('normal','customer_waiting','vehicle_stopped') then raise exception 'Invalid quote priority'; end if;
  if target_mileage is not null and target_mileage < 0 then raise exception 'Invalid mileage'; end if;

  if not exists (
    select 1 from public.customers
    where id = target_customer_id and organization_id = target_org_id
  ) then raise exception 'Customer does not belong to organization'; end if;

  if not exists (
    select 1 from public.vehicles
    where id = target_vehicle_id
      and organization_id = target_org_id
      and customer_id = target_customer_id
  ) then raise exception 'Vehicle does not belong to selected customer'; end if;

  if services is null or jsonb_typeof(services) <> 'array' or jsonb_array_length(services) = 0 then
    raise exception 'At least one service is required';
  end if;

  if items is null or jsonb_typeof(items) <> 'array' then
    raise exception 'Items must be a JSON array';
  end if;

  new_protocol := 'ORB-' || to_char(now(),'YYMMDD-HH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));

  insert into public.quotes(
    organization_id,customer_id,vehicle_id,protocol,priority,status,mileage,notes,created_by
  ) values (
    target_org_id,target_customer_id,target_vehicle_id,new_protocol,target_priority,'estimating',
    target_mileage,nullif(upper(btrim(coalesce(target_notes,''))),''),auth.uid()
  ) returning id into new_quote_id;

  for service_entry in select value from jsonb_array_elements(services) loop
    service_catalog_id := nullif(btrim(coalesce(service_entry->>'service_catalog_id','')),'')::uuid;
    service_quantity := coalesce((service_entry->>'quantity')::numeric,1);
    if service_quantity <= 0 or service_quantity > 100000 then raise exception 'Invalid service quantity'; end if;
    service_needs_part := coalesce((service_entry->>'needs_part')::boolean,false);

    if service_catalog_id is not null then
      select upper(btrim(description)), upper(btrim(category)), round(default_labor_amount,2)
      into service_description, service_category, service_unit_price
      from public.service_catalog
      where id=service_catalog_id and organization_id=target_org_id and active=true;
      if service_description is null then raise exception 'Service catalog item not found or inactive'; end if;
    else
      service_description := upper(btrim(coalesce(service_entry->>'description','')));
      service_category := upper(btrim(coalesce(service_entry->>'category','OUTROS')));
      service_unit_price := coalesce((service_entry->>'labor_amount')::numeric,0);
      if char_length(service_description) < 2 then raise exception 'Service description is required'; end if;
      if service_unit_price < 0 or service_unit_price > 1000000 then raise exception 'Invalid labor amount'; end if;
    end if;

    insert into public.quote_services(
      organization_id,quote_id,labor_service_id,category,description,needs_part,quantity,labor_amount
    ) values (
      target_org_id,new_quote_id,null,service_category,service_description,service_needs_part,
      service_quantity,round(service_unit_price,2)
    );
  end loop;

  for item_entry in select value from jsonb_array_elements(items) loop
    item_description := upper(btrim(coalesce(item_entry->>'description','')));
    if char_length(item_description) < 2 then raise exception 'Purchase item description is required'; end if;
    item_category := upper(btrim(coalesce(nullif(item_entry->>'category',''),'OUTROS')));
    item_quantity := coalesce((item_entry->>'quantity')::numeric,1);
    item_unit := upper(btrim(coalesce(nullif(item_entry->>'unit',''),'UN')));
    if item_quantity <= 0 or item_quantity > 100000 then raise exception 'Purchase item quantity must be greater than zero'; end if;

    chosen_raw := item_entry->>'chosen_amount';
    if chosen_raw is null or btrim(chosen_raw) = '' then
      item_chosen := null;
    else
      item_chosen := round(chosen_raw::numeric, 2);
      if item_chosen < 0 or item_chosen > 1000000 then
        raise exception 'Invalid chosen amount';
      end if;
    end if;

    sale_raw := item_entry->>'sale_unit_amount';
    if sale_raw is null or btrim(sale_raw) = '' then
      item_sale_unit := null;
    else
      item_sale_unit := round(sale_raw::numeric, 2);
      if item_sale_unit < 0 or item_sale_unit > 1000000 then
        raise exception 'Invalid sale unit amount';
      end if;
    end if;

    -- Manual price path: cost known without supplier winner.
    -- Reuse 'approved' (same as awarded supplier item) — no new enum.
    item_purchase_status := case
      when item_chosen is not null then 'approved'
      else 'pending'
    end;

    insert into public.quote_items(
      organization_id,quote_id,category,description,quantity,unit,side,specification,notes,
      purchase_status,chosen_amount,sale_unit_amount,sale_total_amount
    ) values (
      target_org_id,new_quote_id,item_category,item_description,item_quantity,item_unit,
      nullif(upper(btrim(coalesce(item_entry->>'side',''))),''),
      nullif(upper(btrim(coalesce(item_entry->>'specification',''))),''),
      nullif(upper(btrim(coalesce(item_entry->>'notes',''))),''),
      item_purchase_status,
      item_chosen,
      item_sale_unit,
      case
        when item_sale_unit is null then null
        else round(item_sale_unit * item_quantity, 2)
      end
    );
  end loop;

  perform public.recalculate_quote_final_amount(new_quote_id);
  quote_id := new_quote_id;
  protocol := new_protocol;
  return next;
end;
$$;

revoke all on function public.create_quote_with_quantities(uuid,uuid,uuid,text,integer,text,jsonb,jsonb) from public,anon;
grant execute on function public.create_quote_with_quantities(uuid,uuid,uuid,text,integer,text,jsonb,jsonb) to authenticated;


-- ===========================================================
-- chosen_amount is LINE TOTAL (supplier award + commercial cost).
-- Do not multiply by quantity again.
-- ===========================================================

create or replace function public.recalculate_quote_final_amount(target_quote_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_org_id uuid;
  labor_total numeric := 0;
  parts_total numeric := 0;
begin
  select organization_id
    into target_org_id
  from public.quotes
  where id = target_quote_id;

  if target_org_id is null then
    raise exception 'Quote does not belong to current organization';
  end if;

  if auth.uid() is not null and not public.is_org_member(target_org_id) then
    raise exception 'Quote does not belong to current organization';
  end if;

  select coalesce(sum(round(coalesce(qs.labor_amount, 0), 2) * coalesce(qs.quantity, 1)), 0)
    into labor_total
  from public.quote_services qs
  where qs.quote_id = target_quote_id
    and qs.organization_id = target_org_id;

  -- parts_total without quantity multiply (chosen_amount already line total)
  select coalesce(sum(round(coalesce(qi.chosen_amount, 0), 2)), 0)
    into parts_total
  from public.quote_items qi
  where qi.quote_id = target_quote_id
    and qi.organization_id = target_org_id
    and qi.chosen_amount is not null;

  update public.quotes
  set final_amount = round(labor_total + parts_total, 2)
  where id = target_quote_id
    and organization_id = target_org_id;
end;
$$;

revoke all on function public.recalculate_quote_final_amount(uuid) from public,anon;
grant execute on function public.recalculate_quote_final_amount(uuid) to authenticated;
