-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 1.5C
--
-- LINKS PUBLICOS + APROVACAO DIGITAL
-- ===========================================================


create table if not exists
public.quote_public_links (

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

    token text
        not null
        unique,

    expires_at timestamptz
        not null
        default (
            now() +
            interval '7 days'
        ),

    revoked_at timestamptz,

    last_viewed_at timestamptz,

    created_by uuid
        references auth.users(id)
        on delete set null,

    created_at timestamptz
        not null
        default now()
);


create index if not exists
quote_public_links_quote_idx
on public.quote_public_links (
    organization_id,
    quote_id
);


create index if not exists
quote_public_links_token_idx
on public.quote_public_links (
    token
);


alter table
public.quote_public_links
enable row level security;


-- ===========================================================
-- NENHUMA LEITURA DIRETA PUBLICA
-- ===========================================================

revoke all
on table
public.quote_public_links
from anon,
authenticated;


-- ===========================================================
-- CRIAR / REGENERAR LINK
-- ===========================================================

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
            'Commercial quote must be ready before sharing';

    end if;


    if
        current_final is null
    then

        raise exception
            'Commercial quote has no final amount';

    end if;


    -- Revoga links anteriores ativos.

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


    -- 2 UUIDs sem hifen = 64 caracteres hexadecimais.

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


-- ===========================================================
-- REVOGAR LINK
-- ===========================================================

create or replace function
public.revoke_quote_public_link(

    target_org_id uuid,

    target_quote_id uuid
)
returns void
language plpgsql
security definer
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

end;
$$;


revoke all
on function
public.revoke_quote_public_link(
    uuid,
    uuid
)
from public,
anon;


grant execute
on function
public.revoke_quote_public_link(
    uuid,
    uuid
)
to authenticated;


-- ===========================================================
-- BUSCAR ORCAMENTO PUBLICO
--
-- SOMENTE DADOS QUE O CLIENTE PODE VER.
-- ===========================================================

create or replace function
public.public_get_quote(

    target_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare

    link_record record;

    services_json jsonb;

    items_json jsonb;

begin

    if
        target_token is null
        or
        char_length(
            btrim(
                target_token
            )
        ) <
        32
    then

        return null;

    end if;


    select

        link_row.id
            as link_id,

        link_row.quote_id,

        link_row.organization_id,

        link_row.expires_at,

        quote_row.protocol,

        quote_row.commercial_status,

        quote_row.mileage,

        quote_row.subtotal_amount,

        quote_row.discount_amount,

        quote_row.final_amount,

        quote_row.created_at,

        organization_row.name
            as organization_name,

        customer_row.name
            as customer_name,

        vehicle_row.plate,

        vehicle_row.brand,

        vehicle_row.model,

        vehicle_row.version,

        vehicle_row.model_year

    into
        link_record

    from
        public.quote_public_links
            as link_row

    join
        public.quotes
            as quote_row

        on
            quote_row.id =
                link_row.quote_id

        and
            quote_row.organization_id =
                link_row.organization_id

    join
        public.organizations
            as organization_row

        on
            organization_row.id =
                link_row.organization_id

    join
        public.customers
            as customer_row

        on
            customer_row.id =
                quote_row.customer_id

        and
            customer_row.organization_id =
                link_row.organization_id

    join
        public.vehicles
            as vehicle_row

        on
            vehicle_row.id =
                quote_row.vehicle_id

        and
            vehicle_row.organization_id =
                link_row.organization_id

    where
        link_row.token =
            btrim(
                target_token
            )

        and
        link_row.revoked_at is null

        and
        link_row.expires_at >
            now();


    if not found then

        return null;

    end if;


    update
        public.quote_public_links

    set
        last_viewed_at =
            now()

    where
        id =
            link_record.link_id;


    select
        coalesce(
            jsonb_agg(
                jsonb_build_object(

                    'id',
                    service_row.id,

                    'category',
                    service_row.category,

                    'description',
                    service_row.description,

                    'amount',
                    coalesce(
                        service_row.labor_amount,
                        0
                    )

                )
                order by
                    service_row.created_at
            ),
            '[]'::jsonb
        )

    into
        services_json

    from
        public.quote_services
            as service_row

    where
        service_row.organization_id =
            link_record.organization_id

        and
        service_row.quote_id =
            link_record.quote_id;


    select
        coalesce(
            jsonb_agg(
                jsonb_build_object(

                    'id',
                    item_row.id,

                    'category',
                    item_row.category,

                    'description',
                    item_row.description,

                    'quantity',
                    item_row.quantity,

                    'unit',
                    item_row.unit,

                    'side',
                    item_row.side,

                    'specification',
                    item_row.specification,

                    'sale_unit_amount',
                    coalesce(
                        item_row.sale_unit_amount,
                        0
                    ),

                    'sale_total_amount',
                    coalesce(
                        item_row.sale_total_amount,
                        0
                    )

                )
                order by
                    item_row.created_at
            ),
            '[]'::jsonb
        )

    into
        items_json

    from
        public.quote_items
            as item_row

    where
        item_row.organization_id =
            link_record.organization_id

        and
        item_row.quote_id =
            link_record.quote_id;


    return
        jsonb_build_object(

            'protocol',
            link_record.protocol,

            'organization_name',
            link_record.organization_name,

            'customer_name',
            link_record.customer_name,

            'plate',
            link_record.plate,

            'brand',
            link_record.brand,

            'model',
            link_record.model,

            'version',
            link_record.version,

            'model_year',
            link_record.model_year,

            'mileage',
            link_record.mileage,

            'commercial_status',
            link_record.commercial_status,

            'subtotal_amount',
            coalesce(
                link_record.subtotal_amount,
                0
            ),

            'discount_amount',
            coalesce(
                link_record.discount_amount,
                0
            ),

            'final_amount',
            coalesce(
                link_record.final_amount,
                0
            ),

            'created_at',
            link_record.created_at,

            'expires_at',
            link_record.expires_at,

            'services',
            services_json,

            'items',
            items_json

        );

end;
$$;


revoke all
on function
public.public_get_quote(
    text
)
from public;


grant execute
on function
public.public_get_quote(
    text
)
to anon,
authenticated;


-- ===========================================================
-- DECISAO PUBLICA
-- ===========================================================

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

    incomplete_supplier_items integer;

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
            'Invalid decision';

    end if;


    select

        link_row.quote_id,

        link_row.organization_id

    into
        target_quote_id,

        target_org_id

    from
        public.quote_public_links
            as link_row

    where
        link_row.token =
            btrim(
                target_token
            )

        and
        link_row.revoked_at is null

        and
        link_row.expires_at >
            now();


    if
        target_quote_id is null
    then

        raise exception
            'Public quote link is invalid or expired';

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
            'Quote not found';

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
            'Quote is no longer awaiting customer decision';

    end if;


    -- =======================================================
    -- APROVADO
    -- =======================================================

    if
        normalized_decision =
            'approved'
    then

        select

            count(*),

            count(*) filter (
                where
                    supplier_id is null
                    or
                    chosen_amount is null
                    or
                    sale_unit_amount is null
                    or
                    sale_total_amount is null
            )

        into
            items_count,
            incomplete_supplier_items

        from
            public.quote_items

        where
            organization_id =
                target_org_id

            and
            quote_id =
                target_quote_id;


        if
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
            jsonb_build_object(

                'decision',
                'approved',

                'workflow_status',
                next_status

            );

    end if;


    -- =======================================================
    -- REPROVADO
    -- =======================================================

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

end;
$$;


revoke all
on function
public.public_decide_quote(
    text,
    text,
    text
)
from public;


grant execute
on function
public.public_decide_quote(
    text,
    text,
    text
)
to anon,
authenticated;


notify pgrst, 'reload schema';