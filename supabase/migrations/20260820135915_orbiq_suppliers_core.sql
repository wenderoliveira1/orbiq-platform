-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 1.2A
-- FORNECEDORES + CATEGORIAS
-- ===========================================================


-- ===========================================================
-- ESTRUTURA
-- ===========================================================

create table if not exists public.supplier_categories (

    id uuid
        primary key
        default gen_random_uuid(),

    organization_id uuid
        not null
        references public.organizations(id)
        on delete cascade,

    name text
        not null,

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


create table if not exists public.suppliers (

    id uuid
        primary key
        default gen_random_uuid(),

    organization_id uuid
        not null
        references public.organizations(id)
        on delete cascade,

    name text
        not null,

    whatsapp text,

    active boolean
        not null
        default true,

    notes text,

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now()
);


create table if not exists public.supplier_category_links (

    organization_id uuid
        references public.organizations(id)
        on delete cascade,

    supplier_id uuid
        not null
        references public.suppliers(id)
        on delete cascade,

    category_id uuid
        not null
        references public.supplier_categories(id)
        on delete cascade,

    created_at timestamptz
        not null
        default now()
);


-- ===========================================================
-- NORMALIZAR TABELAS JA EXISTENTES
-- ===========================================================

alter table public.supplier_categories
    add column if not exists organization_id uuid
    references public.organizations(id)
    on delete cascade;


alter table public.supplier_categories
    add column if not exists name text;


alter table public.supplier_categories
    add column if not exists active boolean
    default true;


alter table public.supplier_categories
    add column if not exists created_at timestamptz
    default now();


alter table public.supplier_categories
    add column if not exists updated_at timestamptz
    default now();


alter table public.suppliers
    add column if not exists organization_id uuid
    references public.organizations(id)
    on delete cascade;


alter table public.suppliers
    add column if not exists name text;


alter table public.suppliers
    add column if not exists whatsapp text;


alter table public.suppliers
    add column if not exists active boolean
    default true;


alter table public.suppliers
    add column if not exists notes text;


alter table public.suppliers
    add column if not exists created_at timestamptz
    default now();


alter table public.suppliers
    add column if not exists updated_at timestamptz
    default now();


alter table public.supplier_category_links
    add column if not exists organization_id uuid
    references public.organizations(id)
    on delete cascade;


alter table public.supplier_category_links
    add column if not exists supplier_id uuid
    references public.suppliers(id)
    on delete cascade;


alter table public.supplier_category_links
    add column if not exists category_id uuid
    references public.supplier_categories(id)
    on delete cascade;


alter table public.supplier_category_links
    add column if not exists created_at timestamptz
    default now();


-- ===========================================================
-- BACKFILL DOS LINKS ANTIGOS
-- ===========================================================

update public.supplier_category_links as links

set organization_id =
    suppliers.organization_id

from public.suppliers as suppliers

where
    links.supplier_id =
        suppliers.id

    and
    links.organization_id
        is null;


-- ===========================================================
-- INDICES
-- ===========================================================

create index if not exists
supplier_categories_org_idx
on public.supplier_categories (
    organization_id,
    name
);


create index if not exists
suppliers_org_idx
on public.suppliers (
    organization_id,
    name
);


create index if not exists
suppliers_org_active_idx
on public.suppliers (
    organization_id,
    active
);


create index if not exists
supplier_links_supplier_idx
on public.supplier_category_links (
    supplier_id
);


create index if not exists
supplier_links_category_idx
on public.supplier_category_links (
    category_id
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
orbiq_supplier_categories_updated_at
on public.supplier_categories;


create trigger
orbiq_supplier_categories_updated_at
before update
on public.supplier_categories
for each row
execute function
public.orbiq_set_updated_at();


drop trigger if exists
orbiq_suppliers_updated_at
on public.suppliers;


create trigger
orbiq_suppliers_updated_at
before update
on public.suppliers
for each row
execute function
public.orbiq_set_updated_at();


-- ===========================================================
-- RLS
-- ===========================================================

alter table public.supplier_categories
enable row level security;


alter table public.suppliers
enable row level security;


alter table public.supplier_category_links
enable row level security;


drop policy if exists
orbiq_supplier_categories_member_all
on public.supplier_categories;


create policy
orbiq_supplier_categories_member_all
on public.supplier_categories
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


drop policy if exists
orbiq_suppliers_member_all
on public.suppliers;


create policy
orbiq_suppliers_member_all
on public.suppliers
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


drop policy if exists
orbiq_supplier_links_member_all
on public.supplier_category_links;


create policy
orbiq_supplier_links_member_all
on public.supplier_category_links
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
-- GRANTS
-- ===========================================================

grant
    select,
    insert,
    update,
    delete
on table public.supplier_categories
to authenticated;


grant
    select,
    insert,
    update,
    delete
on table public.suppliers
to authenticated;


grant
    select,
    insert,
    update,
    delete
on table public.supplier_category_links
to authenticated;


-- ===========================================================
-- CATEGORIAS PADRAO
-- ===========================================================

insert into public.supplier_categories (
    organization_id,
    name,
    active
)

select
    organizations.id,
    defaults.name,
    true

from public.organizations as organizations

cross join (

    values

        ('Mecânica'),

        ('Chassi - Paralelo/Original'),

        ('Chassi - Ferro Velho'),

        ('Pneus'),

        ('Vidros'),

        ('Óleos e Lubrificantes'),

        ('Outros')

) as defaults(name)

where not exists (

    select 1

    from public.supplier_categories
        as categories

    where
        categories.organization_id =
            organizations.id

        and lower(
            btrim(
                categories.name
            )
        ) =
        lower(
            btrim(
                defaults.name
            )
        )
);


-- ===========================================================
-- CATEGORIAS PARA NOVAS OFICINAS
-- ===========================================================

create or replace function
public.orbiq_seed_supplier_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

    insert into public.supplier_categories (
        organization_id,
        name,
        active
    )
    values

        (
            new.id,
            'Mecânica',
            true
        ),

        (
            new.id,
            'Chassi - Paralelo/Original',
            true
        ),

        (
            new.id,
            'Chassi - Ferro Velho',
            true
        ),

        (
            new.id,
            'Pneus',
            true
        ),

        (
            new.id,
            'Vidros',
            true
        ),

        (
            new.id,
            'Óleos e Lubrificantes',
            true
        ),

        (
            new.id,
            'Outros',
            true
        );

    return new;

end;
$$;


revoke all
on function
public.orbiq_seed_supplier_categories()
from public,
anon,
authenticated;


drop trigger if exists
orbiq_seed_supplier_categories_trigger
on public.organizations;


create trigger
orbiq_seed_supplier_categories_trigger
after insert
on public.organizations
for each row
execute function
public.orbiq_seed_supplier_categories();


-- ===========================================================
-- SALVAR FORNECEDOR
-- ===========================================================

create or replace function
public.save_supplier(

    target_org_id uuid,

    target_supplier_id uuid,

    target_name text,

    target_whatsapp text,

    target_notes text,

    target_category_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare

    supplier_uuid uuid;

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


    if nullif(
        btrim(
            coalesce(
                target_name,
                ''
            )
        ),
        ''
    ) is null then

        raise exception
            'Supplier name is required';

    end if;


    if
        target_category_ids is null
        or cardinality(
            target_category_ids
        ) = 0
    then

        raise exception
            'At least one supplier category is required';

    end if;


    if exists (

        select 1

        from unnest(
            target_category_ids
        ) as requested_category(id)

        left join
            public.supplier_categories
                as category

            on
                category.id =
                    requested_category.id

                and
                category.organization_id =
                    target_org_id

        where
            category.id is null

    ) then

        raise exception
            'Invalid supplier category';

    end if;


    if target_supplier_id is null then

        insert into public.suppliers (

            organization_id,

            name,

            whatsapp,

            notes,

            active

        )
        values (

            target_org_id,

            btrim(
                target_name
            ),

            nullif(
                btrim(
                    coalesce(
                        target_whatsapp,
                        ''
                    )
                ),
                ''
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
        returning id
        into supplier_uuid;

    else

        update public.suppliers

        set
            name =
                btrim(
                    target_name
                ),

            whatsapp =
                nullif(
                    btrim(
                        coalesce(
                            target_whatsapp,
                            ''
                        )
                    ),
                    ''
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
                target_supplier_id

            and
            organization_id =
                target_org_id

        returning id
        into supplier_uuid;


        if supplier_uuid is null then

            raise exception
                'Supplier not found';

        end if;

    end if;


    delete from
        public.supplier_category_links

    where
        organization_id =
            target_org_id

        and
        supplier_id =
            supplier_uuid;


    insert into
        public.supplier_category_links (

            organization_id,

            supplier_id,

            category_id

        )

    select distinct
        target_org_id,

        supplier_uuid,

        requested_category_id

    from unnest(
        target_category_ids
    ) as requested_category_id;


    return supplier_uuid;

end;
$$;


revoke all
on function public.save_supplier(
    uuid,
    uuid,
    text,
    text,
    text,
    uuid[]
)
from public,
anon;


grant execute
on function public.save_supplier(
    uuid,
    uuid,
    text,
    text,
    text,
    uuid[]
)
to authenticated;


-- ===========================================================
-- ATIVAR / DESATIVAR
-- ===========================================================

create or replace function
public.set_supplier_active(

    target_org_id uuid,

    target_supplier_id uuid,

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


    update public.suppliers

    set active =
        target_active

    where
        id =
            target_supplier_id

        and
        organization_id =
            target_org_id;


    if not found then

        raise exception
            'Supplier not found';

    end if;

end;
$$;


revoke all
on function public.set_supplier_active(
    uuid,
    uuid,
    boolean
)
from public,
anon;


grant execute
on function public.set_supplier_active(
    uuid,
    uuid,
    boolean
)
to authenticated;


notify pgrst, 'reload schema';