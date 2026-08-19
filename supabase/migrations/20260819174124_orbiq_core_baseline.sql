create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 2),
  slug text not null unique,
  cnpj text,
  plan text not null default 'internal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_slug_format
    check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer'
    check (role in ('owner','admin','manager','estimator','technician','viewer')),
  status text not null default 'active'
    check (status in ('active','invited','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_members_user_idx
  on public.organization_members(user_id, status);

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create or replace function public.has_org_role(target_org_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any(allowed_roles)
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.create_organization(
  organization_name text,
  organization_slug text,
  organization_cnpj text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_org_id uuid;
  clean_name text := trim(organization_name);
  clean_slug text := lower(trim(organization_slug));
  clean_cnpj text := nullif(trim(coalesce(organization_cnpj, '')), '');
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if char_length(clean_name) < 2 then
    raise exception 'Organization name is required';
  end if;

  if clean_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Invalid organization slug';
  end if;

  insert into public.organizations (name, slug, cnpj)
  values (clean_name, clean_slug, clean_cnpj)
  returning id into new_org_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    status
  )
  values (
    new_org_id,
    current_user_id,
    'owner',
    'active'
  );

  return new_org_id;
end;
$$;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) >= 2),
  phone text,
  email text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_org_name_idx
  on public.customers(organization_id, name);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  plate text not null,
  brand text,
  model text not null,
  version text,
  model_year smallint,
  mileage integer check (mileage is null or mileage >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, plate)
);

create index vehicles_org_customer_idx
  on public.vehicles(organization_id, customer_id);

create table public.supplier_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  whatsapp text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index suppliers_org_active_idx
  on public.suppliers(organization_id, active);

create table public.supplier_category_links (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  category_id uuid not null references public.supplier_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (supplier_id, category_id)
);

create table public.labor_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index labor_items_org_active_idx
  on public.labor_items(organization_id, active);

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger organization_members_set_updated_at
before update on public.organization_members
for each row execute function public.set_updated_at();

create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create trigger vehicles_set_updated_at
before update on public.vehicles
for each row execute function public.set_updated_at();

create trigger suppliers_set_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

create trigger labor_items_set_updated_at
before update on public.labor_items
for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.customers enable row level security;
alter table public.vehicles enable row level security;
alter table public.supplier_categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.supplier_category_links enable row level security;
alter table public.labor_items enable row level security;

create policy organizations_select_member
on public.organizations
for select
to authenticated
using ((select public.is_org_member(id)));

create policy organizations_update_admin
on public.organizations
for update
to authenticated
using ((select public.has_org_role(id, array['owner','admin']::text[])))
with check ((select public.has_org_role(id, array['owner','admin']::text[])));

create policy profiles_select_self
on public.profiles
for select
to authenticated
using (user_id = (select auth.uid()));

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy members_select_org
on public.organization_members
for select
to authenticated
using ((select public.is_org_member(organization_id)));

create policy members_insert_admin
on public.organization_members
for insert
to authenticated
with check ((select public.has_org_role(organization_id, array['owner','admin']::text[])));

create policy members_update_admin
on public.organization_members
for update
to authenticated
using ((select public.has_org_role(organization_id, array['owner','admin']::text[])))
with check ((select public.has_org_role(organization_id, array['owner','admin']::text[])));

create policy members_delete_admin
on public.organization_members
for delete
to authenticated
using ((select public.has_org_role(organization_id, array['owner','admin']::text[])));

create policy customers_member_all
on public.customers
for all
to authenticated
using ((select public.is_org_member(organization_id)))
with check ((select public.is_org_member(organization_id)));

create policy vehicles_member_all
on public.vehicles
for all
to authenticated
using ((select public.is_org_member(organization_id)))
with check ((select public.is_org_member(organization_id)));

create policy supplier_categories_member_all
on public.supplier_categories
for all
to authenticated
using ((select public.is_org_member(organization_id)))
with check ((select public.is_org_member(organization_id)));

create policy suppliers_member_all
on public.suppliers
for all
to authenticated
using ((select public.is_org_member(organization_id)))
with check ((select public.is_org_member(organization_id)));

create policy supplier_category_links_member_all
on public.supplier_category_links
for all
to authenticated
using ((select public.is_org_member(organization_id)))
with check ((select public.is_org_member(organization_id)));

create policy labor_items_member_all
on public.labor_items
for all
to authenticated
using ((select public.is_org_member(organization_id)))
with check ((select public.is_org_member(organization_id)));

revoke all on function public.is_org_member(uuid) from public, anon;
revoke all on function public.has_org_role(uuid, text[]) from public, anon;
revoke all on function public.create_organization(text, text, text) from public, anon;

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;
grant execute on function public.create_organization(text, text, text) to authenticated;
