-- ===========================================================
-- ORBIQ - FASE 1.8C
-- IDENTIDADE VISUAL DA OFICINA
--
-- Branding deliberadamente separado dos dados operacionais:
-- - manifest JSON público e versionável no Supabase Storage
-- - logo PNG/JPEG/WebP
-- - escrita protegida por settings.manage + organização
-- - leitura pública somente porque a marca aparece em documentos
--   e links que já são destinados ao cliente.
--
-- Nenhuma tabela operacional é alterada.
-- ===========================================================


-- ===========================================================
-- BUCKET DE IDENTIDADE
-- ===========================================================

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'organization-branding',
    'organization-branding',
    true,
    2097152,
    array[
        'application/json',
        'image/png',
        'image/jpeg',
        'image/webp'
    ]::text[]
)
on conflict (id)
do update
set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;


-- ===========================================================
-- RLS DO STORAGE
--
-- O primeiro diretório do objeto é SEMPRE o organization_id:
--   <organization_id>/branding.json
--   <organization_id>/logo-<timestamp>.png
--
-- CASE impede cast de nomes malformados para uuid.
-- ===========================================================

drop policy if exists
"orbiq_branding_select"
on storage.objects;

create policy
"orbiq_branding_select"
on storage.objects
for select
to authenticated
using (
    bucket_id = 'organization-branding'
    and
    case
        when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then public.orbiq_has_permission(
            split_part(name, '/', 1)::uuid,
            'settings.manage'
        )
        else false
    end
);


drop policy if exists
"orbiq_branding_insert"
on storage.objects;

create policy
"orbiq_branding_insert"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'organization-branding'
    and
    case
        when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then public.orbiq_has_permission(
            split_part(name, '/', 1)::uuid,
            'settings.manage'
        )
        else false
    end
);


drop policy if exists
"orbiq_branding_update"
on storage.objects;

create policy
"orbiq_branding_update"
on storage.objects
for update
to authenticated
using (
    bucket_id = 'organization-branding'
    and
    case
        when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then public.orbiq_has_permission(
            split_part(name, '/', 1)::uuid,
            'settings.manage'
        )
        else false
    end
)
with check (
    bucket_id = 'organization-branding'
    and
    case
        when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then public.orbiq_has_permission(
            split_part(name, '/', 1)::uuid,
            'settings.manage'
        )
        else false
    end
);


drop policy if exists
"orbiq_branding_delete"
on storage.objects;

create policy
"orbiq_branding_delete"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'organization-branding'
    and
    case
        when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then public.orbiq_has_permission(
            split_part(name, '/', 1)::uuid,
            'settings.manage'
        )
        else false
    end
);


-- ===========================================================
-- PERFIL PUBLICO DA OFICINA
--
-- Mantém a assinatura da 1.8B e acrescenta somente o caminho
-- previsível do manifest público. Não expõe custos, usuários,
-- fornecedores, margens ou qualquer dado interno.
-- ===========================================================

create or replace function
public.public_get_workshop_profile(
    target_token text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    result jsonb;
begin
    if
        target_token is null
        or
        char_length(
            btrim(
                target_token
            )
        ) < 32
    then
        return null;
    end if;


    select
        jsonb_build_object(
            'organization_name',
            organization_row.name,

            'organization_cnpj',
            organization_row.cnpj,

            'legal_name',
            settings_row.legal_name,

            'phone',
            settings_row.phone,

            'whatsapp',
            settings_row.whatsapp,

            'email',
            settings_row.email,

            'postal_code',
            settings_row.postal_code,

            'address_line',
            settings_row.address_line,

            'address_number',
            settings_row.address_number,

            'address_complement',
            settings_row.address_complement,

            'district',
            settings_row.district,

            'city',
            settings_row.city,

            'state',
            settings_row.state,

            'quote_validity_days',
            coalesce(
                settings_row.quote_validity_days,
                7
            ),

            'default_quote_notes',
            settings_row.default_quote_notes,

            'branding_manifest_path',
            organization_row.id::text || '/branding.json'
        )
    into
        result
    from
        public.quote_public_links
            as link_row

    join
        public.organizations
            as organization_row
        on
            organization_row.id =
                link_row.organization_id

    left join
        public.organization_settings
            as settings_row
        on
            settings_row.organization_id =
                link_row.organization_id

    where
        link_row.token =
            btrim(
                target_token
            )
        and
        link_row.revoked_at is null
        and
        link_row.expires_at > now()

    limit 1;


    return result;
end;
$$;


revoke all
on function
public.public_get_workshop_profile(text)
from public;


grant execute
on function
public.public_get_workshop_profile(text)
to anon,
authenticated;


-- ===========================================================
-- VALIDACAO DA MIGRATION
-- ===========================================================

do $$
begin
    if not exists (
        select 1
        from storage.buckets
        where id = 'organization-branding'
          and public = true
          and file_size_limit = 2097152
    ) then
        raise exception
            'Bucket organization-branding não configurado';
    end if;


    if not exists (
        select 1
        from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and policyname = 'orbiq_branding_insert'
    ) then
        raise exception
            'Policy de upload do branding não criada';
    end if;


    if to_regprocedure(
        'public.public_get_workshop_profile(text)'
    ) is null then
        raise exception
            'public_get_workshop_profile não disponível';
    end if;
end;
$$;


notify pgrst, 'reload schema';
