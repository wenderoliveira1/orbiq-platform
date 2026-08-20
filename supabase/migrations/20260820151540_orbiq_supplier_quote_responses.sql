-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 1.2C
--
-- RESPOSTAS DE COTACOES POR ITEM
-- ===========================================================


-- ===========================================================
-- RESPOSTA DE UM FORNECEDOR PARA UMA PECA
-- ===========================================================

create table if not exists
public.quote_supplier_item_responses (

    id uuid
        primary key
        default gen_random_uuid(),

    organization_id uuid
        not null
        references public.organizations(id)
        on delete cascade,

    request_id uuid
        not null
        references public.quote_supplier_requests(id)
        on delete cascade,

    quote_item_id uuid
        not null
        references public.quote_items(id)
        on delete cascade,

    brand_option text,

    unit_price numeric(12,2)
        not null
        check (
            unit_price > 0
        ),

    total_price numeric(12,2)
        not null
        check (
            total_price > 0
        ),

    availability text,

    delivery text,

    notes text,

    awarded boolean
        not null
        default false,

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now(),

    unique (
        request_id,
        quote_item_id
    )
);


-- ===========================================================
-- INDICES
-- ===========================================================

create index if not exists
quote_supplier_item_responses_request_idx
on public.quote_supplier_item_responses (
    organization_id,
    request_id
);


create index if not exists
quote_supplier_item_responses_item_idx
on public.quote_supplier_item_responses (
    organization_id,
    quote_item_id
);


create index if not exists
quote_supplier_item_responses_awarded_idx
on public.quote_supplier_item_responses (
    organization_id,
    awarded
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
orbiq_quote_supplier_item_responses_updated_at
on public.quote_supplier_item_responses;


create trigger
orbiq_quote_supplier_item_responses_updated_at
before update
on public.quote_supplier_item_responses
for each row
execute function
public.orbiq_set_updated_at();


-- ===========================================================
-- RLS
-- ===========================================================

alter table
public.quote_supplier_item_responses
enable row level security;


drop policy if exists
orbiq_quote_supplier_item_responses_member_all
on public.quote_supplier_item_responses;


create policy
orbiq_quote_supplier_item_responses_member_all
on public.quote_supplier_item_responses
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
public.quote_supplier_item_responses
to authenticated;


-- ===========================================================
-- SALVAR RESPOSTA DO FORNECEDOR
--
-- Exemplo:
--
-- [
--   {
--     "quote_item_id": "...",
--     "brand_option": "Axios",
--     "unit_price": 250.00,
--     "availability": "Disponivel",
--     "delivery": "Hoje",
--     "notes": ""
--   }
-- ]
--
-- O total da linha NAO vem do frontend.
--
-- PostgreSQL calcula:
--
-- quantidade x preco unitario
-- ===========================================================

create or replace function
public.save_supplier_response(

    target_org_id uuid,

    target_request_id uuid,

    target_items jsonb,

    target_delivery text,

    target_notes text
)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare

    request_entry jsonb;

    request_quote_id uuid;

    request_status text;

    item_uuid uuid;

    item_quantity numeric;

    price_value numeric;

    total_value numeric;

    response_total numeric;

begin

    -- =======================================================
    -- AUTENTICACAO
    -- =======================================================

    if auth.uid() is null then

        raise exception
            'Authentication required';

    end if;


    -- =======================================================
    -- EMPRESA
    -- =======================================================

    if not public.is_org_member(
        target_org_id
    ) then

        raise exception
            'User does not belong to organization';

    end if;


    -- =======================================================
    -- SOLICITACAO
    -- =======================================================

    select
        quote_id,
        status

    into
        request_quote_id,
        request_status

    from
        public.quote_supplier_requests

    where
        id =
            target_request_id

        and
        organization_id =
            target_org_id;


    if
        request_quote_id is null
    then

        raise exception
            'Supplier request not found';

    end if;


    if
        request_status =
            'cancelled'
    then

        raise exception
            'Cancelled request cannot receive a response';

    end if;


    -- =======================================================
    -- PAYLOAD
    -- =======================================================

    if
        target_items is null
        or
        jsonb_typeof(
            target_items
        ) <> 'array'
        or
        jsonb_array_length(
            target_items
        ) = 0
    then

        raise exception
            'At least one quoted item is required';

    end if;


    -- =======================================================
    -- ITENS
    -- =======================================================

    for request_entry in

        select value

        from jsonb_array_elements(
            target_items
        )

    loop

        item_uuid :=
            (
                request_entry ->>
                'quote_item_id'
            )::uuid;


        price_value :=
            (
                request_entry ->>
                'unit_price'
            )::numeric;


        if
            price_value is null
            or
            price_value <= 0
        then

            raise exception
                'Invalid unit price';

        end if;


        -- ===================================================
        -- CONFIRMAR SE A PECA FOI ENVIADA A ESTE FORNECEDOR
        -- ===================================================

        select
            quote_item.quantity

        into
            item_quantity

        from
            public.quote_supplier_request_items
                as request_item

        join
            public.quote_items
                as quote_item

            on
                quote_item.id =
                    request_item.quote_item_id

        where
            request_item.organization_id =
                target_org_id

            and
            request_item.request_id =
                target_request_id

            and
            request_item.quote_item_id =
                item_uuid

            and
            quote_item.organization_id =
                target_org_id

            and
            quote_item.quote_id =
                request_quote_id;


        if
            item_quantity is null
        then

            raise exception
                'Item does not belong to supplier request';

        end if;


        total_value :=
            round(
                item_quantity *
                price_value,
                2
            );


        -- ===================================================
        -- UPSERT
        -- ===================================================

        insert into
            public.quote_supplier_item_responses (

                organization_id,

                request_id,

                quote_item_id,

                brand_option,

                unit_price,

                total_price,

                availability,

                delivery,

                notes

            )
        values (

            target_org_id,

            target_request_id,

            item_uuid,

            nullif(
                btrim(
                    coalesce(
                        request_entry ->>
                        'brand_option',
                        ''
                    )
                ),
                ''
            ),

            price_value,

            total_value,

            nullif(
                btrim(
                    coalesce(
                        request_entry ->>
                        'availability',
                        ''
                    )
                ),
                ''
            ),

            nullif(
                btrim(
                    coalesce(
                        request_entry ->>
                        'delivery',
                        ''
                    )
                ),
                ''
            ),

            nullif(
                btrim(
                    coalesce(
                        request_entry ->>
                        'notes',
                        ''
                    )
                ),
                ''
            )

        )

        on conflict (
            request_id,
            quote_item_id
        )
        do update
        set

            brand_option =
                excluded.brand_option,

            unit_price =
                excluded.unit_price,

            total_price =
                excluded.total_price,

            availability =
                excluded.availability,

            delivery =
                excluded.delivery,

            notes =
                excluded.notes;

    end loop;


    -- =======================================================
    -- TOTAL DO FORNECEDOR
    -- =======================================================

    select
        coalesce(
            sum(
                total_price
            ),
            0
        )

    into
        response_total

    from
        public.quote_supplier_item_responses

    where
        organization_id =
            target_org_id

        and
        request_id =
            target_request_id;


    -- =======================================================
    -- ATUALIZAR SOLICITACAO
    -- =======================================================

    update
        public.quote_supplier_requests

    set
        status =
            case
                when winner = true
                    then 'won'
                else 'responded'
            end,

        responded_at =
            now(),

        response_amount =
            response_total,

        response_delivery =
            nullif(
                btrim(
                    coalesce(
                        target_delivery,
                        ''
                    )
                ),
                ''
            ),

        response_notes =
            nullif(
                btrim(
                    coalesce(
                        target_notes,
                        ''
                    )
                ),
                ''
            )

    where
        id =
            target_request_id

        and
        organization_id =
            target_org_id;


    return
        response_total;

end;
$$;


revoke all
on function
public.save_supplier_response(
    uuid,
    uuid,
    jsonb,
    text,
    text
)
from public,
anon;


grant execute
on function
public.save_supplier_response(
    uuid,
    uuid,
    jsonb,
    text,
    text
)
to authenticated;


-- ===========================================================
-- ESCOLHER FORNECEDOR PARA UMA PECA
--
-- IMPORTANTE:
-- O vencedor e definido POR PECA.
--
-- Isso permite:
--
-- Coxim     -> fornecedor A
-- Radiador  -> fornecedor B
-- Pneu      -> fornecedor C
-- ===========================================================

create or replace function
public.award_supplier_quote_item(

    target_org_id uuid,

    target_quote_item_id uuid,

    target_request_id uuid
)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare

    quote_uuid uuid;

    supplier_uuid uuid;

    selected_total numeric;

begin

    -- =======================================================
    -- AUTENTICACAO
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
    -- SOLICITACAO
    -- =======================================================

    select
        quote_id,
        supplier_id

    into
        quote_uuid,
        supplier_uuid

    from
        public.quote_supplier_requests

    where
        id =
            target_request_id

        and
        organization_id =
            target_org_id

        and
        status <> 'cancelled';


    if
        quote_uuid is null
    then

        raise exception
            'Supplier request not found';

    end if;


    -- =======================================================
    -- PECA PRECISA PERTENCER A ESTA COTACAO
    -- =======================================================

    if not exists (

        select 1

        from
            public.quote_supplier_request_items

        where
            organization_id =
                target_org_id

            and
            request_id =
                target_request_id

            and
            quote_item_id =
                target_quote_item_id

    ) then

        raise exception
            'Item was not quoted by this supplier';

    end if;


    -- =======================================================
    -- PRECISA TER RESPOSTA COM PRECO
    -- =======================================================

    select
        total_price

    into
        selected_total

    from
        public.quote_supplier_item_responses

    where
        organization_id =
            target_org_id

        and
        request_id =
            target_request_id

        and
        quote_item_id =
            target_quote_item_id;


    if
        selected_total is null
    then

        raise exception
            'Supplier has no price for this item';

    end if;


    -- =======================================================
    -- REMOVER VENCEDOR ANTERIOR DESTA PECA
    -- =======================================================

    update
        public.quote_supplier_item_responses

    set
        awarded =
            false

    where
        organization_id =
            target_org_id

        and
        quote_item_id =
            target_quote_item_id;


    -- =======================================================
    -- NOVO VENCEDOR
    -- =======================================================

    update
        public.quote_supplier_item_responses

    set
        awarded =
            true

    where
        organization_id =
            target_org_id

        and
        request_id =
            target_request_id

        and
        quote_item_id =
            target_quote_item_id;


    -- =======================================================
    -- ATUALIZAR PECA
    -- =======================================================

    update
        public.quote_items

    set
        supplier_id =
            supplier_uuid,

        chosen_amount =
            selected_total,

        purchase_status =
            'approved'

    where
        id =
            target_quote_item_id

        and
        quote_id =
            quote_uuid

        and
        organization_id =
            target_org_id;


    if not found then

        raise exception
            'Quote item not found';

    end if;


    -- =======================================================
    -- RECALCULAR FLAG DE VENCEDOR DOS FORNECEDORES
    -- =======================================================

    update
        public.quote_supplier_requests
            as request

    set
        winner =
            exists (

                select 1

                from
                    public.quote_supplier_item_responses
                        as response

                where
                    response.organization_id =
                        target_org_id

                    and
                    response.request_id =
                        request.id

                    and
                    response.awarded =
                        true

            )

    where
        request.organization_id =
            target_org_id

        and
        request.quote_id =
            quote_uuid;


    -- =======================================================
    -- STATUS DO FORNECEDOR
    -- =======================================================

    update
        public.quote_supplier_requests
            as request

    set
        status =
            case

                when request.winner =
                    true
                then
                    'won'

                when request.status in (
                    'won',
                    'lost'
                )
                then
                    'responded'

                else
                    request.status

            end

    where
        request.organization_id =
            target_org_id

        and
        request.quote_id =
            quote_uuid;


    return
        selected_total;

end;
$$;


revoke all
on function
public.award_supplier_quote_item(
    uuid,
    uuid,
    uuid
)
from public,
anon;


grant execute
on function
public.award_supplier_quote_item(
    uuid,
    uuid,
    uuid
)
to authenticated;


-- ===========================================================
-- FINALIZAR ESCOLHA DAS COMPRAS
-- ===========================================================

create or replace function
public.finalize_quote_supplier_awards(

    target_org_id uuid,

    target_quote_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare

    total_items integer;

    pending_items integer;

    current_status text;

begin

    -- =======================================================
    -- AUTENTICACAO
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
        current_status

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
        current_status in (
            'rejected',
            'completed'
        )
    then

        raise exception
            'Quote status does not allow purchase approval';

    end if;


    -- =======================================================
    -- CONTAR PECAS
    -- =======================================================

    select
        count(*)

    into
        total_items

    from
        public.quote_items

    where
        organization_id =
            target_org_id

        and
        quote_id =
            target_quote_id;


    if
        total_items = 0
    then

        raise exception
            'Quote has no purchase items';

    end if;


    -- =======================================================
    -- TODAS PRECISAM TER FORNECEDOR ESCOLHIDO
    -- =======================================================

    select
        count(*)

    into
        pending_items

    from
        public.quote_items

    where
        organization_id =
            target_org_id

        and
        quote_id =
            target_quote_id

        and
        (
            supplier_id is null
            or
            chosen_amount is null
        );


    if
        pending_items > 0
    then

        raise exception
            'All quote items need a selected supplier';

    end if;


    -- =======================================================
    -- APROVAR ITENS
    -- =======================================================

    update
        public.quote_items

    set
        purchase_status =
            'approved'

    where
        organization_id =
            target_org_id

        and
        quote_id =
            target_quote_id;


    -- =======================================================
    -- FORNECEDORES VENCEDORES
    -- =======================================================

    update
        public.quote_supplier_requests
            as request

    set
        winner =
            exists (

                select 1

                from
                    public.quote_supplier_item_responses
                        as response

                where
                    response.organization_id =
                        target_org_id

                    and
                    response.request_id =
                        request.id

                    and
                    response.awarded =
                        true

            )

    where
        request.organization_id =
            target_org_id

        and
        request.quote_id =
            target_quote_id;


    -- =======================================================
    -- GANHOU / PERDEU
    -- =======================================================

    update
        public.quote_supplier_requests

    set
        status =
            case

                when winner =
                    true
                then
                    'won'

                when status in (
                    'responded',
                    'won',
                    'lost'
                )
                then
                    'lost'

                else
                    status

            end

    where
        organization_id =
            target_org_id

        and
        quote_id =
            target_quote_id;


    -- =======================================================
    -- ORCAMENTO
    -- =======================================================

    update
        public.quotes

    set
        status =
            'awaiting_parts'

    where
        id =
            target_quote_id

        and
        organization_id =
            target_org_id;


    return
        total_items;

end;
$$;


revoke all
on function
public.finalize_quote_supplier_awards(
    uuid,
    uuid
)
from public,
anon;


grant execute
on function
public.finalize_quote_supplier_awards(
    uuid,
    uuid
)
to authenticated;


notify pgrst, 'reload schema';