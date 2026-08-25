begin;

-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 1.9B
-- CONVITES MULTIEMPRESA
--
-- A regra antiga impedia o aceite de um convite quando a conta já
-- possuía vínculo ativo com outra oficina. Com o contexto multiempresa,
-- uma mesma conta pode pertencer a várias organizações e o isolamento
-- continua sendo garantido por organization_members + RLS.
--
-- pgcrypto é instalado pelo Supabase no schema extensions. Por isso,
-- funções que usam digest() precisam manter extensions no search_path.
-- ===========================================================

create or replace function
public.accept_organization_invite(
    target_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    invitation record;
    target_hash text;
    current_user_id uuid;
    current_email text;
begin
    current_user_id := auth.uid();

    if current_user_id is null then
        raise exception
            'Faça login antes de aceitar o convite.';
    end if;

    select lower(auth_user.email)
    into current_email
    from auth.users as auth_user
    where auth_user.id = current_user_id;

    target_hash := encode(
        digest(
            btrim(coalesce(target_token, '')),
            'sha256'
        ),
        'hex'
    );

    select
        invite.id,
        invite.organization_id,
        invite.email,
        invite.role,
        invite.expires_at,
        organization.name as organization_name
    into invitation
    from public.organization_invites as invite
    join public.organizations as organization
        on organization.id = invite.organization_id
    where
        invite.token_hash = target_hash
        and invite.accepted_at is null
        and invite.revoked_at is null
        and invite.expires_at > now()
    for update;

    if not found then
        raise exception
            'Este convite é inválido, expirou ou já foi utilizado.';
    end if;

    if
        current_email is null
        or current_email <> lower(invitation.email)
    then
        raise exception
            'Este convite pertence a outro endereço de e-mail.';
    end if;

    insert into public.organization_members (
        organization_id,
        user_id,
        role,
        status
    )
    values (
        invitation.organization_id,
        current_user_id,
        invitation.role,
        'active'
    )
    on conflict (
        organization_id,
        user_id
    )
    do update set
        role = excluded.role,
        status = 'active',
        updated_at = now();

    update public.organization_invites
    set accepted_at = now()
    where id = invitation.id;

    perform public.orbiq_write_audit_log(
        invitation.organization_id,
        current_user_id,
        'user',
        'team.invite_accepted',
        'organization_invite',
        invitation.id,
        null,
        jsonb_build_object(
            'email', invitation.email,
            'role', invitation.role
        )
    );

    return jsonb_build_object(
        'organization_id', invitation.organization_id,
        'organization_name', invitation.organization_name,
        'role', invitation.role
    );
end;
$$;

revoke all
on function public.accept_organization_invite(text)
from public, anon;

grant execute
on function public.accept_organization_invite(text)
to authenticated;

-- Verifica que a versão instalada não contém mais a barreira single-org.
do $verify$
declare
    function_source text;
    function_config text[];
begin
    select
        procedure_row.prosrc,
        procedure_row.proconfig
    into
        function_source,
        function_config
    from pg_proc as procedure_row
    join pg_namespace as namespace_row
        on namespace_row.oid = procedure_row.pronamespace
    where
        namespace_row.nspname = 'public'
        and procedure_row.proname = 'accept_organization_invite'
    limit 1;

    if function_source is null then
        raise exception
            'accept_organization_invite não foi instalada';
    end if;

    if position(
        'Sua conta já está vinculada a outra oficina ativa'
        in function_source
    ) > 0 then
        raise exception
            'A barreira single-org ainda está presente';
    end if;

    if not coalesce(
        'search_path=public, extensions' = any(function_config),
        false
    ) then
        raise exception
            'accept_organization_invite precisa de search_path public, extensions';
    end if;
end;
$verify$;

notify pgrst, 'reload schema';

commit;
