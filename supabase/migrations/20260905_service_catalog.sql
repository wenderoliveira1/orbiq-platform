create table if not exists public.service_catalog (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category text not null,
  description text not null,
  default_labor_amount numeric(12,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_catalog_org_idx
  on public.service_catalog (organization_id);

create index if not exists service_catalog_org_category_idx
  on public.service_catalog (organization_id, category);

create unique index if not exists service_catalog_org_category_description_uidx
  on public.service_catalog (organization_id, lower(category), lower(description));

alter table public.service_catalog enable row level security;

drop policy if exists service_catalog_select on public.service_catalog;
drop policy if exists service_catalog_insert on public.service_catalog;
drop policy if exists service_catalog_update on public.service_catalog;
drop policy if exists service_catalog_delete on public.service_catalog;

create policy service_catalog_select on public.service_catalog
  for select using (organization_id = public.current_organization_id());

create policy service_catalog_insert on public.service_catalog
  for insert with check (organization_id = public.current_organization_id());

create policy service_catalog_update on public.service_catalog
  for update using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy service_catalog_delete on public.service_catalog
  for delete using (organization_id = public.current_organization_id());

create or replace function public.save_service_catalog(
  target_org_id uuid,
  target_category text,
  target_description text,
  target_labor_amount numeric
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  result_id uuid;
begin
  if target_org_id is null
     or target_category is null
     or btrim(target_category) = ''
     or target_description is null
     or length(btrim(target_description)) < 2
     or target_labor_amount is null
     or target_labor_amount < 0 then
    raise exception 'invalid service catalog data';
  end if;

  if target_org_id <> public.current_organization_id() then
    raise exception 'organization access denied';
  end if;

  insert into public.service_catalog (
    organization_id,
    category,
    description,
    default_labor_amount,
    active,
    updated_at
  ) values (
    target_org_id,
    btrim(target_category),
    btrim(target_description),
    round(target_labor_amount, 2),
    true,
    now()
  )
  on conflict (organization_id, lower(category), lower(description))
  do update set
    category = excluded.category,
    description = excluded.description,
    default_labor_amount = excluded.default_labor_amount,
    active = true,
    updated_at = now()
  returning id into result_id;

  return result_id;
end;
$$;

grant select, insert, update, delete on public.service_catalog to authenticated;
grant execute on function public.save_service_catalog(uuid, text, text, numeric) to authenticated;

insert into public.service_catalog (organization_id, category, description, default_labor_amount)
select o.id, seed.category, seed.description, 0
from public.organizations o
cross join (values
  ('Mecânica', 'Trocar coxim do motor'),
  ('Mecânica', 'Substituir correia de acessórios'),
  ('Suspensão', 'Trocar pivô'),
  ('Suspensão', 'Trocar amortecedor'),
  ('Freios', 'Trocar pastilhas de freio'),
  ('Freios', 'Trocar disco de freio'),
  ('Direção', 'Trocar terminal de direção'),
  ('Arrefecimento', 'Substituir radiador'),
  ('Elétrica', 'Diagnóstico elétrico'),
  ('Motor', 'Diagnóstico de falha do motor'),
  ('Câmbio', 'Troca de óleo do câmbio')
) as seed(category, description)
on conflict (organization_id, lower(category), lower(description)) do nothing;
