-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 1.4C
--
-- NOVO ORCAMENTO + MAO DE OBRA
--
-- CREATE_QUOTE ORIGINAL E PRESERVADO.
-- ===========================================================


create or replace function
public.create_quote_v2(

    target_org_id uuid,

    target_customer_id uuid,

    target_vehicle_id uuid,

    target_priority text,

    target_mileage integer,

    target_notes text,

    services jsonb,

    items jsonb
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

    service_entry jsonb;

    item_entry jsonb;

    service_description text;

    service_category text;

    service_needs_part boolean;

    service_labor_id uuid;

    service_labor_amount numeric;

    catalog_description text;

    catalog_category text;

    catalog_amount numeric;

    item_description text;

    item_category text;

    item_quantity numeric;

    item_unit text;

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
    -- PRIORIDADE
    -- =======================================================

    if
        target_priority not in (
            'normal',
            'customer_waiting',
            'vehicle_stopped'
        )
    then

        raise exception
            'Invalid quote priority';

    end if;


    -- =======================================================
    -- KM
    -- =======================================================

    if
        target_mileage is not null
        and
        target_mileage < 0
    then

        raise exception
            'Invalid mileage';

    end if;


    -- =======================================================
    -- CLIENTE
    -- =======================================================

    if not exists (

        select 1

        from
            public.customers

        where
            id =
                target_customer_id

            and
            organization_id =
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

        from
            public.vehicles

        where
            id =
                target_vehicle_id

            and
            organization_id =
                target_org_id

            and
            customer_id =
                target_customer_id

    ) then

        raise exception
            'Vehicle does not belong to selected customer';

    end if;


    -- =======================================================
    -- SERVICOS
    -- =======================================================

    if
        services is null
        or
        jsonb_typeof(
            services
        ) <>
        'array'
        or
        jsonb_array_length(
            services
        ) =
        0
    then

        raise exception
            'At least one service is required';

    end if;


    -- =======================================================
    -- ITEMS
    -- =======================================================

    if
        items is null
        or
        jsonb_typeof(
            items
        ) <>
        'array'
    then

        raise exception
            'Items must be a JSON array';

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

    insert into
        public.quotes (

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

    returning
        id

    into
        new_quote_id;


    -- =======================================================
    -- SERVICOS
    -- =======================================================

    for service_entry in

        select value

        from
            jsonb_array_elements(
                services
            )

    loop

        service_description :=
            btrim(
                coalesce(
                    service_entry ->>
                    'description',
                    ''
                )
            );


        service_category :=
            nullif(
                btrim(
                    coalesce(
                        service_entry ->>
                        'category',
                        ''
                    )
                ),
                ''
            );


        service_needs_part :=
            coalesce(
                (
                    service_entry ->>
                    'needs_part'
                )::boolean,
                false
            );


        service_labor_id :=
            null;


        if
            nullif(
                btrim(
                    coalesce(
                        service_entry ->>
                        'labor_service_id',
                        ''
                    )
                ),
                ''
            )
            is not null
        then

            service_labor_id :=
                (
                    service_entry ->>
                    'labor_service_id'
                )::uuid;

        end if;


        -- ===================================================
        -- CATALOGO DE MAO DE OBRA
        --
        -- Se veio ID de catalogo:
        -- descricao/categoria/valor sao lidos DO BANCO.
        --
        -- O navegador nao define o preco.
        -- ===================================================

        if
            service_labor_id is not null
        then

            catalog_description :=
                null;

            catalog_category :=
                null;

            catalog_amount :=
                null;


            select
                labor.description,
                labor.category,
                labor.amount

            into
                catalog_description,
                catalog_category,
                catalog_amount

            from
                public.labor_services
                    as labor

            where
                labor.id =
                    service_labor_id

                and
                labor.organization_id =
                    target_org_id

                and
                labor.active =
                    true;


            if
                catalog_description is null
            then

                raise exception
                    'Labor service not found or inactive';

            end if;


            service_description :=
                catalog_description;


            service_category :=
                coalesce(
                    nullif(
                        btrim(
                            coalesce(
                                catalog_category,
                                ''
                            )
                        ),
                        ''
                    ),
                    'Outros'
                );


            service_labor_amount :=
                catalog_amount;

        else

            -- =================================================
            -- SERVICO MANUAL
            -- =================================================

            if
                char_length(
                    service_description
                ) <
                2
            then

                raise exception
                    'Service description is required';

            end if;


            service_category :=
                coalesce(
                    service_category,
                    'Outros'
                );


            service_labor_amount :=
                coalesce(
                    (
                        service_entry ->>
                        'labor_amount'
                    )::numeric,
                    0
                );


            if
                service_labor_amount <
                0
            then

                raise exception
                    'Invalid labor amount';

            end if;

        end if;


        insert into
            public.quote_services (

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

            service_labor_id,

            service_category,

            service_description,

            service_needs_part,

            round(
                service_labor_amount,
                2
            )

        );

    end loop;


    -- =======================================================
    -- PECAS / ITEMS
    -- =======================================================

    for item_entry in

        select value

        from
            jsonb_array_elements(
                items
            )

    loop

        item_description :=
            btrim(
                coalesce(
                    item_entry ->>
                    'description',
                    ''
                )
            );


        item_category :=
            coalesce(
                nullif(
                    btrim(
                        coalesce(
                            item_entry ->>
                            'category',
                            ''
                        )
                    ),
                    ''
                ),
                'Outros'
            );


        item_quantity :=
            coalesce(
                (
                    item_entry ->>
                    'quantity'
                )::numeric,
                1
            );


        item_unit :=
            coalesce(
                nullif(
                    btrim(
                        coalesce(
                            item_entry ->>
                            'unit',
                            ''
                        )
                    ),
                    ''
                ),
                'un'
            );


        if
            char_length(
                item_description
            ) <
            2
        then

            raise exception
                'Purchase item description is required';

        end if;


        if
            item_quantity <=
            0
        then

            raise exception
                'Purchase item quantity must be greater than zero';

        end if;


        insert into
            public.quote_items (

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

            nullif(
                btrim(
                    coalesce(
                        item_entry ->>
                        'side',
                        ''
                    )
                ),
                ''
            ),

            nullif(
                btrim(
                    coalesce(
                        item_entry ->>
                        'specification',
                        ''
                    )
                ),
                ''
            ),

            nullif(
                btrim(
                    coalesce(
                        item_entry ->>
                        'notes',
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

    quote_id :=
        new_quote_id;


    protocol :=
        new_protocol;


    return next;

end;
$$;


revoke all
on function
public.create_quote_v2(
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
on function
public.create_quote_v2(
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