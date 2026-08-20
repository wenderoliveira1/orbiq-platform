-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 1.2B
--
-- COTACOES DE FORNECEDORES
-- ===========================================================


-- ===========================================================
-- SOLICITACAO DE COTACAO POR FORNECEDOR
-- ===========================================================

create table if not exists
public.quote_supplier_requests (

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

    message text
        not null,

    status text
        not null
        default 'prepared'
        check (
            status in (
                'prepared',
                'opened',
                'responded',
                'won',
                'lost',
                'cancelled'
            )
        ),

    opened_at timestamptz,

    responded_at timestamptz,

    response_amount numeric(12,2)
        check (
            response_amount is null
            or response_amount >= 0
        ),

    response_delivery text,

    response_notes text,

    winner boolean
        not null
        default false,

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
    )
);


-- ===========================================================
-- ITENS ENVIADOS PARA CADA FORNECEDOR
-- ===========================================================

create table if not exists
public.quote_supplier_request_items (

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

    created_at timestamptz
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
quote_supplier_requests_quote_idx
on public.quote_supplier_requests (
    organization_id,
    quote_id
);


create index if not exists
quote_supplier_requests_supplier_idx
on public.quote_supplier_requests (
    organization_id,
    supplier_id
);


create index if not exists
quote_supplier_requests_status_idx
on public.quote_supplier_requests (
    organization_id,
    status
);


create index if not exists
quote_supplier_request_items_request_idx
on public.quote_supplier_request_items (
    request_id
);


create index if not exists
quote_supplier_request_items_item_idx
on public.quote_supplier_request_items (
    quote_item_id
);


-- ===========================================================
-- UPDATED_AT
-- ===========================================================

drop trigger if exists
orbiq_quote_supplier_requests_updated_at
on public.quote_supplier_requests;


create trigger
orbiq_quote_supplier_requests_updated_at
before update
on public.quote_supplier_requests
for each row
execute function
public.orbiq_set_updated_at();


-- ===========================================================
-- RLS
-- ===========================================================

alter table
public.quote_supplier_requests
enable row level security;


alter table
public.quote_supplier_request_items
enable row level security;


drop policy if exists
orbiq_quote_supplier_requests_member_all
on public.quote_supplier_requests;


create policy
orbiq_quote_supplier_requests_member_all
on public.quote_supplier_requests
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
orbiq_quote_supplier_request_items_member_all
on public.quote_supplier_request_items;


create policy
orbiq_quote_supplier_request_items_member_all
on public.quote_supplier_request_items
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
-- GRANTS DATA API
-- ===========================================================

grant
    select,
    insert,
    update,
    delete
on table
public.quote_supplier_requests
to authenticated;


grant
    select,
    insert,
    update,
    delete
on table
public.quote_supplier_request_items
to authenticated;


-- ===========================================================
-- PREPARAR COTACOES
--
-- Recebe um JSON assim:
--
-- [
--   {
--     "supplier_id": "...",
--     "message": "...",
--     "item_ids": ["...", "..."]
--   }
-- ]
--
-- Toda preparacao ocorre na mesma transacao.
-- ===========================================================

create or replace function
public.prepare_quote_supplier_requests(

    target_org_id uuid,

    target_quote_id uuid,

    target_requests jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare

    request_entry jsonb;

    supplier_uuid uuid;

    request_uuid uuid;

    item_ids jsonb;

    message_text text;

    prepared_count integer :=
        0;

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
    -- ORCAMENTO
    -- =======================================================

    if not exists (

        select 1

        from public.quotes

        where
            id =
                target_quote_id

            and
            organization_id =
                target_org_id

    ) then

        raise exception
            'Quote not found';

    end if;


    -- =======================================================
    -- PAYLOAD
    -- =======================================================

    if
        target_requests is null
        or
        jsonb_typeof(
            target_requests
        ) <> 'array'
        or
        jsonb_array_length(
            target_requests
        ) = 0
    then

        raise exception
            'At least one supplier request is required';

    end if;


    -- =======================================================
    -- CANCELAR PREPARACOES ANTIGAS QUE NAO ESTAO MAIS
    -- SELECIONADAS
    -- =======================================================

    update
        public.quote_supplier_requests
    set
        status =
            'cancelled'
    where
        organization_id =
            target_org_id

        and
        quote_id =
            target_quote_id

        and
        status in (
            'prepared',
            'opened'
        )

        and
        supplier_id not in (

            select
                (
                    value ->> 'supplier_id'
                )::uuid

            from
                jsonb_array_elements(
                    target_requests
                )

        );


    -- =======================================================
    -- PROCESSAR CADA FORNECEDOR
    -- =======================================================

    for request_entry in

        select value

        from jsonb_array_elements(
            target_requests
        )

    loop

        supplier_uuid :=
            (
                request_entry ->>
                'supplier_id'
            )::uuid;


        message_text :=
            btrim(
                coalesce(
                    request_entry ->>
                    'message',
                    ''
                )
            );


        item_ids :=
            request_entry ->
            'item_ids';


        -- ===================================================
        -- FORNECEDOR
        -- ===================================================

        if not exists (

            select 1

            from public.suppliers

            where
                id =
                    supplier_uuid

                and
                organization_id =
                    target_org_id

                and
                active =
                    true

        ) then

            raise exception
                'Invalid or inactive supplier';

        end if;


        -- ===================================================
        -- MENSAGEM
        -- ===================================================

        if
            message_text = ''
        then

            raise exception
                'Supplier message is required';

        end if;


        -- ===================================================
        -- ITENS
        -- ===================================================

        if
            item_ids is null
            or
            jsonb_typeof(
                item_ids
            ) <> 'array'
            or
            jsonb_array_length(
                item_ids
            ) = 0
        then

            raise exception
                'Supplier request needs at least one item';

        end if;


        -- ===================================================
        -- TODOS OS ITENS DEVEM PERTENCER AO ORCAMENTO
        -- ===================================================

        if exists (

            select 1

            from
                jsonb_array_elements_text(
                    item_ids
                )
                as requested_item(
                    item_id
                )

            left join
                public.quote_items
                    as quote_item

                on
                    quote_item.id =
                        requested_item.item_id::uuid

                    and
                    quote_item.organization_id =
                        target_org_id

                    and
                    quote_item.quote_id =
                        target_quote_id

            where
                quote_item.id
                    is null

        ) then

            raise exception
                'Invalid quote item';

        end if;


        -- ===================================================
        -- FORNECEDOR PRECISA ATENDER A CATEGORIA DO ITEM
        -- ===================================================

        if exists (

            select 1

            from
                jsonb_array_elements_text(
                    item_ids
                )
                as requested_item(
                    item_id
                )

            join
                public.quote_items
                    as quote_item

                on
                    quote_item.id =
                        requested_item.item_id::uuid

            where
                quote_item.organization_id =
                    target_org_id

                and
                quote_item.quote_id =
                    target_quote_id

                and not exists (

                    select 1

                    from
                        public.supplier_category_links
                            as supplier_link

                    join
                        public.supplier_categories
                            as supplier_category

                        on
                            supplier_category.id =
                                supplier_link.category_id

                    where
                        supplier_link.organization_id =
                            target_org_id

                        and
                        supplier_link.supplier_id =
                            supplier_uuid

                        and
                        supplier_category.organization_id =
                            target_org_id

                        and
                        supplier_category.active =
                            true

                        and
                        lower(
                            btrim(
                                supplier_category.name
                            )
                        ) =
                        lower(
                            btrim(
                                quote_item.category
                            )
                        )

                )

        ) then

            raise exception
                'Supplier does not serve one or more item categories';

        end if;


        -- ===================================================
        -- SOLICITACAO
        -- ===================================================

        insert into
            public.quote_supplier_requests (

                organization_id,

                quote_id,

                supplier_id,

                message,

                status,

                opened_at,

                winner

            )
        values (

            target_org_id,

            target_quote_id,

            supplier_uuid,

            message_text,

            'prepared',

            null,

            false

        )

        on conflict (
            organization_id,
            quote_id,
            supplier_id
        )
        do update
        set

            message =
                excluded.message,

            status =
                'prepared',

            opened_at =
                null,

            winner =
                false

        returning id
        into request_uuid;


        -- ===================================================
        -- RECRIAR ITENS DA SOLICITACAO
        -- ===================================================

        delete from
            public.quote_supplier_request_items

        where
            organization_id =
                target_org_id

            and
            request_id =
                request_uuid;


        insert into
            public.quote_supplier_request_items (

                organization_id,

                request_id,

                quote_item_id

            )

        select distinct

            target_org_id,

            request_uuid,

            requested_item.item_id::uuid

        from
            jsonb_array_elements_text(
                item_ids
            )
            as requested_item(
                item_id
            );


        prepared_count :=
            prepared_count +
            1;

    end loop;


    -- =======================================================
    -- ORCAMENTO PASSA PARA AGUARDANDO COTACAO
    -- =======================================================

    update
        public.quotes

    set
        status =
            'awaiting_quote'

    where
        id =
            target_quote_id

        and
        organization_id =
            target_org_id

        and
        status not in (
            'approved',
            'rejected',
            'completed'
        );


    return
        prepared_count;

end;
$$;


revoke all
on function
public.prepare_quote_supplier_requests(
    uuid,
    uuid,
    jsonb
)
from public,
anon;


grant execute
on function
public.prepare_quote_supplier_requests(
    uuid,
    uuid,
    jsonb
)
to authenticated;


notify pgrst, 'reload schema';