-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 2.0I
-- ENTREGA PRIVADA DE EXPORTACOES
-- ===========================================================

-- O snapshot continua sendo autorizado e gerado pelo PostgreSQL com o mesmo
-- contrato owner-only da Fase 1.9G. Esta fase muda apenas o transporte final:
-- o navegador autenticado envia o arquivo diretamente ao Storage privado,
-- recebe uma URL assinada curta, baixa o Blob e remove a copia temporaria.
-- Nenhum corpo de exportacao precisa atravessar uma Function/Route do Next.js.

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'organization-data-exports',
    'organization-data-exports',
    false,
    57671680,
    array['application/json']::text[]
)
on conflict (id)
do update set
    name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;


-- ===========================================================
-- STORAGE RLS
-- ===========================================================
-- Caminho aceito:
--   <auth.uid()>/<export_request_id>/orbiq-<slug>-YYYYMMDD-HHMMSS.json
--
-- INSERT e SELECT existem somente durante 15 minutos apos o consumo valido
-- do pedido. DELETE permanece disponivel ao proprio proprietario para que uma
-- copia temporaria possa ser removida mesmo depois da janela de download.


drop policy if exists
orbiq_data_exports_insert_owner
on storage.objects;

create policy
orbiq_data_exports_insert_owner
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'organization-data-exports'
    and split_part(name, '/', 1) = auth.uid()::text
    and split_part(name, '/', 2) <> ''
    and split_part(name, '/', 3) ~ '^orbiq-[a-z0-9-]+-[0-9]{8}-[0-9]{6}\.json$'
    and split_part(name, '/', 4) = ''
    and exists (
        select 1
        from public.organization_data_exports as export
        where
            export.id::text = split_part(name, '/', 2)
            and export.requested_by = auth.uid()
            and export.downloaded_at is not null
            and export.downloaded_at >= now() - interval '15 minutes'
    )
);


drop policy if exists
orbiq_data_exports_select_owner
on storage.objects;

create policy
orbiq_data_exports_select_owner
on storage.objects
for select
to authenticated
using (
    bucket_id = 'organization-data-exports'
    and split_part(name, '/', 1) = auth.uid()::text
    and split_part(name, '/', 2) <> ''
    and split_part(name, '/', 3) ~ '^orbiq-[a-z0-9-]+-[0-9]{8}-[0-9]{6}\.json$'
    and split_part(name, '/', 4) = ''
    and exists (
        select 1
        from public.organization_data_exports as export
        where
            export.id::text = split_part(name, '/', 2)
            and export.requested_by = auth.uid()
            and export.downloaded_at is not null
            and export.downloaded_at >= now() - interval '15 minutes'
    )
);


drop policy if exists
orbiq_data_exports_delete_owner
on storage.objects;

create policy
orbiq_data_exports_delete_owner
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'organization-data-exports'
    and split_part(name, '/', 1) = auth.uid()::text
    and split_part(name, '/', 2) <> ''
    and split_part(name, '/', 3) ~ '^orbiq-[a-z0-9-]+-[0-9]{8}-[0-9]{6}\.json$'
    and split_part(name, '/', 4) = ''
    and exists (
        select 1
        from public.organization_data_exports as export
        where
            export.id::text = split_part(name, '/', 2)
            and export.requested_by = auth.uid()
    )
);


-- Nenhuma policy UPDATE e criada. O cliente usa upload sem upsert, evitando
-- substituicao silenciosa de um artefato ja publicado.


-- ===========================================================
-- VERIFICACOES DE SEGURANCA
-- ===========================================================

do $verification$
declare
    bucket_is_public boolean;
    bucket_limit bigint;
    bucket_mime_types text[];
    expected_policy_count integer;
begin
    select
        bucket.public,
        bucket.file_size_limit,
        bucket.allowed_mime_types
    into
        bucket_is_public,
        bucket_limit,
        bucket_mime_types
    from storage.buckets as bucket
    where bucket.id = 'organization-data-exports';

    if not found then
        raise exception
            'Bucket privado de exportacoes nao foi criado';
    end if;

    if coalesce(bucket_is_public, true) then
        raise exception
            'Bucket de exportacoes precisa permanecer privado';
    end if;

    if bucket_limit is distinct from 57671680 then
        raise exception
            'Bucket de exportacoes precisa do limite de 55 MiB';
    end if;

    if bucket_mime_types is distinct from array['application/json']::text[] then
        raise exception
            'Bucket de exportacoes deve aceitar somente application/json';
    end if;

    select count(*)
    into expected_policy_count
    from pg_policies
    where
        schemaname = 'storage'
        and tablename = 'objects'
        and policyname in (
            'orbiq_data_exports_insert_owner',
            'orbiq_data_exports_select_owner',
            'orbiq_data_exports_delete_owner'
        );

    if expected_policy_count <> 3 then
        raise exception
            'As tres policies owner-only do Storage precisam existir';
    end if;
end;
$verification$;
