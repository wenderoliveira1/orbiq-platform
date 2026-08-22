begin;


-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 1.8A
--
-- CONFIGURACOES DA OFICINA
--
-- organizations:
-- identidade principal
--
-- organization_settings:
-- configuracoes e preferencias
-- ===========================================================


create table if not exists
public.organization_settings (

    organization_id uuid
        primary key
        references public.organizations(id)
        on delete cascade,

    legal_name text,

    phone text,

    whatsapp text,

    email text,

    postal_code text,

    address_line text,

    address_number text,

    address_complement text,

    district text,

    city text,

    state text,

    quote_validity_days integer
        not null
        default 7
        check (
            quote_validity_days
            between 1 and 90
        ),

    default_parts_margin_percent numeric(7,2)
        not null
        default 30
        check (
            default_parts_margin_percent
            between 0 and 1000
        ),

    default_quote_notes text,

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now()
);


comment on table
public.organization_settings
is
'Preferencias e dados configuraveis de cada oficina Orbiq';


-- ===========================================================
-- EXISTING ORGANIZATIONS
-- ===========================================================

insert into
public.organization_settings (
    organization_id
)

select
    id

from
    public.organizations

on conflict (
    organization_id
)
do nothing;


-- ===========================================================
-- UPDATED_AT
-- ===========================================================

drop trigger if exists
organization_settings_set_updated_at

on
public.organization_settings;


create trigger
organization_settings_set_updated_at

before update

on
public.organization_settings

for each row

execute function
public.set_updated_at();


-- ===========================================================
-- RLS
-- ===========================================================

alter table
public.organization_settings

enable row level security;


drop policy if exists
orbiq_organization_settings_select

on
public.organization_settings;


drop policy if exists
orbiq_organization_settings_insert

on
public.organization_settings;


drop policy if exists
orbiq_organization_settings_update

on
public.organization_settings;


drop policy if exists
orbiq_organization_settings_delete

on
public.organization_settings;


create policy
orbiq_organization_settings_select

on
public.organization_settings

for select

to authenticated

using (

    public.orbiq_has_permission(
        organization_id,
        'settings.manage'
    )
);


create policy
orbiq_organization_settings_insert

on
public.organization_settings

for insert

to authenticated

with check (

    public.orbiq_has_permission(
        organization_id,
        'settings.manage'
    )
);


create policy
orbiq_organization_settings_update

on
public.organization_settings

for update

to authenticated

using (

    public.orbiq_has_permission(
        organization_id,
        'settings.manage'
    )
)

with check (

    public.orbiq_has_permission(
        organization_id,
        'settings.manage'
    )
);


create policy
orbiq_organization_settings_delete

on
public.organization_settings

for delete

to authenticated

using (

    public.orbiq_has_permission(
        organization_id,
        'settings.manage'
    )
);


-- ===========================================================
-- DATA API GRANTS
-- ===========================================================

revoke all

on table
public.organization_settings

from public,
anon;


grant
    select,
    insert,
    update,
    delete

on table
public.organization_settings

to authenticated;


-- ===========================================================
-- RPC ATOMICA PARA SALVAR CONFIGURACOES
-- ===========================================================

create or replace function
public.update_organization_settings(

    target_org_id uuid,

    target_name text,

    target_cnpj text,

    target_legal_name text,

    target_phone text,

    target_whatsapp text,

    target_email text,

    target_postal_code text,

    target_address_line text,

    target_address_number text,

    target_address_complement text,

    target_district text,

    target_city text,

    target_state text,

    target_quote_validity_days integer,

    target_default_parts_margin_percent numeric,

    target_default_quote_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare

    clean_name text;

    clean_email text;

    clean_state text;

    validity_days integer;

    margin_percent numeric;

begin

    -- =======================================================
    -- PERMISSAO
    --
    -- Owner e Admin ja sao considerados administradores
    -- pela matriz PostgreSQL existente do Orbiq.
    -- =======================================================

    perform
        public.orbiq_assert_permission(
            target_org_id,
            'settings.manage'
        );


    -- =======================================================
    -- NOME
    -- =======================================================

    clean_name :=
        btrim(
            coalesce(
                target_name,
                ''
            )
        );


    if
        char_length(
            clean_name
        ) < 2

        or

        char_length(
            clean_name
        ) > 120
    then

        raise exception
            'Nome da oficina deve possuir entre 2 e 120 caracteres';

    end if;


    -- =======================================================
    -- EMAIL
    -- =======================================================

    clean_email :=
        nullif(
            lower(
                btrim(
                    coalesce(
                        target_email,
                        ''
                    )
                )
            ),
            ''
        );


    if
        clean_email is not null
        and
        position(
            '@'
            in
            clean_email
        ) = 0
    then

        raise exception
            'E-mail inválido';

    end if;


    -- =======================================================
    -- UF
    -- =======================================================

    clean_state :=
        nullif(
            upper(
                btrim(
                    coalesce(
                        target_state,
                        ''
                    )
                )
            ),
            ''
        );


    if
        clean_state is not null
        and
        char_length(
            clean_state
        ) <> 2
    then

        raise exception
            'UF deve possuir exatamente 2 caracteres';

    end if;


    -- =======================================================
    -- VALIDADE
    -- =======================================================

    validity_days :=
        coalesce(
            target_quote_validity_days,
            7
        );


    if
        validity_days < 1
        or
        validity_days > 90
    then

        raise exception
            'Validade do orçamento deve ficar entre 1 e 90 dias';

    end if;


    -- =======================================================
    -- MARGEM
    -- =======================================================

    margin_percent :=
        coalesce(
            target_default_parts_margin_percent,
            30
        );


    if
        margin_percent < 0
        or
        margin_percent > 1000
    then

        raise exception
            'Margem padrão inválida';

    end if;


    -- =======================================================
    -- ORGANIZATION
    -- =======================================================

    update
        public.organizations

    set
        name =
            clean_name,

        cnpj =
            nullif(
                btrim(
                    coalesce(
                        target_cnpj,
                        ''
                    )
                ),
                ''
            ),

        updated_at =
            now()

    where
        id =
            target_org_id;


    if not found
    then

        raise exception
            'Oficina não encontrada';

    end if;


    -- =======================================================
    -- SETTINGS
    -- =======================================================

    insert into
    public.organization_settings (

        organization_id,

        legal_name,

        phone,

        whatsapp,

        email,

        postal_code,

        address_line,

        address_number,

        address_complement,

        district,

        city,

        state,

        quote_validity_days,

        default_parts_margin_percent,

        default_quote_notes
    )

    values (

        target_org_id,

        nullif(
            btrim(
                coalesce(
                    target_legal_name,
                    ''
                )
            ),
            ''
        ),

        nullif(
            btrim(
                coalesce(
                    target_phone,
                    ''
                )
            ),
            ''
        ),

        nullif(
            btrim(
                coalesce(
                    target_whatsapp,
                    ''
                )
            ),
            ''
        ),

        clean_email,

        nullif(
            btrim(
                coalesce(
                    target_postal_code,
                    ''
                )
            ),
            ''
        ),

        nullif(
            btrim(
                coalesce(
                    target_address_line,
                    ''
                )
            ),
            ''
        ),

        nullif(
            btrim(
                coalesce(
                    target_address_number,
                    ''
                )
            ),
            ''
        ),

        nullif(
            btrim(
                coalesce(
                    target_address_complement,
                    ''
                )
            ),
            ''
        ),

        nullif(
            btrim(
                coalesce(
                    target_district,
                    ''
                )
            ),
            ''
        ),

        nullif(
            btrim(
                coalesce(
                    target_city,
                    ''
                )
            ),
            ''
        ),

        clean_state,

        validity_days,

        round(
            margin_percent,
            2
        ),

        nullif(
            btrim(
                coalesce(
                    target_default_quote_notes,
                    ''
                )
            ),
            ''
        )
    )

    on conflict (
        organization_id
    )

    do update

    set
        legal_name =
            excluded.legal_name,

        phone =
            excluded.phone,

        whatsapp =
            excluded.whatsapp,

        email =
            excluded.email,

        postal_code =
            excluded.postal_code,

        address_line =
            excluded.address_line,

        address_number =
            excluded.address_number,

        address_complement =
            excluded.address_complement,

        district =
            excluded.district,

        city =
            excluded.city,

        state =
            excluded.state,

        quote_validity_days =
            excluded.quote_validity_days,

        default_parts_margin_percent =
            excluded.default_parts_margin_percent,

        default_quote_notes =
            excluded.default_quote_notes,

        updated_at =
            now();


    return
        jsonb_build_object(

            'organization_id',
            target_org_id,

            'name',
            clean_name,

            'quote_validity_days',
            validity_days,

            'default_parts_margin_percent',
            round(
                margin_percent,
                2
            )
        );

end;
$$;


revoke all
on function
public.update_organization_settings(
    uuid,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    integer,
    numeric,
    text
)
from public,
anon;


grant execute
on function
public.update_organization_settings(
    uuid,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    integer,
    numeric,
    text
)
to authenticated;


-- ===========================================================
-- VALIDACAO
-- ===========================================================

do $$
begin

    if
        to_regclass(
            'public.organization_settings'
        )
        is null
    then

        raise exception
            'organization_settings não criada';

    end if;


    if
        to_regprocedure(
            'public.update_organization_settings(uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,integer,numeric,text)'
        )
        is null
    then

        raise exception
            'update_organization_settings não criada';

    end if;


    if not exists (

        select 1

        from
            public.organization_settings
    )
    then

        if exists (

            select 1

            from
                public.organizations
        )
        then

            raise exception
                'Oficinas existentes não receberam configuração inicial';

        end if;

    end if;

end;
$$;


notify pgrst, 'reload schema';


commit;