-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 1.9G
-- DADOS, CONTINUIDADE E LGPD
-- ===========================================================

create table if not exists
public.organization_data_exports (
    id uuid
        primary key
        default gen_random_uuid(),
    organization_id uuid
        not null
        references public.organizations(id)
        on delete cascade,
    requested_by uuid
        not null
        references auth.users(id)
        on delete restrict,
    schema_version integer
        not null
        default 1,
    created_at timestamptz
        not null
        default now(),
    expires_at timestamptz
        not null
        default (now() + interval '10 minutes'),
    downloaded_at timestamptz,
    checksum_sha256 text,
    byte_size bigint,
    constraint organization_data_exports_schema_version_check
        check (schema_version = 1),
    constraint organization_data_exports_expiry_check
        check (expires_at > created_at),
    constraint organization_data_exports_checksum_check
        check (
            checksum_sha256 is null
            or checksum_sha256 ~ '^[0-9a-f]{64}$'
        ),
    constraint organization_data_exports_byte_size_check
        check (
            byte_size is null
            or byte_size between 1 and 52428800
        ),
    constraint organization_data_exports_completion_check
        check (
            (
                downloaded_at is null
                and checksum_sha256 is null
                and byte_size is null
            )
            or (
                downloaded_at is not null
                and checksum_sha256 is not null
                and byte_size is not null
            )
        )
);


create index if not exists
organization_data_exports_org_created_idx
on public.organization_data_exports (
    organization_id,
    created_at desc
);


create index if not exists
organization_data_exports_requester_created_idx
on public.organization_data_exports (
    requested_by,
    created_at desc
);


alter table
public.organization_data_exports
enable row level security;


drop policy if exists
organization_data_exports_select_owner
on public.organization_data_exports;


create policy
organization_data_exports_select_owner
on public.organization_data_exports
for select
to authenticated
using (
    requested_by = auth.uid()
    and public.has_org_role(
        organization_id,
        array['owner']::text[]
    )
);


revoke all
on table public.organization_data_exports
from anon;


revoke insert,
update,
delete
on table public.organization_data_exports
from authenticated;


grant select
on table public.organization_data_exports
to authenticated;


-- ===========================================================
-- PERMISSAO EXCLUSIVA DO PROPRIETARIO
-- ===========================================================

create or replace function
public.orbiq_permissions_for_role(
    target_role text
)
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
    select
        case lower(btrim(coalesce(target_role, '')))
            when 'owner' then array[
                'dashboard.view',
                'indicators.view',
                'network.view',
                'audit.view',
                'team.view',
                'team.manage',
                'customers.manage',
                'vehicles.manage',
                'quotes.view',
                'quotes.manage',
                'supplier_quotes.manage',
                'commercial.manage',
                'purchases.manage',
                'execution.manage',
                'labor.manage',
                'suppliers.manage',
                'settings.manage',
                'organizations.manage',
                'data.export'
            ]::text[]
            when 'admin' then array[
                'dashboard.view',
                'indicators.view',
                'audit.view',
                'team.view',
                'team.manage',
                'customers.manage',
                'vehicles.manage',
                'quotes.view',
                'quotes.manage',
                'supplier_quotes.manage',
                'commercial.manage',
                'purchases.manage',
                'execution.manage',
                'labor.manage',
                'suppliers.manage',
                'settings.manage'
            ]::text[]
            when 'manager' then array[
                'dashboard.view',
                'indicators.view',
                'audit.view',
                'team.view',
                'customers.manage',
                'vehicles.manage',
                'quotes.view',
                'quotes.manage',
                'supplier_quotes.manage',
                'commercial.manage',
                'purchases.manage',
                'execution.manage',
                'labor.manage',
                'suppliers.manage'
            ]::text[]
            when 'estimator' then array[
                'dashboard.view',
                'customers.manage',
                'vehicles.manage',
                'quotes.view',
                'quotes.manage',
                'supplier_quotes.manage',
                'labor.manage',
                'suppliers.manage'
            ]::text[]
            when 'technician' then array[
                'dashboard.view',
                'quotes.view',
                'execution.manage'
            ]::text[]
            when 'viewer' then array[
                'dashboard.view',
                'quotes.view'
            ]::text[]
            else array[]::text[]
        end;
$$;


-- ===========================================================
-- INVENTARIO CONSOLIDADO OWNER-ONLY
-- ===========================================================

drop function if exists
public.get_owned_data_governance_overview();


create or replace function
public.get_owned_data_governance_overview()
returns table (
    organization_id uuid,
    organization_name text,
    organization_slug text,
    customers_total bigint,
    vehicles_total bigint,
    quotes_total bigint,
    work_orders_total bigint,
    audit_events_total bigint,
    data_records_total bigint,
    exports_last_30_days bigint,
    last_export_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
    current_user_id uuid;
begin
    current_user_id := auth.uid();

    if current_user_id is null then
        raise exception
            'Authentication required'
            using errcode = '42501';
    end if;

    if not exists (
        select 1
        from public.organization_members as membership
        where
            membership.user_id = current_user_id
            and membership.role = 'owner'
            and membership.status = 'active'
    ) then
        raise exception
            'Somente um proprietário pode consultar a governança de dados.'
            using errcode = '42501';
    end if;

    return query
    with owned as (
        select
            organization.id,
            organization.name,
            organization.slug
        from public.organization_members as membership
        inner join public.organizations as organization
            on organization.id = membership.organization_id
        where
            membership.user_id = current_user_id
            and membership.role = 'owner'
            and membership.status = 'active'
    )
    select
        owned.id,
        owned.name,
        owned.slug,
        (select count(*) from public.customers as row where row.organization_id = owned.id),
        (select count(*) from public.vehicles as row where row.organization_id = owned.id),
        (select count(*) from public.quotes as row where row.organization_id = owned.id),
        (select count(*) from public.work_orders as row where row.organization_id = owned.id),
        (select count(*) from public.audit_logs as row where row.organization_id = owned.id),
        (
            (select count(*) from public.customers as row where row.organization_id = owned.id)
            + (select count(*) from public.vehicles as row where row.organization_id = owned.id)
            + (select count(*) from public.quotes as row where row.organization_id = owned.id)
            + (select count(*) from public.work_orders as row where row.organization_id = owned.id)
            + (select count(*) from public.purchase_orders as row where row.organization_id = owned.id)
            + (select count(*) from public.suppliers as row where row.organization_id = owned.id)
            + (select count(*) from public.audit_logs as row where row.organization_id = owned.id)
        ),
        (
            select count(*)
            from public.organization_data_exports as export
            where
                export.organization_id = owned.id
                and export.created_at >= now() - interval '30 days'
        ),
        (
            select max(export.downloaded_at)
            from public.organization_data_exports as export
            where export.organization_id = owned.id
        )
    from owned
    order by
        owned.name,
        owned.id;
end;
$$;


revoke all
on function public.get_owned_data_governance_overview()
from public,
anon;


grant execute
on function public.get_owned_data_governance_overview()
to authenticated;


-- ===========================================================
-- SOLICITACAO CURTA, IDEMPOTENTE E LIMITADA
-- ===========================================================

drop function if exists
public.create_organization_data_export(uuid);


create or replace function
public.create_organization_data_export(
    target_org_id uuid
)
returns table (
    export_request_id uuid,
    export_expires_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
    current_user_id uuid;
    existing_request public.organization_data_exports%rowtype;
    new_request public.organization_data_exports%rowtype;
    recent_requests integer;
begin
    current_user_id := auth.uid();

    if current_user_id is null then
        raise exception
            'Authentication required'
            using errcode = '42501';
    end if;

    if not exists (
        select 1
        from public.organization_members as membership
        where
            membership.organization_id = target_org_id
            and membership.user_id = current_user_id
            and membership.role = 'owner'
            and membership.status = 'active'
    ) then
        raise exception
            'A oficina informada não pertence ao proprietário.'
            using errcode = '42501';
    end if;

    perform pg_advisory_xact_lock(
        hashtextextended(current_user_id::text, 0)
    );

    select export.*
    into existing_request
    from public.organization_data_exports as export
    where
        export.organization_id = target_org_id
        and export.requested_by = current_user_id
        and export.downloaded_at is null
        and export.expires_at > now()
    order by export.created_at desc
    limit 1
    for update;

    if found then
        return query
        select
            existing_request.id,
            existing_request.expires_at;
        return;
    end if;

    select count(*)
    into recent_requests
    from public.organization_data_exports as export
    where
        export.requested_by = current_user_id
        and export.created_at >= now() - interval '1 hour';

    if recent_requests >= 3 then
        raise exception
            'Limite temporário de exportações excedido. Tente novamente mais tarde.'
            using errcode = '54000';
    end if;

    insert into public.organization_data_exports (
        organization_id,
        requested_by
    )
    values (
        target_org_id,
        current_user_id
    )
    returning *
    into new_request;

    perform public.orbiq_write_audit_log(
        target_org_id,
        current_user_id,
        'user',
        'organization.data_export_requested',
        'organization_data_export',
        new_request.id,
        null,
        jsonb_build_object(
            'expires_at', new_request.expires_at,
            'schema_version', new_request.schema_version
        )
    );

    return query
    select
        new_request.id,
        new_request.expires_at;
end;
$$;


revoke all
on function public.create_organization_data_export(uuid)
from public,
anon;


grant execute
on function public.create_organization_data_export(uuid)
to authenticated;


-- ===========================================================
-- SNAPSHOT CONSISTENTE, SANITIZADO E DE USO UNICO
-- ===========================================================

drop function if exists
public.consume_organization_data_export(uuid);


create or replace function
public.consume_organization_data_export(
    target_request_id uuid
)
returns table (
    export_snapshot text,
    export_checksum text,
    export_byte_size bigint,
    export_filename text,
    export_organization_id uuid,
    export_organization_name text,
    export_schema_version integer,
    export_created_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
    current_user_id uuid;
    request_row public.organization_data_exports%rowtype;
    organization_row public.organizations%rowtype;
    snapshot jsonb;
    snapshot_text text;
    snapshot_checksum text;
    snapshot_byte_size bigint;
    generated_at timestamptz;
begin
    current_user_id := auth.uid();

    if current_user_id is null then
        raise exception
            'Authentication required'
            using errcode = '42501';
    end if;

    select export.*
    into request_row
    from public.organization_data_exports as export
    inner join public.organization_members as membership
        on membership.organization_id = export.organization_id
    where
        export.id = target_request_id
        and export.requested_by = current_user_id
        and membership.user_id = current_user_id
        and membership.role = 'owner'
        and membership.status = 'active'
    for update of export;

    if not found then
        raise exception
            'Exportação indisponível.'
            using errcode = '42501';
    end if;

    if request_row.downloaded_at is not null then
        raise exception
            'Esta exportação já foi baixada.'
            using errcode = '55000';
    end if;

    if request_row.expires_at <= now() then
        raise exception
            'Esta exportação expirou. Gere uma nova solicitação.'
            using errcode = '55000';
    end if;

    select organization.*
    into strict organization_row
    from public.organizations as organization
    where organization.id = request_row.organization_id;

    generated_at := statement_timestamp();

    select jsonb_build_object(
        'format', 'orbiq-organization-data-export',
        'schema_version', request_row.schema_version,
        'generated_at', generated_at,
        'organization', to_jsonb(organization_row),
        'data', jsonb_build_object(
            'settings', (
                select to_jsonb(settings)
                from public.organization_settings as settings
                where settings.organization_id = request_row.organization_id
            ),
            'team', coalesce((
                select jsonb_agg(
                    jsonb_build_object(
                        'user_id', membership.user_id,
                        'role', membership.role,
                        'status', membership.status,
                        'created_at', membership.created_at,
                        'updated_at', membership.updated_at,
                        'full_name', profile.full_name,
                        'phone', profile.phone
                    )
                    order by membership.created_at, membership.user_id
                )
                from public.organization_members as membership
                left join public.profiles as profile
                    on profile.user_id = membership.user_id
                where membership.organization_id = request_row.organization_id
            ), '[]'::jsonb),
            'organization_invites', coalesce((
                select jsonb_agg(
                    jsonb_build_object(
                        'id', invite.id,
                        'organization_id', invite.organization_id,
                        'email', invite.email,
                        'role', invite.role,
                        'invited_by', invite.invited_by,
                        'created_at', invite.created_at,
                        'expires_at', invite.expires_at,
                        'accepted_at', invite.accepted_at,
                        'revoked_at', invite.revoked_at
                    )
                    order by invite.created_at, invite.id
                )
                from public.organization_invites as invite
                where invite.organization_id = request_row.organization_id
            ), '[]'::jsonb),
            'customers', coalesce((select jsonb_agg(to_jsonb(row) order by row.created_at, row.id) from public.customers as row where row.organization_id = request_row.organization_id), '[]'::jsonb),
            'vehicles', coalesce((select jsonb_agg(to_jsonb(row) order by row.created_at, row.id) from public.vehicles as row where row.organization_id = request_row.organization_id), '[]'::jsonb),
            'quotes', coalesce((select jsonb_agg(to_jsonb(row) order by row.created_at, row.id) from public.quotes as row where row.organization_id = request_row.organization_id), '[]'::jsonb),
            'quote_items', coalesce((select jsonb_agg(to_jsonb(row) order by row.created_at, row.id) from public.quote_items as row where row.organization_id = request_row.organization_id), '[]'::jsonb),
            'quote_services', coalesce((select jsonb_agg(to_jsonb(row) order by row.created_at, row.id) from public.quote_services as row where row.organization_id = request_row.organization_id), '[]'::jsonb),
            'quote_public_links', coalesce((
                select jsonb_agg(
                    jsonb_build_object(
                        'id', link.id,
                        'organization_id', link.organization_id,
                        'quote_id', link.quote_id,
                        'created_by', link.created_by,
                        'created_at', link.created_at,
                        'expires_at', link.expires_at,
                        'revoked_at', link.revoked_at,
                        'last_viewed_at', link.last_viewed_at
                    )
                    order by link.created_at, link.id
                )
                from public.quote_public_links as link
                where link.organization_id = request_row.organization_id
            ), '[]'::jsonb),
            'suppliers', coalesce((select jsonb_agg(to_jsonb(row) order by row.created_at, row.id) from public.suppliers as row where row.organization_id = request_row.organization_id), '[]'::jsonb),
            'supplier_categories', coalesce((select jsonb_agg(to_jsonb(row) order by row.created_at, row.id) from public.supplier_categories as row where row.organization_id = request_row.organization_id), '[]'::jsonb),
            'supplier_category_links', coalesce((select jsonb_agg(to_jsonb(row) order by row.created_at, row.supplier_id, row.category_id) from public.supplier_category_links as row where row.organization_id = request_row.organization_id), '[]'::jsonb),
            'quote_supplier_requests', coalesce((select jsonb_agg(to_jsonb(row) order by row.created_at, row.id) from public.quote_supplier_requests as row where row.organization_id = request_row.organization_id), '[]'::jsonb),
            'quote_supplier_request_items', coalesce((select jsonb_agg(to_jsonb(row) order by row.created_at, row.id) from public.quote_supplier_request_items as row where row.organization_id = request_row.organization_id), '[]'::jsonb),
            'quote_supplier_item_responses', coalesce((select jsonb_agg(to_jsonb(row) order by row.created_at, row.id) from public.quote_supplier_item_responses as row where row.organization_id = request_row.organization_id), '[]'::jsonb),
            'purchase_orders', coalesce((select jsonb_agg(to_jsonb(row) order by row.created_at, row.id) from public.purchase_orders as row where row.organization_id = request_row.organization_id), '[]'::jsonb),
            'purchase_order_items', coalesce((select jsonb_agg(to_jsonb(row) order by row.created_at, row.id) from public.purchase_order_items as row where row.organization_id = request_row.organization_id), '[]'::jsonb),
            'labor_services', coalesce((select jsonb_agg(to_jsonb(row) order by row.created_at, row.id) from public.labor_services as row where row.organization_id = request_row.organization_id), '[]'::jsonb),
            'labor_items', coalesce((select jsonb_agg(to_jsonb(row) order by row.created_at, row.id) from public.labor_items as row where row.organization_id = request_row.organization_id), '[]'::jsonb),
            'work_orders', coalesce((select jsonb_agg(to_jsonb(row) order by row.created_at, row.id) from public.work_orders as row where row.organization_id = request_row.organization_id), '[]'::jsonb),
            'work_order_services', coalesce((select jsonb_agg(to_jsonb(row) order by row.created_at, row.id) from public.work_order_services as row where row.organization_id = request_row.organization_id), '[]'::jsonb),
            'application_incidents', coalesce((select jsonb_agg(to_jsonb(row) order by row.first_seen_at, row.id) from public.application_incidents as row where row.organization_id = request_row.organization_id), '[]'::jsonb),
            'audit_logs', coalesce((select jsonb_agg(to_jsonb(row) order by row.created_at, row.id) from public.audit_logs as row where row.organization_id = request_row.organization_id), '[]'::jsonb)
        )
    )
    into snapshot;

    snapshot_text := snapshot::text;
    snapshot_byte_size := octet_length(convert_to(snapshot_text, 'UTF8'));

    if snapshot_byte_size > 52428800 then
        raise exception
            'A exportação excede o limite seguro de 50 MB.'
            using errcode = '54000';
    end if;

    snapshot_checksum := encode(
        extensions.digest(
            convert_to(snapshot_text, 'UTF8'),
            'sha256'
        ),
        'hex'
    );

    update public.organization_data_exports
    set
        downloaded_at = now(),
        checksum_sha256 = snapshot_checksum,
        byte_size = snapshot_byte_size
    where id = request_row.id;

    perform public.orbiq_write_audit_log(
        request_row.organization_id,
        current_user_id,
        'user',
        'organization.data_export_downloaded',
        'organization_data_export',
        request_row.id,
        null,
        jsonb_build_object(
            'checksum_sha256', snapshot_checksum,
            'byte_size', snapshot_byte_size,
            'schema_version', request_row.schema_version
        )
    );

    return query
    select
        snapshot_text,
        snapshot_checksum,
        snapshot_byte_size,
        'orbiq-' ||
            regexp_replace(organization_row.slug, '[^a-z0-9-]', '-', 'g') ||
            '-' || to_char(generated_at at time zone 'UTC', 'YYYYMMDD-HH24MISS') ||
            '.json',
        organization_row.id,
        organization_row.name,
        request_row.schema_version,
        generated_at;
end;
$$;


revoke all
on function public.consume_organization_data_export(uuid)
from public,
anon;


grant execute
on function public.consume_organization_data_export(uuid)
to authenticated;


-- ===========================================================
-- VERIFICACOES DE SEGURANCA
-- ===========================================================

do $verification$
declare
    consume_is_security_definer boolean;
    consume_config text[];
begin
    select
        procedure_row.prosecdef,
        procedure_row.proconfig
    into
        consume_is_security_definer,
        consume_config
    from pg_proc as procedure_row
    inner join pg_namespace as namespace_row
        on namespace_row.oid = procedure_row.pronamespace
    where
        namespace_row.nspname = 'public'
        and procedure_row.proname = 'consume_organization_data_export'
    limit 1;

    if not coalesce(consume_is_security_definer, false) then
        raise exception
            'consume_organization_data_export precisa de security definer';
    end if;

    if not coalesce(
        'search_path=public, extensions, pg_temp' = any(consume_config),
        false
    ) then
        raise exception
            'consume_organization_data_export precisa de search_path seguro';
    end if;

    if has_table_privilege(
        'authenticated',
        'public.organization_data_exports',
        'INSERT,UPDATE,DELETE'
    ) then
        raise exception
            'Authenticated role must not mutate data exports directly';
    end if;

    if has_function_privilege(
        'anon',
        'public.create_organization_data_export(uuid)',
        'EXECUTE'
    ) then
        raise exception
            'Anonymous role must not create data exports';
    end if;

    if has_function_privilege(
        'anon',
        'public.consume_organization_data_export(uuid)',
        'EXECUTE'
    ) then
        raise exception
            'Anonymous role must not consume data exports';
    end if;

    if not ('data.export' = any(public.orbiq_permissions_for_role('owner'))) then
        raise exception
            'Owner must receive data.export';
    end if;

    if 'data.export' = any(public.orbiq_permissions_for_role('admin')) then
        raise exception
            'Admin must not receive data.export';
    end if;
end;
$verification$;


notify pgrst, 'reload schema';
