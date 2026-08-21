-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 1.6C
--
-- AUDITORIA OPERACIONAL
-- ===========================================================


create table if not exists
public.audit_logs (

    id uuid
        primary key
        default gen_random_uuid(),

    organization_id uuid
        not null
        references public.organizations(id)
        on delete cascade,

    actor_user_id uuid
        references auth.users(id)
        on delete set null,

    actor_type text
        not null
        default 'system',

    action text
        not null,

    entity_type text
        not null,

    entity_id uuid,

    quote_id uuid
        references public.quotes(id)
        on delete set null,

    metadata jsonb
        not null
        default '{}'::jsonb,

    created_at timestamptz
        not null
        default now()
);


-- ===========================================================
-- CONSTRAINT
-- ===========================================================

do $$
begin

    if not exists (

        select 1

        from
            pg_constraint

        where
            conname =
                'audit_logs_actor_type_check'

    ) then

        alter table
        public.audit_logs

        add constraint
        audit_logs_actor_type_check

        check (
            actor_type in (
                'user',
                'client',
                'system'
            )
        );

    end if;

end;
$$;


-- ===========================================================
-- INDICES
-- ===========================================================

create index if not exists
audit_logs_org_created_idx
on public.audit_logs (
    organization_id,
    created_at desc
);


create index if not exists
audit_logs_quote_created_idx
on public.audit_logs (
    quote_id,
    created_at desc
);


create index if not exists
audit_logs_actor_created_idx
on public.audit_logs (
    actor_user_id,
    created_at desc
);


create index if not exists
audit_logs_action_created_idx
on public.audit_logs (
    action,
    created_at desc
);


-- ===========================================================
-- RLS
-- ===========================================================

alter table
public.audit_logs
enable row level security;


drop policy if exists
audit_logs_select_member
on public.audit_logs;


create policy
audit_logs_select_member

on public.audit_logs

for select

to authenticated

using (
    public.is_org_member(
        organization_id
    )
);


revoke all
on table
public.audit_logs
from anon;


revoke insert,
update,
delete
on table
public.audit_logs
from authenticated;


grant select
on table
public.audit_logs
to authenticated;


-- ===========================================================
-- WRITER INTERNO
-- ===========================================================

create or replace function
public.orbiq_write_audit_log(

    target_org_id uuid,

    target_actor_user_id uuid,

    target_actor_type text,

    target_action text,

    target_entity_type text,

    target_entity_id uuid,

    target_quote_id uuid,

    target_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin

    insert into
        public.audit_logs (

            organization_id,

            actor_user_id,

            actor_type,

            action,

            entity_type,

            entity_id,

            quote_id,

            metadata

        )
    values (

        target_org_id,

        target_actor_user_id,

        case

            when target_actor_type in (
                'user',
                'client',
                'system'
            )
            then
                target_actor_type

            else
                'system'

        end,

        target_action,

        target_entity_type,

        target_entity_id,

        target_quote_id,

        coalesce(
            target_metadata,
            '{}'::jsonb
        )

    );

end;
$$;


revoke all
on function
public.orbiq_write_audit_log(
    uuid,
    uuid,
    text,
    text,
    text,
    uuid,
    uuid,
    jsonb
)
from public,
anon,
authenticated;


-- ===========================================================
-- ORCAMENTOS
-- ===========================================================

create or replace function
public.orbiq_audit_quotes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare

    current_actor uuid;

    current_actor_type text;

begin

    current_actor :=
        coalesce(
            auth.uid(),
            new.created_by
        );


    current_actor_type :=
        case

            when current_actor is null
            then
                'system'

            else
                'user'

        end;


    -- =======================================================
    -- CRIACAO
    -- =======================================================

    if
        tg_op =
            'INSERT'
    then

        perform
            public.orbiq_write_audit_log(

                new.organization_id,

                current_actor,

                current_actor_type,

                'quote.created',

                'quote',

                new.id,

                new.id,

                jsonb_build_object(

                    'protocol',
                    new.protocol,

                    'status',
                    new.status,

                    'commercial_status',
                    new.commercial_status,

                    'priority',
                    new.priority

                )

            );


        return new;

    end if;


    -- =======================================================
    -- STATUS OPERACIONAL
    -- =======================================================

    if
        old.status
        is distinct from
        new.status
    then

        perform
            public.orbiq_write_audit_log(

                new.organization_id,

                auth.uid(),

                case

                    when auth.uid() is null
                    then
                        'system'

                    else
                        'user'

                end,

                'quote.status_changed',

                'quote',

                new.id,

                new.id,

                jsonb_build_object(

                    'protocol',
                    new.protocol,

                    'from',
                    old.status,

                    'to',
                    new.status

                )

            );

    end if;


    -- =======================================================
    -- COMERCIAL
    -- =======================================================

    if
        old.commercial_status
        is distinct from
        new.commercial_status
    then

        current_actor_type :=
            case

                when
                    auth.uid() is null

                    and
                    old.commercial_status =
                        'ready'

                    and
                    new.commercial_status in (
                        'approved',
                        'rejected'
                    )

                then
                    'client'

                when
                    auth.uid() is not null

                then
                    'user'

                else
                    'system'

            end;


        perform
            public.orbiq_write_audit_log(

                new.organization_id,

                auth.uid(),

                current_actor_type,

                'quote.commercial_status_changed',

                'quote',

                new.id,

                new.id,

                jsonb_build_object(

                    'protocol',
                    new.protocol,

                    'from',
                    old.commercial_status,

                    'to',
                    new.commercial_status,

                    'final_amount',
                    new.final_amount,

                    'rejection_reason',
                    new.commercial_rejection_reason

                )

            );

    end if;


    return new;

end;
$$;


drop trigger if exists
orbiq_audit_quotes_trigger
on public.quotes;


create trigger
orbiq_audit_quotes_trigger

after insert or update

on public.quotes

for each row

execute function
public.orbiq_audit_quotes();


-- ===========================================================
-- FORNECEDOR ESCOLHIDO
-- ===========================================================

create or replace function
public.orbiq_audit_supplier_award()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare

    target_quote uuid;

begin

    if
        new.awarded =
            true

        and
        (
            tg_op =
                'INSERT'

            or

            old.awarded
            is distinct from
            true
        )
    then

        select
            quote_id

        into
            target_quote

        from
            public.quote_items

        where
            id =
                new.quote_item_id

            and
            organization_id =
                new.organization_id;


        perform
            public.orbiq_write_audit_log(

                new.organization_id,

                auth.uid(),

                case
                    when auth.uid() is null
                    then 'system'
                    else 'user'
                end,

                'supplier.awarded',

                'quote_supplier_item_response',

                new.id,

                target_quote,

                jsonb_build_object(

                    'quote_item_id',
                    new.quote_item_id,

                    'request_id',
                    new.request_id,

                    'unit_price',
                    new.unit_price,

                    'total_price',
                    new.total_price,

                    'brand_option',
                    new.brand_option,

                    'delivery',
                    new.delivery

                )

            );

    end if;


    return new;

end;
$$;


drop trigger if exists
orbiq_audit_supplier_award_trigger
on public.quote_supplier_item_responses;


create trigger
orbiq_audit_supplier_award_trigger

after insert or update

on public.quote_supplier_item_responses

for each row

execute function
public.orbiq_audit_supplier_award();


-- ===========================================================
-- PEDIDOS DE COMPRA
-- ===========================================================

create or replace function
public.orbiq_audit_purchase_orders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

    if
        tg_op =
            'INSERT'
    then

        perform
            public.orbiq_write_audit_log(

                new.organization_id,

                auth.uid(),

                case
                    when auth.uid() is null
                    then 'system'
                    else 'user'
                end,

                'purchase.created',

                'purchase_order',

                new.id,

                new.quote_id,

                jsonb_build_object(

                    'code',
                    new.code,

                    'status',
                    new.status,

                    'supplier_id',
                    new.supplier_id,

                    'total_amount',
                    new.total_amount

                )

            );


        return new;

    end if;


    if
        old.status
        is distinct from
        new.status
    then

        perform
            public.orbiq_write_audit_log(

                new.organization_id,

                auth.uid(),

                case
                    when auth.uid() is null
                    then 'system'
                    else 'user'
                end,

                'purchase.status_changed',

                'purchase_order',

                new.id,

                new.quote_id,

                jsonb_build_object(

                    'code',
                    new.code,

                    'from',
                    old.status,

                    'to',
                    new.status,

                    'total_amount',
                    new.total_amount

                )

            );

    end if;


    return new;

end;
$$;


drop trigger if exists
orbiq_audit_purchase_orders_trigger
on public.purchase_orders;


create trigger
orbiq_audit_purchase_orders_trigger

after insert or update

on public.purchase_orders

for each row

execute function
public.orbiq_audit_purchase_orders();


-- ===========================================================
-- ORDENS DE SERVICO
-- ===========================================================

create or replace function
public.orbiq_audit_work_orders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

    if
        tg_op =
            'INSERT'
    then

        perform
            public.orbiq_write_audit_log(

                new.organization_id,

                auth.uid(),

                case
                    when auth.uid() is null
                    then 'system'
                    else 'user'
                end,

                'work_order.created',

                'work_order',

                new.id,

                new.quote_id,

                jsonb_build_object(

                    'code',
                    new.code,

                    'status',
                    new.status

                )

            );


        return new;

    end if;


    if
        old.status
        is distinct from
        new.status
    then

        perform
            public.orbiq_write_audit_log(

                new.organization_id,

                auth.uid(),

                case
                    when auth.uid() is null
                    then 'system'
                    else 'user'
                end,

                'work_order.status_changed',

                'work_order',

                new.id,

                new.quote_id,

                jsonb_build_object(

                    'code',
                    new.code,

                    'from',
                    old.status,

                    'to',
                    new.status

                )

            );

    end if;


    return new;

end;
$$;


drop trigger if exists
orbiq_audit_work_orders_trigger
on public.work_orders;


create trigger
orbiq_audit_work_orders_trigger

after insert or update

on public.work_orders

for each row

execute function
public.orbiq_audit_work_orders();


-- ===========================================================
-- LINKS PUBLICOS
-- ===========================================================

create or replace function
public.orbiq_audit_public_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

    if
        tg_op =
            'INSERT'
    then

        perform
            public.orbiq_write_audit_log(

                new.organization_id,

                coalesce(
                    auth.uid(),
                    new.created_by
                ),

                case

                    when
                        coalesce(
                            auth.uid(),
                            new.created_by
                        )
                        is null

                    then
                        'system'

                    else
                        'user'

                end,

                'public_link.created',

                'quote_public_link',

                new.id,

                new.quote_id,

                jsonb_build_object(

                    'expires_at',
                    new.expires_at

                )

            );


        return new;

    end if;


    if
        old.revoked_at is null

        and
        new.revoked_at is not null
    then

        perform
            public.orbiq_write_audit_log(

                new.organization_id,

                auth.uid(),

                case
                    when auth.uid() is null
                    then 'system'
                    else 'user'
                end,

                'public_link.revoked',

                'quote_public_link',

                new.id,

                new.quote_id,

                jsonb_build_object(

                    'revoked_at',
                    new.revoked_at

                )

            );

    end if;


    return new;

end;
$$;


drop trigger if exists
orbiq_audit_public_links_trigger
on public.quote_public_links;


create trigger
orbiq_audit_public_links_trigger

after insert or update

on public.quote_public_links

for each row

execute function
public.orbiq_audit_public_links();


notify pgrst, 'reload schema';