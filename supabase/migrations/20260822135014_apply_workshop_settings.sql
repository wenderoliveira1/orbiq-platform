begin;


-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 1.8B
--
-- CONFIGURACOES APLICADAS AO PRODUTO
--
-- NAO REESCREVE:
-- public_get_quote
-- create_quote_public_link
--
-- ===========================================================


-- ===========================================================
-- DEFAULTS COMERCIAIS
--
-- Somente quem possui commercial.manage.
-- ===========================================================

create or replace function
public.get_organization_commercial_defaults(

    target_org_id uuid
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

    perform
        public.orbiq_assert_permission(
            target_org_id,
            'commercial.manage'
        );


    select
        jsonb_build_object(

            'default_parts_margin_percent',
            coalesce(
                settings_row.default_parts_margin_percent,
                30
            )
        )

    into
        result

    from
        public.organizations
            as organization_row

    left join
        public.organization_settings
            as settings_row

        on
            settings_row.organization_id =
                organization_row.id

    where
        organization_row.id =
            target_org_id;


    if result is null then

        raise exception
            'Oficina não encontrada';

    end if;


    return result;

end;
$$;


revoke all
on function
public.get_organization_commercial_defaults(
    uuid
)
from public,
anon;


grant execute
on function
public.get_organization_commercial_defaults(
    uuid
)
to authenticated;


-- ===========================================================
-- PERFIL DE DOCUMENTO INTERNO
--
-- Dados seguros para os membros que podem consultar
-- orcamentos.
--
-- NAO inclui margem de pecas.
-- ===========================================================

create or replace function
public.get_organization_document_profile(

    target_org_id uuid
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

    perform
        public.orbiq_assert_permission(
            target_org_id,
            'quotes.view'
        );


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
            settings_row.default_quote_notes
        )

    into
        result

    from
        public.organizations
            as organization_row

    left join
        public.organization_settings
            as settings_row

        on
            settings_row.organization_id =
                organization_row.id

    where
        organization_row.id =
            target_org_id;


    if result is null then

        raise exception
            'Oficina não encontrada';

    end if;


    return result;

end;
$$;


revoke all
on function
public.get_organization_document_profile(
    uuid
)
from public,
anon;


grant execute
on function
public.get_organization_document_profile(
    uuid
)
to authenticated;


-- ===========================================================
-- VALIDADE DOS NOVOS LINKS
--
-- A funcao original de criar link continua intacta.
--
-- O trigger apenas ajusta expires_at durante INSERT.
-- Links antigos nao sao modificados.
-- ===========================================================

create or replace function
public.orbiq_apply_quote_link_validity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare

    validity_days integer;

begin

    select
        settings_row.quote_validity_days

    into
        validity_days

    from
        public.organization_settings
            as settings_row

    where
        settings_row.organization_id =
            new.organization_id;


    validity_days :=
        greatest(
            1,
            least(
                90,
                coalesce(
                    validity_days,
                    7
                )
            )
        );


    new.expires_at :=
        now() +
        make_interval(
            days =>
                validity_days
        );


    return new;

end;
$$;


revoke all
on function
public.orbiq_apply_quote_link_validity()
from public,
anon,
authenticated;


drop trigger if exists
orbiq_quote_public_link_validity

on
public.quote_public_links;


create trigger
orbiq_quote_public_link_validity

before insert

on
public.quote_public_links

for each row

execute function
public.orbiq_apply_quote_link_validity();


-- ===========================================================
-- PERFIL PUBLICO DA OFICINA
--
-- Autorizacao baseada no proprio token valido.
--
-- Nao entrega fornecedores, custos, margens,
-- usuarios ou informacoes internas.
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
            settings_row.default_quote_notes
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
        link_row.expires_at >
            now()

    limit 1;


    return result;

end;
$$;


revoke all
on function
public.public_get_workshop_profile(
    text
)
from public;


grant execute
on function
public.public_get_workshop_profile(
    text
)
to anon,
authenticated;


-- ===========================================================
-- VALIDACAO
-- ===========================================================

do $$
begin

    if
        to_regprocedure(
            'public.get_organization_commercial_defaults(uuid)'
        )
        is null
    then

        raise exception
            'get_organization_commercial_defaults não criada';

    end if;


    if
        to_regprocedure(
            'public.get_organization_document_profile(uuid)'
        )
        is null
    then

        raise exception
            'get_organization_document_profile não criada';

    end if;


    if
        to_regprocedure(
            'public.public_get_workshop_profile(text)'
        )
        is null
    then

        raise exception
            'public_get_workshop_profile não criada';

    end if;


    if not exists (

        select 1

        from
            pg_trigger
                as trigger_row

        join
            pg_class
                as relation_row

            on
                relation_row.oid =
                    trigger_row.tgrelid

        join
            pg_namespace
                as namespace_row

            on
                namespace_row.oid =
                    relation_row.relnamespace

        where
            namespace_row.nspname =
                'public'

            and
            relation_row.relname =
                'quote_public_links'

            and
            trigger_row.tgname =
                'orbiq_quote_public_link_validity'

            and
            not trigger_row.tgisinternal
    )
    then

        raise exception
            'Trigger de validade não criado';

    end if;

end;
$$;


notify pgrst, 'reload schema';


commit;