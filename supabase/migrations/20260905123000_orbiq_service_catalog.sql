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

-- Catalogo inicial pequeno. Novos servicos podem ser adicionados pelo fluxo do orcamento.
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

notify pgrst, 'reload schema';
