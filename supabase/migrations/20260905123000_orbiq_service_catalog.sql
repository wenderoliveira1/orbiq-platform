-- ===========================================================
-- ORBIQ PLATFORM
-- CATALOGO DE SERVICOS DA OFICINA
--
-- Servico = trabalho realizado pelo mecanico.
-- Mao de obra = valor associado ao servico.
-- ===========================================================

create table if not exists public.service_catalog (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    category text not null,
    description text not null,
    default_labor_amount numeric(12,2) not null default 0 check (default_labor_amount >= 0),
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists service_catalog_unique_description_category
on public.service_catalog (
    organization_id,
    lower(btrim(category)),
    lower(btrim(description))
);

create index if not exists service_catalog_org_category_idx
on public.service_catalog (organization_id, category, active);

create or replace function public.orbiq_service_catalog_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists orbiq_service_catalog_updated_at on public.service_catalog;
create trigger orbiq_service_catalog_updated_at
before update on public.service_catalog
for each row execute function public.orbiq_service_catalog_updated_at();

alter table public.service_catalog enable row level security;

drop policy if exists orbiq_service_catalog_member_all on public.service_catalog;
create policy orbiq_service_catalog_member_all
on public.service_catalog
for all to authenticated
using ((select public.is_org_member(organization_id)))
with check ((select public.is_org_member(organization_id)));

grant select, insert, update, delete on table public.service_catalog to authenticated;

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
on conflict do nothing;

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
    service_uuid uuid;
    normalized_category text;
    normalized_description text;
    normalized_amount numeric(12,2);
begin
    if auth.uid() is null then raise exception 'Authentication required'; end if;
    if not public.is_org_member(target_org_id) then raise exception 'User does not belong to organization'; end if;

    normalized_category := nullif(btrim(coalesce(target_category, '')), '');
    normalized_description := btrim(coalesce(target_description, ''));
    normalized_amount := round(coalesce(target_labor_amount, 0), 2);

    if normalized_category is null then raise exception 'Service category is required'; end if;
    if char_length(normalized_description) < 2 then raise exception 'Service description is required'; end if;
    if normalized_amount < 0 then raise exception 'Invalid labor amount'; end if;

    select id into service_uuid
    from public.service_catalog
    where organization_id = target_org_id
      and lower(btrim(category)) = lower(normalized_category)
      and lower(btrim(description)) = lower(normalized_description)
    limit 1;

    if service_uuid is null then
        insert into public.service_catalog (organization_id, category, description, default_labor_amount)
        values (target_org_id, normalized_category, normalized_description, normalized_amount)
        returning id into service_uuid;
    else
        update public.service_catalog
        set category = normalized_category,
            description = normalized_description,
            default_labor_amount = normalized_amount,
            active = true
        where id = service_uuid and organization_id = target_org_id;
    end if;

    return service_uuid;
end;
$$;

revoke all on function public.save_service_catalog(uuid, text, text, numeric) from public, anon;
grant execute on function public.save_service_catalog(uuid, text, text, numeric) to authenticated;

notify pgrst, 'reload schema';
