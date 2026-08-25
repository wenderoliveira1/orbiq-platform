begin;

-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 1.9C
-- GESTAO SEGURA DE OFICINAS E FILIAIS
--
-- Uma conta proprietaria pode criar outra oficina sem reutilizar
-- o bootstrap da primeira organizacao. A operacao e atomica:
-- organizacao + owner + configuracoes + categorias + auditoria.
-- ===========================================================

create unique index if not exists
organizations_cnpj_digits_unique
on public.organizations (
    regexp_replace(cnpj, '[^0-9]', '', 'g')
)
where nullif(
    regexp_replace(cnpj, '[^0-9]', '', 'g'),
    ''
) is not null;

create or replace function
public.create_additional_organization(
    organization_name text,
    organization_slug text,
    organization_cnpj text,
    organization_legal_name text,
    organization_phone text,
    organization_whatsapp text,
    organization_email text,
    organization_city text,
    organization_state text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    current_user_id uuid := auth.uid();
    new_org_id uuid;
    clean_name text := btrim(coalesce(organization_name, ''));
    clean_slug text := lower(btrim(coalesce(organization_slug, '')));
    clean_cnpj text := nullif(btrim(coalesce(organization_cnpj, '')), '');
    cnpj_digits text;
    clean_legal_name text :=
        nullif(btrim(coalesce(organization_legal_name, '')), '');
    clean_phone text :=
        nullif(btrim(coalesce(organization_phone, '')), '');
    clean_whatsapp text :=
        nullif(btrim(coalesce(organization_whatsapp, '')), '');
    clean_email text :=
        nullif(lower(btrim(coalesce(organization_email, ''))), '');
    clean_city text :=
        nullif(btrim(coalesce(organization_city, '')), '');
    clean_state text :=
        nullif(upper(btrim(coalesce(organization_state, ''))), '');
begin
    if current_user_id is null then
        raise exception
            'Faça login antes de criar uma oficina.'
            using errcode = '42501';
    end if;

    -- Serializa criacoes concorrentes da mesma conta.
    perform pg_advisory_xact_lock(
        hashtextextended(
            'orbiq:create-additional:' || current_user_id::text,
            0
        )
    );

    if not exists (
        select 1
        from public.organization_members as membership
        where
            membership.user_id = current_user_id
            and membership.status = 'active'
            and membership.role = 'owner'
    ) then
        raise exception
            'Somente um proprietário pode criar uma nova oficina.'
            using errcode = '42501';
    end if;

    if char_length(clean_name) < 2
        or char_length(clean_name) > 120 then
        raise exception
            'Nome da oficina deve possuir entre 2 e 120 caracteres.';
    end if;

    if clean_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
        raise exception
            'Identificador da oficina inválido.';
    end if;

    if clean_cnpj is not null then
        cnpj_digits := regexp_replace(
            clean_cnpj,
            '[^0-9]',
            '',
            'g'
        );

        if char_length(cnpj_digits) <> 14 then
            raise exception
                'CNPJ deve possuir 14 dígitos.';
        end if;
    end if;

    if clean_phone is null and clean_whatsapp is null then
        raise exception
            'Informe pelo menos um telefone ou WhatsApp da oficina.';
    end if;

    if clean_email is not null
        and clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    then
        raise exception
            'E-mail da oficina inválido.';
    end if;

    if clean_city is null or char_length(clean_city) < 2 then
        raise exception
            'Informe a cidade da oficina.';
    end if;

    if clean_state is null
        or clean_state !~ '^[A-Z]{2}$'
    then
        raise exception
            'UF deve possuir exatamente 2 letras.';
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

    -- O trigger de organization_members semeia as categorias padrao
    -- depois que o owner ja existe e pode passar pelo firewall.
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

    insert into public.organization_settings (
        organization_id,
        legal_name,
        phone,
        whatsapp,
        email,
        city,
        state
    )
    values (
        new_org_id,
        clean_legal_name,
        clean_phone,
        clean_whatsapp,
        clean_email,
        clean_city,
        clean_state
    );

    perform public.orbiq_write_audit_log(
        new_org_id,
        current_user_id,
        'user',
        'organization.created',
        'organization',
        new_org_id,
        null,
        jsonb_build_object(
            'name', clean_name,
            'slug', clean_slug,
            'source', 'organization_management'
        )
    );

    return jsonb_build_object(
        'organization_id', new_org_id,
        'name', clean_name,
        'slug', clean_slug,
        'role', 'owner'
    );
exception
    when unique_violation then
        raise exception
            'Já existe uma oficina com esse identificador ou CNPJ.'
            using errcode = '23505';
end;
$$;

revoke all
on function public.create_additional_organization(
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text
)
from public, anon;

grant execute
on function public.create_additional_organization(
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text
)
to authenticated;

do $verify$
declare
    function_config text[];
begin
    if to_regprocedure(
        'public.create_additional_organization(text,text,text,text,text,text,text,text,text)'
    ) is null then
        raise exception
            'create_additional_organization não foi instalada';
    end if;

    select procedure_row.proconfig
    into function_config
    from pg_proc as procedure_row
    join pg_namespace as namespace_row
        on namespace_row.oid = procedure_row.pronamespace
    where
        namespace_row.nspname = 'public'
        and procedure_row.proname =
            'create_additional_organization'
    limit 1;

    if not coalesce(
        'search_path=public' = any(function_config),
        false
    ) then
        raise exception
            'create_additional_organization precisa de search_path public';
    end if;

    if to_regclass(
        'public.organizations_cnpj_digits_unique'
    ) is null then
        raise exception
            'Índice único normalizado de CNPJ não foi criado';
    end if;
end;
$verify$;

notify pgrst, 'reload schema';

commit;
