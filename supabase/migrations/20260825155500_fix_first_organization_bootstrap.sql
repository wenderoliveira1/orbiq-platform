begin;

-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 1.9A
-- BOOTSTRAP SEGURO DA PRIMEIRA OFICINA
--
-- Problema corrigido:
-- o seed das categorias de fornecedores ocorria no INSERT da
-- organização, antes de o owner existir em organization_members.
-- O guard de mutação corretamente exigia suppliers.manage e o
-- bootstrap era interrompido.
--
-- Solução:
-- 1. criar organização;
-- 2. criar membership owner;
-- 3. somente então semear categorias padrão;
-- 4. proteger o bootstrap contra criação concorrente/duplicada.
-- ===========================================================


-- ===========================================================
-- SEED DE CATEGORIAS APÓS O OWNER EXISTIR
-- ===========================================================

create or replace function
public.orbiq_seed_supplier_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

    if
        new.role <> 'owner'
        or
        new.status <> 'active'
    then
        return new;
    end if;


    insert into public.supplier_categories (
        organization_id,
        name,
        active
    )

    select
        new.organization_id,
        defaults.name,
        true

    from (
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
        from public.supplier_categories as category
        where
            category.organization_id = new.organization_id
            and lower(btrim(category.name)) = lower(btrim(defaults.name))
    );


    return new;

end;
$$;


revoke all
on function public.orbiq_seed_supplier_categories()
from public,
anon,
authenticated;


-- O gatilho antigo acontecia cedo demais.
drop trigger if exists
orbiq_seed_supplier_categories_trigger
on public.organizations;


-- Idempotência caso a migration precise ser reconciliada.
drop trigger if exists
orbiq_seed_supplier_categories_trigger
on public.organization_members;


create trigger
orbiq_seed_supplier_categories_trigger
after insert
on public.organization_members
for each row
execute function public.orbiq_seed_supplier_categories();


-- ===========================================================
-- BOOTSTRAP DA PRIMEIRA ORGANIZAÇÃO
-- ===========================================================

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
        raise exception
            'Authentication required'
            using errcode = '42501';
    end if;


    -- Serializa tentativas concorrentes do mesmo usuário.
    perform pg_advisory_xact_lock(
        hashtextextended(current_user_id::text, 0)
    );


    -- Enquanto o seletor multiempresa ainda não existe, o RPC de
    -- onboarding é exclusivamente o bootstrap da PRIMEIRA oficina.
    if exists (
        select 1
        from public.organization_members as membership
        where
            membership.user_id = current_user_id
            and membership.status = 'active'
    ) then
        raise exception
            'User already has an active organization'
            using errcode = '42501';
    end if;


    if char_length(clean_name) < 2 then
        raise exception
            'Organization name is required';
    end if;


    if clean_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
        raise exception
            'Invalid organization slug';
    end if;


    insert into public.organizations (
        name,
        slug,
        cnpj
    )
    values (
        clean_name,
        clean_slug,
        clean_cnpj
    )
    returning id
    into new_org_id;


    -- O AFTER INSERT deste membership executa o seed das categorias.
    -- Nesse ponto o owner já existe e suppliers.manage é resolvido
    -- corretamente pelo guard de mutação.
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


revoke all
on function public.create_organization(
    text,
    text,
    text
)
from public,
anon;


grant execute
on function public.create_organization(
    text,
    text,
    text
)
to authenticated;


-- ===========================================================
-- VERIFICAÇÃO ESTRUTURAL
-- ===========================================================

do $verify$
declare
    organization_trigger_count integer;
    membership_trigger_count integer;
begin

    select count(*)
    into organization_trigger_count
    from pg_trigger as trigger_row
    join pg_class as table_row
        on table_row.oid = trigger_row.tgrelid
    join pg_namespace as namespace_row
        on namespace_row.oid = table_row.relnamespace
    where
        not trigger_row.tgisinternal
        and namespace_row.nspname = 'public'
        and table_row.relname = 'organizations'
        and trigger_row.tgname = 'orbiq_seed_supplier_categories_trigger';


    select count(*)
    into membership_trigger_count
    from pg_trigger as trigger_row
    join pg_class as table_row
        on table_row.oid = trigger_row.tgrelid
    join pg_namespace as namespace_row
        on namespace_row.oid = table_row.relnamespace
    where
        not trigger_row.tgisinternal
        and namespace_row.nspname = 'public'
        and table_row.relname = 'organization_members'
        and trigger_row.tgname = 'orbiq_seed_supplier_categories_trigger';


    if organization_trigger_count <> 0 then
        raise exception
            'Bootstrap inválido: seed ainda vinculado a organizations';
    end if;


    if membership_trigger_count <> 1 then
        raise exception
            'Bootstrap inválido: esperado 1 trigger de seed em organization_members, encontrado %',
            membership_trigger_count;
    end if;

end;
$verify$;


notify pgrst, 'reload schema';

commit;
