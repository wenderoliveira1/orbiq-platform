-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 1.9F
-- CONFIABILIDADE E OBSERVABILIDADE OPERACIONAL
-- ===========================================================

create table if not exists
public.application_incidents (
    id uuid
        primary key
        default gen_random_uuid(),
    organization_id uuid
        not null
        references public.organizations(id)
        on delete cascade,
    reporter_user_id uuid
        references auth.users(id)
        on delete set null,
    fingerprint text
        not null,
    source text
        not null,
    route text
        not null,
    occurrences integer
        not null
        default 1,
    first_seen_at timestamptz
        not null
        default now(),
    last_seen_at timestamptz
        not null
        default now(),
    resolved_at timestamptz,
    resolved_by uuid
        references auth.users(id)
        on delete set null,
    resolution_note text,
    constraint application_incidents_fingerprint_check
        check (
            fingerprint ~ '^next_[A-Za-z0-9:_-]{8,116}$'
            or fingerprint ~ '^(client|global|server)_[0-9a-f]{8,64}$'
        ),
    constraint application_incidents_source_check
        check (
            source in (
                'dashboard_error',
                'global_error',
                'server_action'
            )
        ),
    constraint application_incidents_route_check
        check (
            char_length(route) between 1 and 180
            and route like '/%'
            and route !~ '[\r\n]'
        ),
    constraint application_incidents_occurrences_check
        check (occurrences >= 1),
    constraint application_incidents_resolution_note_check
        check (
            resolution_note is null
            or char_length(resolution_note) <= 500
        )
);


create unique index if not exists
application_incidents_open_fingerprint_unique
on public.application_incidents (
    organization_id,
    fingerprint
)
where resolved_at is null;


create index if not exists
application_incidents_org_status_seen_idx
on public.application_incidents (
    organization_id,
    resolved_at,
    last_seen_at desc
);


create index if not exists
application_incidents_reporter_first_seen_idx
on public.application_incidents (
    reporter_user_id,
    first_seen_at desc
);


alter table
public.application_incidents
enable row level security;


drop policy if exists
application_incidents_select_owner
on public.application_incidents;


create policy
application_incidents_select_owner
on public.application_incidents
for select
to authenticated
using (
    public.has_org_role(
        organization_id,
        array['owner']::text[]
    )
);


revoke all
on table public.application_incidents
from anon;


revoke insert,
update,
delete
on table public.application_incidents
from authenticated;


grant select
on table public.application_incidents
to authenticated;


-- ===========================================================
-- CAPTURA SANITIZADA E DEDUPLICADA
-- ===========================================================

drop function if exists
public.report_application_incident(
    uuid,
    text,
    text,
    text
);


create or replace function
public.report_application_incident(
    target_org_id uuid,
    target_fingerprint text,
    target_source text,
    target_route text
)
returns table (
    incident_id uuid,
    occurrence_count integer
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
    current_user_id uuid;
    clean_fingerprint text;
    clean_source text;
    clean_route text;
    recent_new_incidents integer;
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
            and membership.status = 'active'
    ) then
        raise exception
            'A oficina informada não pertence ao usuário autenticado.'
            using errcode = '42501';
    end if;

    clean_fingerprint := trim(
        coalesce(target_fingerprint, '')
    );

    if
        clean_fingerprint !~ '^next_[A-Za-z0-9:_-]{8,116}$'
        and clean_fingerprint !~ '^(client|global|server)_[0-9a-f]{8,64}$'
    then
        raise exception
            'Identificador de incidente inválido.'
            using errcode = '22023';
    end if;

    clean_source := lower(
        trim(coalesce(target_source, ''))
    );

    if clean_source not in (
        'dashboard_error',
        'global_error',
        'server_action'
    ) then
        raise exception
            'Origem de incidente inválida.'
            using errcode = '22023';
    end if;

    clean_route := split_part(
        trim(coalesce(target_route, '')),
        '?',
        1
    );

    if
        char_length(clean_route) < 1
        or char_length(clean_route) > 180
        or clean_route not like '/%'
        or clean_route ~ '[\r\n]'
    then
        raise exception
            'Rota de incidente inválida.'
            using errcode = '22023';
    end if;

    select count(*)
    into recent_new_incidents
    from public.application_incidents as incident
    where
        incident.reporter_user_id = current_user_id
        and incident.first_seen_at >= now() - interval '10 minutes';

    if recent_new_incidents >= 20 then
        raise exception
            'Limite temporário de novos incidentes excedido.'
            using errcode = '54000';
    end if;

    return query
    insert into public.application_incidents (
        organization_id,
        reporter_user_id,
        fingerprint,
        source,
        route
    )
    values (
        target_org_id,
        current_user_id,
        clean_fingerprint,
        clean_source,
        clean_route
    )
    on conflict (
        organization_id,
        fingerprint
    )
    where resolved_at is null
    do update
    set
        occurrences = application_incidents.occurrences + 1,
        last_seen_at = now(),
        reporter_user_id = excluded.reporter_user_id,
        source = excluded.source,
        route = excluded.route
    returning
        application_incidents.id,
        application_incidents.occurrences;
end;
$$;


revoke all
on function public.report_application_incident(
    uuid,
    text,
    text,
    text
)
from public,
anon;


grant execute
on function public.report_application_incident(
    uuid,
    text,
    text,
    text
)
to authenticated;


-- ===========================================================
-- CONSULTA CONSOLIDADA OWNER-ONLY
-- ===========================================================

drop function if exists
public.get_owned_application_incidents(
    uuid,
    text,
    text,
    integer,
    integer
);


create or replace function
public.get_owned_application_incidents(
    filter_organization_id uuid
        default null,
    filter_status text
        default 'open',
    filter_query text
        default null,
    result_limit integer
        default 50,
    result_offset integer
        default 0
)
returns table (
    incident_id uuid,
    organization_id uuid,
    organization_name text,
    reporter_user_id uuid,
    fingerprint text,
    source text,
    route text,
    occurrences integer,
    first_seen_at timestamptz,
    last_seen_at timestamptz,
    resolved_at timestamptz,
    resolved_by uuid,
    resolution_note text,
    total_count bigint
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
    current_user_id uuid;
    safe_status text;
    safe_query text;
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
            'Somente um proprietário pode consultar a central de confiabilidade.'
            using errcode = '42501';
    end if;

    if
        filter_organization_id is not null
        and not exists (
            select 1
            from public.organization_members as membership
            where
                membership.organization_id = filter_organization_id
                and membership.user_id = current_user_id
                and membership.role = 'owner'
                and membership.status = 'active'
        )
    then
        raise exception
            'A oficina informada não pertence à rede do proprietário.'
            using errcode = '42501';
    end if;

    safe_status := lower(
        trim(coalesce(filter_status, 'open'))
    );

    if safe_status not in ('open', 'resolved', 'all') then
        raise exception
            'Status de incidente inválido.'
            using errcode = '22023';
    end if;

    safe_query := nullif(
        lower(trim(coalesce(filter_query, ''))),
        ''
    );

    if char_length(coalesce(safe_query, '')) > 100 then
        raise exception
            'A pesquisa deve possuir no máximo 100 caracteres.'
            using errcode = '22023';
    end if;

    if result_limit < 1 or result_limit > 100 then
        raise exception
            'O limite deve estar entre 1 e 100 registros.'
            using errcode = '22023';
    end if;

    if result_offset < 0 or result_offset > 10000 then
        raise exception
            'A paginação informada é inválida.'
            using errcode = '22023';
    end if;

    return query
    with owned_organizations as (
        select
            organization.id,
            organization.name
        from public.organization_members as membership
        inner join public.organizations as organization
            on organization.id = membership.organization_id
        where
            membership.user_id = current_user_id
            and membership.role = 'owner'
            and membership.status = 'active'
            and (
                filter_organization_id is null
                or organization.id = filter_organization_id
            )
    ),
    filtered as materialized (
        select
            incident.id as incident_id,
            incident.organization_id,
            owned.name as organization_name,
            incident.reporter_user_id,
            incident.fingerprint,
            incident.source,
            incident.route,
            incident.occurrences,
            incident.first_seen_at,
            incident.last_seen_at,
            incident.resolved_at,
            incident.resolved_by,
            incident.resolution_note
        from public.application_incidents as incident
        inner join owned_organizations as owned
            on owned.id = incident.organization_id
        where
            (
                safe_status = 'all'
                or (
                    safe_status = 'open'
                    and incident.resolved_at is null
                )
                or (
                    safe_status = 'resolved'
                    and incident.resolved_at is not null
                )
            )
            and (
                safe_query is null
                or lower(owned.name) like '%' || safe_query || '%'
                or lower(incident.fingerprint) like '%' || safe_query || '%'
                or lower(incident.source) like '%' || safe_query || '%'
                or lower(incident.route) like '%' || safe_query || '%'
            )
    )
    select
        filtered.incident_id,
        filtered.organization_id,
        filtered.organization_name,
        filtered.reporter_user_id,
        filtered.fingerprint,
        filtered.source,
        filtered.route,
        filtered.occurrences,
        filtered.first_seen_at,
        filtered.last_seen_at,
        filtered.resolved_at,
        filtered.resolved_by,
        filtered.resolution_note,
        count(*) over() as total_count
    from filtered
    order by
        (filtered.resolved_at is null) desc,
        filtered.last_seen_at desc,
        filtered.incident_id desc
    limit result_limit
    offset result_offset;
end;
$$;


revoke all
on function public.get_owned_application_incidents(
    uuid,
    text,
    text,
    integer,
    integer
)
from public,
anon;


grant execute
on function public.get_owned_application_incidents(
    uuid,
    text,
    text,
    integer,
    integer
)
to authenticated;


-- ===========================================================
-- RESOLUCAO OWNER-ONLY E AUDITADA
-- ===========================================================

drop function if exists
public.resolve_application_incident(
    uuid,
    text
);


create or replace function
public.resolve_application_incident(
    target_incident_id uuid,
    target_resolution_note text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
    current_user_id uuid;
    incident_row public.application_incidents%rowtype;
    clean_note text;
begin
    current_user_id := auth.uid();

    if current_user_id is null then
        raise exception
            'Authentication required'
            using errcode = '42501';
    end if;

    select incident.*
    into incident_row
    from public.application_incidents as incident
    where incident.id = target_incident_id
    for update;

    if not found then
        raise exception
            'Incidente não encontrado.'
            using errcode = 'P0002';
    end if;

    if not exists (
        select 1
        from public.organization_members as membership
        where
            membership.organization_id = incident_row.organization_id
            and membership.user_id = current_user_id
            and membership.role = 'owner'
            and membership.status = 'active'
    ) then
        raise exception
            'Somente o proprietário pode resolver este incidente.'
            using errcode = '42501';
    end if;

    clean_note := nullif(
        trim(coalesce(target_resolution_note, '')),
        ''
    );

    if
        clean_note is not null
        and char_length(clean_note) > 500
    then
        raise exception
            'A observação deve possuir no máximo 500 caracteres.'
            using errcode = '22023';
    end if;

    if incident_row.resolved_at is not null then
        return true;
    end if;

    update public.application_incidents
    set
        resolved_at = now(),
        resolved_by = current_user_id,
        resolution_note = clean_note
    where id = target_incident_id;

    perform public.orbiq_write_audit_log(
        incident_row.organization_id,
        current_user_id,
        'user',
        'reliability.incident_resolved',
        'application_incident',
        incident_row.id,
        null,
        jsonb_build_object(
            'fingerprint', incident_row.fingerprint,
            'source', incident_row.source,
            'route', incident_row.route,
            'occurrences', incident_row.occurrences
        )
    );

    return true;
end;
$$;


revoke all
on function public.resolve_application_incident(
    uuid,
    text
)
from public,
anon;


grant execute
on function public.resolve_application_incident(
    uuid,
    text
)
to authenticated;


-- ===========================================================
-- VERIFICACOES DE SEGURANCA
-- ===========================================================

do $verification$
declare
    list_is_security_definer boolean;
    list_config text[];
begin
    select
        procedure_row.prosecdef,
        procedure_row.proconfig
    into
        list_is_security_definer,
        list_config
    from pg_proc as procedure_row
    inner join pg_namespace as namespace_row
        on namespace_row.oid = procedure_row.pronamespace
    where
        namespace_row.nspname = 'public'
        and procedure_row.proname = 'get_owned_application_incidents'
    limit 1;

    if list_is_security_definer is null then
        raise exception
            'get_owned_application_incidents não foi instalada';
    end if;

    if list_is_security_definer then
        raise exception
            'A consulta de incidentes deve respeitar RLS com security invoker';
    end if;

    if not coalesce(
        'search_path=public, pg_temp' = any(list_config),
        false
    ) then
        raise exception
            'get_owned_application_incidents precisa de search_path seguro';
    end if;

    if has_table_privilege(
        'authenticated',
        'public.application_incidents',
        'INSERT,UPDATE,DELETE'
    ) then
        raise exception
            'Authenticated role must not mutate application incidents directly';
    end if;

    if has_function_privilege(
        'anon',
        'public.report_application_incident(uuid,text,text,text)',
        'EXECUTE'
    ) then
        raise exception
            'Anonymous role must not report application incidents';
    end if;

    if has_function_privilege(
        'anon',
        'public.get_owned_application_incidents(uuid,text,text,integer,integer)',
        'EXECUTE'
    ) then
        raise exception
            'Anonymous role must not list application incidents';
    end if;

    if has_function_privilege(
        'anon',
        'public.resolve_application_incident(uuid,text)',
        'EXECUTE'
    ) then
        raise exception
            'Anonymous role must not resolve application incidents';
    end if;
end;
$verification$;


notify pgrst, 'reload schema';
