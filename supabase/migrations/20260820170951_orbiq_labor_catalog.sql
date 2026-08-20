-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 1.4A
--
-- CATALOGO DE MAO DE OBRA
--
-- IMPORTANTE:
-- NENHUM SERVICO E INSERIDO AUTOMATICAMENTE.
-- ===========================================================


-- ===========================================================
-- CATALOGO
-- ===========================================================

create table if not exists
public.labor_services (

    id uuid
        primary key
        default gen_random_uuid(),

    organization_id uuid
        not null
        references public.organizations(id)
        on delete cascade,

    description text
        not null,

    category text,

    amount numeric(12,2)
        not null
        default 0
        check (
            amount >= 0
        ),

    notes text,

    active boolean
        not null
        default true,

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now()
);


-- ===========================================================
-- VINCULO FUTURO COM SERVICO DO ORCAMENTO
-- ===========================================================

alter table
public.quote_services

add column if not exists
labor_service_id uuid
references public.labor_services(id)
on delete set null;


-- ===========================================================
-- INDICES
-- ===========================================================

create index if not exists
labor_services_org_idx
on public.labor_services (
    organization_id
);


create index if not exists
labor_services_org_active_idx
on public.labor_services (
    organization_id,
    active
);


create index if not exists
quote_services_labor_service_idx
on public.quote_services (
    labor_service_id
);


-- ===========================================================
-- EVITAR DUPLICADO NA MESMA CATEGORIA
-- ===========================================================

create unique index if not exists
labor_services_unique_description_category
on public.labor_services (

    organization_id,

    lower(
        btrim(
            coalesce(
                category,
                ''
            )
        )
    ),

    lower(
        btrim(
            description
        )
    )
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
orbiq_labor_services_updated_at
on public.labor_services;


create trigger
orbiq_labor_services_updated_at
before update
on public.labor_services
for each row
execute function
public.orbiq_set_updated_at();


-- ===========================================================
-- RLS
-- ===========================================================

alter table
public.labor_services
enable row level security;


drop policy if exists
orbiq_labor_services_member_all
on public.labor_services;


create policy
orbiq_labor_services_member_all
on public.labor_services
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
public.labor_services
to authenticated;


-- ===========================================================
-- SALVAR MAO DE OBRA
-- ===========================================================

create or replace function
public.save_labor_service(

    target_org_id uuid,

    target_service_id uuid,

    target_description text,

    target_category text,

    target_amount numeric,

    target_notes text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare

    service_uuid uuid;

    normalized_description text;

    normalized_category text;

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
    -- VALIDACAO
    -- =======================================================

    normalized_description :=
        btrim(
            coalesce(
                target_description,
                ''
            )
        );


    normalized_category :=
        nullif(
            btrim(
                coalesce(
                    target_category,
                    ''
                )
            ),
            ''
        );


    if
        char_length(
            normalized_description
        ) < 2
    then

        raise exception
            'Labor service description is required';

    end if;


    if
        target_amount is null
        or
        target_amount < 0
    then

        raise exception
            'Invalid labor amount';

    end if;


    -- =======================================================
    -- DUPLICADO
    -- =======================================================

    if exists (

        select 1

        from
            public.labor_services
                as labor

        where
            labor.organization_id =
                target_org_id

            and
            lower(
                btrim(
                    labor.description
                )
            ) =
            lower(
                normalized_description
            )

            and
            lower(
                btrim(
                    coalesce(
                        labor.category,
                        ''
                    )
                )
            ) =
            lower(
                btrim(
                    coalesce(
                        normalized_category,
                        ''
                    )
                )
            )

            and
            (
                target_service_id is null
                or
                labor.id <>
                    target_service_id
            )

    ) then

        raise exception
            'Labor service already exists';

    end if;


    -- =======================================================
    -- CRIAR
    -- =======================================================

    if
        target_service_id is null
    then

        insert into
            public.labor_services (

                organization_id,

                description,

                category,

                amount,

                notes,

                active

            )
        values (

            target_org_id,

            normalized_description,

            normalized_category,

            round(
                target_amount,
                2
            ),

            nullif(
                btrim(
                    coalesce(
                        target_notes,
                        ''
                    )
                ),
                ''
            ),

            true

        )

        returning
            id

        into
            service_uuid;


    -- =======================================================
    -- EDITAR
    -- =======================================================

    else

        update
            public.labor_services

        set
            description =
                normalized_description,

            category =
                normalized_category,

            amount =
                round(
                    target_amount,
                    2
                ),

            notes =
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
                target_service_id

            and
            organization_id =
                target_org_id

        returning
            id

        into
            service_uuid;


        if
            service_uuid is null
        then

            raise exception
                'Labor service not found';

        end if;

    end if;


    return
        service_uuid;

end;
$$;


revoke all
on function
public.save_labor_service(
    uuid,
    uuid,
    text,
    text,
    numeric,
    text
)
from public,
anon;


grant execute
on function
public.save_labor_service(
    uuid,
    uuid,
    text,
    text,
    numeric,
    text
)
to authenticated;


-- ===========================================================
-- ATIVAR / DESATIVAR
-- ===========================================================

create or replace function
public.set_labor_service_active(

    target_org_id uuid,

    target_service_id uuid,

    target_active boolean
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


    update
        public.labor_services

    set
        active =
            target_active

    where
        id =
            target_service_id

        and
        organization_id =
            target_org_id;


    if not found then

        raise exception
            'Labor service not found';

    end if;

end;
$$;


revoke all
on function
public.set_labor_service_active(
    uuid,
    uuid,
    boolean
)
from public,
anon;


grant execute
on function
public.set_labor_service_active(
    uuid,
    uuid,
    boolean
)
to authenticated;


notify pgrst, 'reload schema';