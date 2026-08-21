-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 1.7A
--
-- EQUIPE + CONVITES + CARGOS
-- ===========================================================


create table if not exists
public.organization_invites (

    id uuid
        primary key
        default gen_random_uuid(),

    organization_id uuid
        not null
        references public.organizations(id)
        on delete cascade,

    email text
        not null,

    role text
        not null
        check (
            role in (
                'admin',
                'manager',
                'estimator',
                'technician',
                'viewer'
            )
        ),

    token_hash text
        not null
        unique,

    expires_at timestamptz
        not null,

    accepted_at timestamptz,

    revoked_at timestamptz,

    invited_by uuid
        references auth.users(id)
        on delete set null,

    created_at timestamptz
        not null
        default now()
);


create index if not exists
organization_invites_org_created_idx

on public.organization_invites (
    organization_id,
    created_at desc
);


create index if not exists
organization_invites_email_idx

on public.organization_invites (
    organization_id,
    lower(email)
);


alter table
public.organization_invites
enable row level security;


revoke all
on table
public.organization_invites
from anon,
authenticated;


-- ===========================================================
-- ROLE ATUAL
-- ===========================================================

create or replace function
public.orbiq_current_org_role(

    target_org_id uuid
)
returns text
language sql
stable
security definer
set search_path = public
as $$

    select
        member.role

    from
        public.organization_members
            as member

    where
        member.organization_id =
            target_org_id

        and
        member.user_id =
            auth.uid()

        and
        member.status =
            'active'

    limit 1;

$$;


revoke all
on function
public.orbiq_current_org_role(
    uuid
)
from public,
anon;


grant execute
on function
public.orbiq_current_org_role(
    uuid
)
to authenticated;


-- ===========================================================
-- LISTAR EQUIPE
-- ===========================================================

create or replace function
public.list_organization_team(

    target_org_id uuid
)
returns table (

    user_id uuid,

    full_name text,

    email text,

    phone text,

    role text,

    status text,

    joined_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin

    if
        auth.uid() is null
    then

        raise exception
            'Authentication required';

    end if;


    if not public.is_org_member(
        target_org_id
    ) then

        raise exception
            'User does not belong to organization';

    end if;


    return query

    select

        member.user_id,

        coalesce(
            nullif(
                btrim(
                    profile.full_name
                ),
                ''
            ),
            split_part(
                auth_user.email,
                '@',
                1
            ),
            'Usuario'
        )
            as full_name,

        auth_user.email::text,

        profile.phone,

        member.role,

        member.status,

        member.created_at
            as joined_at

    from
        public.organization_members
            as member

    left join
        public.profiles
            as profile

        on
            profile.user_id =
                member.user_id

    left join
        auth.users
            as auth_user

        on
            auth_user.id =
                member.user_id

    where
        member.organization_id =
            target_org_id

    order by

        case
            when member.role = 'owner' then 0
            when member.role = 'admin' then 1
            when member.role = 'manager' then 2
            when member.role = 'estimator' then 3
            when member.role = 'technician' then 4
            else 5
        end,

        lower(
            coalesce(
                profile.full_name,
                auth_user.email,
                ''
            )
        );

end;
$$;


revoke all
on function
public.list_organization_team(
    uuid
)
from public,
anon;


grant execute
on function
public.list_organization_team(
    uuid
)
to authenticated;


-- ===========================================================
-- LISTAR CONVITES
-- SOMENTE OWNER / ADMIN
-- ===========================================================

create or replace function
public.list_organization_invites(

    target_org_id uuid
)
returns table (

    invite_id uuid,

    email text,

    role text,

    expires_at timestamptz,

    created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare

    actor_role text;

begin

    actor_role :=
        public.orbiq_current_org_role(
            target_org_id
        );


    if
        actor_role not in (
            'owner',
            'admin'
        )
    then

        raise exception
            'Permission denied';

    end if;


    return query

    select

        invitation.id,

        invitation.email,

        invitation.role,

        invitation.expires_at,

        invitation.created_at

    from
        public.organization_invites
            as invitation

    where
        invitation.organization_id =
            target_org_id

        and
        invitation.accepted_at is null

        and
        invitation.revoked_at is null

        and
        invitation.expires_at >
            now()

    order by
        invitation.created_at desc;

end;
$$;


revoke all
on function
public.list_organization_invites(
    uuid
)
from public,
anon;


grant execute
on function
public.list_organization_invites(
    uuid
)
to authenticated;


-- ===========================================================
-- CRIAR CONVITE
-- ===========================================================

create or replace function
public.create_organization_invite(

    target_org_id uuid,

    target_email text,

    target_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare

    actor_role text;

    clean_email text;

    clean_role text;

    raw_token text;

    hashed_token text;

    new_invite_id uuid;

    new_expires_at timestamptz;

    existing_user_id uuid;

begin

    if
        auth.uid() is null
    then

        raise exception
            'Authentication required';

    end if;


    actor_role :=
        public.orbiq_current_org_role(
            target_org_id
        );


    if
        actor_role not in (
            'owner',
            'admin'
        )
    then

        raise exception
            'Apenas proprietário ou administrador pode convidar funcionários.';

    end if;


    clean_email :=
        lower(
            btrim(
                coalesce(
                    target_email,
                    ''
                )
            )
        );


    clean_role :=
        lower(
            btrim(
                coalesce(
                    target_role,
                    ''
                )
            )
        );


    if
        clean_email = ''
        or
        position(
            '@'
            in clean_email
        ) <=
        1
    then

        raise exception
            'Informe um e-mail válido.';

    end if;


    if
        clean_role not in (
            'admin',
            'manager',
            'estimator',
            'technician',
            'viewer'
        )
    then

        raise exception
            'Cargo inválido.';

    end if;


    if
        actor_role =
            'admin'

        and
        clean_role =
            'admin'
    then

        raise exception
            'Somente o proprietário pode adicionar outro administrador.';

    end if;


    select
        auth_user.id

    into
        existing_user_id

    from
        auth.users
            as auth_user

    where
        lower(
            auth_user.email
        ) =
        clean_email

    limit 1;


    if
        existing_user_id is not null

        and
        exists (

            select 1

            from
                public.organization_members
                    as member

            where
                member.organization_id =
                    target_org_id

                and
                member.user_id =
                    existing_user_id

                and
                member.status =
                    'active'

        )
    then

        raise exception
            'Este usuário já faz parte da equipe.';

    end if;


    -- Revoga convites anteriores para o mesmo e-mail.

    update
        public.organization_invites

    set
        revoked_at =
            now()

    where
        organization_id =
            target_org_id

        and
        lower(email) =
            clean_email

        and
        accepted_at is null

        and
        revoked_at is null;


    -- 32 bytes = 256 bits.
    -- O banco salva somente o SHA-256.

    raw_token :=
        encode(
            gen_random_bytes(
                32
            ),
            'hex'
        );


    hashed_token :=
        encode(
            digest(
                raw_token,
                'sha256'
            ),
            'hex'
        );


    new_expires_at :=
        now() +
        interval '7 days';


    insert into
        public.organization_invites (

            organization_id,

            email,

            role,

            token_hash,

            expires_at,

            invited_by

        )
    values (

        target_org_id,

        clean_email,

        clean_role,

        hashed_token,

        new_expires_at,

        auth.uid()

    )

    returning
        id

    into
        new_invite_id;


    perform
        public.orbiq_write_audit_log(

            target_org_id,

            auth.uid(),

            'user',

            'team.invite_created',

            'organization_invite',

            new_invite_id,

            null,

            jsonb_build_object(

                'email',
                clean_email,

                'role',
                clean_role,

                'expires_at',
                new_expires_at

            )

        );


    return
        jsonb_build_object(

            'invite_id',
            new_invite_id,

            'token',
            raw_token,

            'expires_at',
            new_expires_at

        );

end;
$$;


revoke all
on function
public.create_organization_invite(
    uuid,
    text,
    text
)
from public,
anon;


grant execute
on function
public.create_organization_invite(
    uuid,
    text,
    text
)
to authenticated;


-- ===========================================================
-- DADOS PUBLICOS DO CONVITE
-- ===========================================================

create or replace function
public.public_get_organization_invite(

    target_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare

    invitation record;

    target_hash text;

    invitation_state text;

begin

    if
        target_token is null
        or
        char_length(
            btrim(
                target_token
            )
        ) <
        32
    then

        return null;

    end if;


    target_hash :=
        encode(
            digest(
                btrim(
                    target_token
                ),
                'sha256'
            ),
            'hex'
        );


    select

        invite.id,

        invite.email,

        invite.role,

        invite.expires_at,

        invite.accepted_at,

        invite.revoked_at,

        organization.name
            as organization_name

    into
        invitation

    from
        public.organization_invites
            as invite

    join
        public.organizations
            as organization

        on
            organization.id =
                invite.organization_id

    where
        invite.token_hash =
            target_hash

    limit 1;


    if not found then

        return null;

    end if;


    invitation_state :=
        case

            when
                invitation.accepted_at is not null
            then
                'accepted'

            when
                invitation.revoked_at is not null
            then
                'revoked'

            when
                invitation.expires_at <= now()
            then
                'expired'

            else
                'pending'

        end;


    return
        jsonb_build_object(

            'organization_name',
            invitation.organization_name,

            'email',
            invitation.email,

            'role',
            invitation.role,

            'expires_at',
            invitation.expires_at,

            'state',
            invitation_state

        );

end;
$$;


revoke all
on function
public.public_get_organization_invite(
    text
)
from public;


grant execute
on function
public.public_get_organization_invite(
    text
)
to anon,
authenticated;


-- ===========================================================
-- ACEITAR CONVITE
-- ===========================================================

create or replace function
public.accept_organization_invite(

    target_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare

    invitation record;

    target_hash text;

    current_user_id uuid;

    current_email text;

begin

    current_user_id :=
        auth.uid();


    if
        current_user_id is null
    then

        raise exception
            'Faça login antes de aceitar o convite.';

    end if;


    select
        lower(
            auth_user.email
        )

    into
        current_email

    from
        auth.users
            as auth_user

    where
        auth_user.id =
            current_user_id;


    target_hash :=
        encode(
            digest(
                btrim(
                    coalesce(
                        target_token,
                        ''
                    )
                ),
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

        organization.name
            as organization_name

    into
        invitation

    from
        public.organization_invites
            as invite

    join
        public.organizations
            as organization

        on
            organization.id =
                invite.organization_id

    where
        invite.token_hash =
            target_hash

        and
        invite.accepted_at is null

        and
        invite.revoked_at is null

        and
        invite.expires_at >
            now()

    for update;


    if not found then

        raise exception
            'Este convite é inválido, expirou ou já foi utilizado.';

    end if;


    if
        current_email is null

        or
        current_email <>
        lower(
            invitation.email
        )
    then

        raise exception
            'Este convite pertence a outro endereço de e-mail.';

    end if;


    -- Enquanto nao existe seletor de oficinas,
    -- evitamos vincular silenciosamente um usuario
    -- que ja esta ativo em outra empresa.

    if exists (

        select 1

        from
            public.organization_members
                as existing_member

        where
            existing_member.user_id =
                current_user_id

            and
            existing_member.status =
                'active'

            and
            existing_member.organization_id <>
                invitation.organization_id

    )
    then

        raise exception
            'Sua conta já está vinculada a outra oficina ativa.';

    end if;


    insert into
        public.organization_members (

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

        role =
            excluded.role,

        status =
            'active',

        updated_at =
            now();


    update
        public.organization_invites

    set
        accepted_at =
            now()

    where
        id =
            invitation.id;


    perform
        public.orbiq_write_audit_log(

            invitation.organization_id,

            current_user_id,

            'user',

            'team.invite_accepted',

            'organization_invite',

            invitation.id,

            null,

            jsonb_build_object(

                'email',
                invitation.email,

                'role',
                invitation.role

            )

        );


    return
        jsonb_build_object(

            'organization_id',
            invitation.organization_id,

            'organization_name',
            invitation.organization_name,

            'role',
            invitation.role

        );

end;
$$;


revoke all
on function
public.accept_organization_invite(
    text
)
from public,
anon;


grant execute
on function
public.accept_organization_invite(
    text
)
to authenticated;


-- ===========================================================
-- ALTERAR CARGO
-- ===========================================================

create or replace function
public.update_organization_member_role(

    target_org_id uuid,

    target_user_id uuid,

    target_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare

    actor_role text;

    current_target_role text;

    clean_role text;

begin

    actor_role :=
        public.orbiq_current_org_role(
            target_org_id
        );


    if
        actor_role not in (
            'owner',
            'admin'
        )
    then

        raise exception
            'Você não tem permissão para alterar cargos.';

    end if;


    if
        target_user_id =
            auth.uid()
    then

        raise exception
            'Você não pode alterar o próprio cargo por esta tela.';

    end if;


    clean_role :=
        lower(
            btrim(
                coalesce(
                    target_role,
                    ''
                )
            )
        );


    if
        clean_role not in (
            'admin',
            'manager',
            'estimator',
            'technician',
            'viewer'
        )
    then

        raise exception
            'Cargo inválido.';

    end if;


    select
        member.role

    into
        current_target_role

    from
        public.organization_members
            as member

    where
        member.organization_id =
            target_org_id

        and
        member.user_id =
            target_user_id;


    if
        current_target_role is null
    then

        raise exception
            'Funcionário não encontrado.';

    end if;


    if
        current_target_role =
            'owner'
    then

        raise exception
            'O proprietário da oficina não pode ter o cargo alterado.';

    end if;


    if
        actor_role =
            'admin'

        and
        (
            current_target_role =
                'admin'

            or

            clean_role =
                'admin'
        )
    then

        raise exception
            'Somente o proprietário pode gerenciar administradores.';

    end if;


    update
        public.organization_members

    set
        role =
            clean_role,

        updated_at =
            now()

    where
        organization_id =
            target_org_id

        and
        user_id =
            target_user_id;


    perform
        public.orbiq_write_audit_log(

            target_org_id,

            auth.uid(),

            'user',

            'team.role_changed',

            'organization_member',

            target_user_id,

            null,

            jsonb_build_object(

                'from',
                current_target_role,

                'to',
                clean_role

            )

        );

end;
$$;


revoke all
on function
public.update_organization_member_role(
    uuid,
    uuid,
    text
)
from public,
anon;


grant execute
on function
public.update_organization_member_role(
    uuid,
    uuid,
    text
)
to authenticated;


-- ===========================================================
-- ATIVAR / DESATIVAR
-- ===========================================================

create or replace function
public.set_organization_member_status(

    target_org_id uuid,

    target_user_id uuid,

    target_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare

    actor_role text;

    current_target_role text;

    current_target_status text;

    clean_status text;

begin

    actor_role :=
        public.orbiq_current_org_role(
            target_org_id
        );


    if
        actor_role not in (
            'owner',
            'admin'
        )
    then

        raise exception
            'Você não tem permissão para alterar funcionários.';

    end if;


    if
        target_user_id =
            auth.uid()
    then

        raise exception
            'Você não pode desativar o próprio acesso.';

    end if;


    clean_status :=
        lower(
            btrim(
                coalesce(
                    target_status,
                    ''
                )
            )
        );


    if
        clean_status not in (
            'active',
            'disabled'
        )
    then

        raise exception
            'Status inválido.';

    end if;


    select

        member.role,

        member.status

    into

        current_target_role,

        current_target_status

    from
        public.organization_members
            as member

    where
        member.organization_id =
            target_org_id

        and
        member.user_id =
            target_user_id;


    if
        current_target_role is null
    then

        raise exception
            'Funcionário não encontrado.';

    end if;


    if
        current_target_role =
            'owner'
    then

        raise exception
            'O proprietário da oficina não pode ser desativado.';

    end if;


    if
        actor_role =
            'admin'

        and
        current_target_role =
            'admin'
    then

        raise exception
            'Somente o proprietário pode gerenciar outro administrador.';

    end if;


    update
        public.organization_members

    set
        status =
            clean_status,

        updated_at =
            now()

    where
        organization_id =
            target_org_id

        and
        user_id =
            target_user_id;


    perform
        public.orbiq_write_audit_log(

            target_org_id,

            auth.uid(),

            'user',

            'team.status_changed',

            'organization_member',

            target_user_id,

            null,

            jsonb_build_object(

                'from',
                current_target_status,

                'to',
                clean_status

            )

        );

end;
$$;


revoke all
on function
public.set_organization_member_status(
    uuid,
    uuid,
    text
)
from public,
anon;


grant execute
on function
public.set_organization_member_status(
    uuid,
    uuid,
    text
)
to authenticated;


-- ===========================================================
-- REVOGAR CONVITE
-- ===========================================================

create or replace function
public.revoke_organization_invite(

    target_org_id uuid,

    target_invite_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare

    actor_role text;

    invite_email text;

begin

    actor_role :=
        public.orbiq_current_org_role(
            target_org_id
        );


    if
        actor_role not in (
            'owner',
            'admin'
        )
    then

        raise exception
            'Você não tem permissão para revogar convites.';

    end if;


    select
        invitation.email

    into
        invite_email

    from
        public.organization_invites
            as invitation

    where
        invitation.id =
            target_invite_id

        and
        invitation.organization_id =
            target_org_id

        and
        invitation.accepted_at is null

        and
        invitation.revoked_at is null;


    if
        invite_email is null
    then

        raise exception
            'Convite não encontrado ou já encerrado.';

    end if;


    update
        public.organization_invites

    set
        revoked_at =
            now()

    where
        id =
            target_invite_id

        and
        organization_id =
            target_org_id;


    perform
        public.orbiq_write_audit_log(

            target_org_id,

            auth.uid(),

            'user',

            'team.invite_revoked',

            'organization_invite',

            target_invite_id,

            null,

            jsonb_build_object(

                'email',
                invite_email

            )

        );

end;
$$;


revoke all
on function
public.revoke_organization_invite(
    uuid,
    uuid
)
from public,
anon;


grant execute
on function
public.revoke_organization_invite(
    uuid,
    uuid
)
to authenticated;


notify pgrst, 'reload schema';