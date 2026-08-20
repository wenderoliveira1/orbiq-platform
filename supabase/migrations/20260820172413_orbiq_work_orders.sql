-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 1.4B
--
-- ORDEM DE SERVICO + EXECUCAO
-- ===========================================================


-- ===========================================================
-- ORDEM DE SERVICO
-- ===========================================================

create table if not exists
public.work_orders (

    id uuid
        primary key
        default gen_random_uuid(),

    organization_id uuid
        not null
        references public.organizations(id)
        on delete cascade,

    quote_id uuid
        not null
        references public.quotes(id)
        on delete cascade,

    code text
        not null
        default (
            'OS-' ||
            upper(
                substr(
                    replace(
                        gen_random_uuid()::text,
                        '-',
                        ''
                    ),
                    1,
                    8
                )
            )
        ),

    status text
        not null
        default 'pending'
        check (
            status in (
                'pending',
                'in_progress',
                'completed',
                'cancelled'
            )
        ),

    started_at timestamptz,

    completed_at timestamptz,

    notes text,

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now(),

    unique (
        organization_id,
        quote_id
    ),

    unique (
        organization_id,
        code
    )
);


-- ===========================================================
-- SERVICOS DA ORDEM DE SERVICO
-- ===========================================================

create table if not exists
public.work_order_services (

    id uuid
        primary key
        default gen_random_uuid(),

    organization_id uuid
        not null
        references public.organizations(id)
        on delete cascade,

    work_order_id uuid
        not null
        references public.work_orders(id)
        on delete cascade,

    quote_service_id uuid
        references public.quote_services(id)
        on delete set null,

    labor_service_id uuid
        references public.labor_services(id)
        on delete set null,

    category text,

    description text
        not null,

    labor_amount numeric(12,2)
        not null
        default 0
        check (
            labor_amount >= 0
        ),

    needs_part boolean
        not null
        default false,

    status text
        not null
        default 'pending'
        check (
            status in (
                'pending',
                'in_progress',
                'completed'
            )
        ),

    notes text,

    started_at timestamptz,

    completed_at timestamptz,

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now(),

    unique (
        work_order_id,
        quote_service_id
    )
);


-- ===========================================================
-- INDICES
-- ===========================================================

create index if not exists
work_orders_org_status_idx
on public.work_orders (
    organization_id,
    status
);


create index if not exists
work_orders_quote_idx
on public.work_orders (
    organization_id,
    quote_id
);


create index if not exists
work_order_services_order_idx
on public.work_order_services (
    organization_id,
    work_order_id
);


create index if not exists
work_order_services_status_idx
on public.work_order_services (
    organization_id,
    status
);


create index if not exists
work_order_services_labor_idx
on public.work_order_services (
    labor_service_id
);


-- ===========================================================
-- UPDATED_AT
-- ===========================================================

create or replace function
public.orbiq_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin

    new.updated_at :=
        now();

    return new;

end;
$$;


drop trigger if exists
orbiq_work_orders_updated_at
on public.work_orders;


create trigger
orbiq_work_orders_updated_at
before update
on public.work_orders
for each row
execute function
public.orbiq_set_updated_at();


drop trigger if exists
orbiq_work_order_services_updated_at
on public.work_order_services;


create trigger
orbiq_work_order_services_updated_at
before update
on public.work_order_services
for each row
execute function
public.orbiq_set_updated_at();


-- ===========================================================
-- RLS
-- ===========================================================

alter table
public.work_orders
enable row level security;


alter table
public.work_order_services
enable row level security;


drop policy if exists
orbiq_work_orders_member_all
on public.work_orders;


create policy
orbiq_work_orders_member_all
on public.work_orders
for all
to authenticated
using (
    (
        select
        public.is_org_member(
            organization_id
        )
    )
)
with check (
    (
        select
        public.is_org_member(
            organization_id
        )
    )
);


drop policy if exists
orbiq_work_order_services_member_all
on public.work_order_services;


create policy
orbiq_work_order_services_member_all
on public.work_order_services
for all
to authenticated
using (
    (
        select
        public.is_org_member(
            organization_id
        )
    )
)
with check (
    (
        select
        public.is_org_member(
            organization_id
        )
    )
);


-- ===========================================================
-- GRANTS
-- ===========================================================

grant
    select,
    insert,
    update,
    delete
on table
public.work_orders
to authenticated;


grant
    select,
    insert,
    update,
    delete
on table
public.work_order_services
to authenticated;


-- ===========================================================
-- SINCRONIZAR ORCAMENTO -> ORDEM DE SERVICO
--
-- 1 OS por orçamento.
--
-- Se o serviço do orçamento possuir o mesmo nome/categoria
-- de uma mão de obra ativa, o vínculo é automático.
--
-- Se não encontrar:
-- fica sem labor_service_id e o usuário pode escolher
-- manualmente na tela da OS.
-- ===========================================================

create or replace function
public.sync_quote_work_order(

    target_org_id uuid,

    target_quote_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare

    quote_status text;

    work_order_uuid uuid;

    service_record record;

    selected_labor_id uuid;

    selected_labor_amount numeric;

    matched_labor_id uuid;

    matched_labor_amount numeric;

begin

    -- =======================================================
    -- AUTH
    -- =======================================================

    if auth.uid() is null then

        raise exception
            'Authentication required';

    end if;


    if not public.is_org_member(
        target_org_id
    ) then

        raise exception
            'User does not belong to organization';

    end if;


    -- =======================================================
    -- ORCAMENTO
    -- =======================================================

    select
        status

    into
        quote_status

    from
        public.quotes

    where
        id =
            target_quote_id

        and
        organization_id =
            target_org_id;


    if
        quote_status is null
    then

        raise exception
            'Quote not found';

    end if;


    if
        quote_status =
            'rejected'
    then

        raise exception
            'Rejected quote cannot generate work order';

    end if;


    -- =======================================================
    -- PRECISA TER SERVICO
    -- =======================================================

    if not exists (

        select 1

        from
            public.quote_services

        where
            organization_id =
                target_org_id

            and
            quote_id =
                target_quote_id

    ) then

        raise exception
            'Quote has no services';

    end if;


    -- =======================================================
    -- CRIAR / RECUPERAR OS
    -- =======================================================

    insert into
        public.work_orders (

            organization_id,

            quote_id,

            status

        )
    values (

        target_org_id,

        target_quote_id,

        case

            when
                quote_status =
                    'completed'
            then
                'completed'

            else
                'pending'

        end

    )

    on conflict (
        organization_id,
        quote_id
    )
    do update
    set
        status =
            case

                when
                    public.work_orders.status =
                        'completed'
                then
                    'completed'

                when
                    quote_status =
                        'completed'
                then
                    'completed'

                else
                    public.work_orders.status

            end

    returning
        id

    into
        work_order_uuid;


    -- =======================================================
    -- COPIAR SERVICOS
    -- =======================================================

    for service_record in

        select
            quote_service.id,

            quote_service.category,

            quote_service.description,

            quote_service.needs_part,

            quote_service.labor_service_id,

            quote_service.labor_amount

        from
            public.quote_services
                as quote_service

        where
            quote_service.organization_id =
                target_org_id

            and
            quote_service.quote_id =
                target_quote_id

        order by
            quote_service.created_at asc

    loop

        selected_labor_id :=
            service_record.labor_service_id;


        selected_labor_amount :=
            coalesce(
                service_record.labor_amount,
                0
            );


        matched_labor_id :=
            null;


        matched_labor_amount :=
            null;


        -- ===================================================
        -- ASSOCIACAO AUTOMATICA
        -- ===================================================

        if
            selected_labor_id is null
        then

            select
                labor.id,
                labor.amount

            into
                matched_labor_id,
                matched_labor_amount

            from
                public.labor_services
                    as labor

            where
                labor.organization_id =
                    target_org_id

                and
                labor.active =
                    true

                and
                lower(
                    btrim(
                        labor.description
                    )
                ) =
                lower(
                    btrim(
                        service_record.description
                    )
                )

                and
                lower(
                    btrim(
                        coalesce(
                            labor.category,
                            ''
                        )
                    )
                ) =
                lower(
                    btrim(
                        coalesce(
                            service_record.category,
                            ''
                        )
                    )
                )

            order by
                labor.created_at asc

            limit 1;


            if
                matched_labor_id
                    is not null
            then

                selected_labor_id :=
                    matched_labor_id;


                if
                    selected_labor_amount =
                        0
                then

                    selected_labor_amount :=
                        matched_labor_amount;

                end if;


                -- ===========================================
                -- GRAVA O VINCULO NO ORCAMENTO TAMBEM
                -- ===========================================

                update
                    public.quote_services

                set
                    labor_service_id =
                        selected_labor_id,

                    labor_amount =
                        selected_labor_amount

                where
                    id =
                        service_record.id

                    and
                    organization_id =
                        target_org_id;

            end if;

        end if;


        -- ===================================================
        -- SNAPSHOT NA OS
        -- ===================================================

        insert into
            public.work_order_services (

                organization_id,

                work_order_id,

                quote_service_id,

                labor_service_id,

                category,

                description,

                labor_amount,

                needs_part,

                status

            )
        values (

            target_org_id,

            work_order_uuid,

            service_record.id,

            selected_labor_id,

            service_record.category,

            service_record.description,

            selected_labor_amount,

            coalesce(
                service_record.needs_part,
                false
            ),

            'pending'

        )

        on conflict (
            work_order_id,
            quote_service_id
        )
        do update
        set

            labor_service_id =
                coalesce(
                    public.work_order_services.labor_service_id,
                    excluded.labor_service_id
                ),

            category =
                excluded.category,

            description =
                excluded.description,

            labor_amount =
                case

                    when
                        public.work_order_services.status =
                            'pending'
                    then
                        excluded.labor_amount

                    else
                        public.work_order_services.labor_amount

                end,

            needs_part =
                excluded.needs_part;

    end loop;


    return
        work_order_uuid;

end;
$$;


revoke all
on function
public.sync_quote_work_order(
    uuid,
    uuid
)
from public,
anon;


grant execute
on function
public.sync_quote_work_order(
    uuid,
    uuid
)
to authenticated;


-- ===========================================================
-- DEFINIR MAO DE OBRA MANUALMENTE
-- ===========================================================

create or replace function
public.set_work_order_service_labor(

    target_org_id uuid,

    target_work_order_service_id uuid,

    target_labor_service_id uuid
)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare

    labor_amount_value numeric;

    quote_service_uuid uuid;

begin

    if auth.uid() is null then

        raise exception
            'Authentication required';

    end if;


    if not public.is_org_member(
        target_org_id
    ) then

        raise exception
            'User does not belong to organization';

    end if;


    -- =======================================================
    -- MAO DE OBRA
    -- =======================================================

    select
        amount

    into
        labor_amount_value

    from
        public.labor_services

    where
        id =
            target_labor_service_id

        and
        organization_id =
            target_org_id

        and
        active =
            true;


    if
        labor_amount_value is null
    then

        raise exception
            'Labor service not found or inactive';

    end if;


    -- =======================================================
    -- ATUALIZAR OS
    -- =======================================================

    update
        public.work_order_services

    set
        labor_service_id =
            target_labor_service_id,

        labor_amount =
            labor_amount_value

    where
        id =
            target_work_order_service_id

        and
        organization_id =
            target_org_id

        and
        status =
            'pending'

    returning
        quote_service_id

    into
        quote_service_uuid;


    if
        quote_service_uuid is null
    then

        raise exception
            'Work order service not found or already started';

    end if;


    -- =======================================================
    -- SINCRONIZAR ORCAMENTO
    -- =======================================================

    update
        public.quote_services

    set
        labor_service_id =
            target_labor_service_id,

        labor_amount =
            labor_amount_value

    where
        id =
            quote_service_uuid

        and
        organization_id =
            target_org_id;


    return
        labor_amount_value;

end;
$$;


revoke all
on function
public.set_work_order_service_labor(
    uuid,
    uuid,
    uuid
)
from public,
anon;


grant execute
on function
public.set_work_order_service_labor(
    uuid,
    uuid,
    uuid
)
to authenticated;


-- ===========================================================
-- INICIAR SERVICO
-- ===========================================================

create or replace function
public.start_work_order_service(

    target_org_id uuid,

    target_work_order_service_id uuid
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare

    work_order_uuid uuid;

    quote_uuid uuid;

    quote_status text;

begin

    if auth.uid() is null then

        raise exception
            'Authentication required';

    end if;


    if not public.is_org_member(
        target_org_id
    ) then

        raise exception
            'User does not belong to organization';

    end if;


    -- =======================================================
    -- LOCALIZAR OS
    -- =======================================================

    select
        service.work_order_id,
        work_order.quote_id,
        quote.status

    into
        work_order_uuid,
        quote_uuid,
        quote_status

    from
        public.work_order_services
            as service

    join
        public.work_orders
            as work_order

        on
            work_order.id =
                service.work_order_id

    join
        public.quotes
            as quote

        on
            quote.id =
                work_order.quote_id

    where
        service.id =
            target_work_order_service_id

        and
        service.organization_id =
            target_org_id

        and
        work_order.organization_id =
            target_org_id

        and
        quote.organization_id =
            target_org_id;


    if
        work_order_uuid is null
    then

        raise exception
            'Work order service not found';

    end if;


    -- =======================================================
    -- BLOQUEIO POR PECA
    -- =======================================================

    if
        quote_status =
            'awaiting_parts'
    then

        raise exception
            'Quote is still awaiting parts';

    end if;


    if
        quote_status not in (
            'approved',
            'in_progress'
        )
    then

        raise exception
            'Quote is not ready for execution';

    end if;


    -- =======================================================
    -- INICIAR SERVICO
    -- =======================================================

    update
        public.work_order_services

    set
        status =
            'in_progress',

        started_at =
            coalesce(
                started_at,
                now()
            )

    where
        id =
            target_work_order_service_id

        and
        organization_id =
            target_org_id

        and
        status =
            'pending';


    if not found then

        raise exception
            'Service cannot be started';

    end if;


    -- =======================================================
    -- INICIAR OS
    -- =======================================================

    update
        public.work_orders

    set
        status =
            'in_progress',

        started_at =
            coalesce(
                started_at,
                now()
            )

    where
        id =
            work_order_uuid

        and
        organization_id =
            target_org_id;


    -- =======================================================
    -- ORCAMENTO
    -- =======================================================

    update
        public.quotes

    set
        status =
            'in_progress'

    where
        id =
            quote_uuid

        and
        organization_id =
            target_org_id

        and
        status =
            'approved';


    return
        'in_progress';

end;
$$;


revoke all
on function
public.start_work_order_service(
    uuid,
    uuid
)
from public,
anon;


grant execute
on function
public.start_work_order_service(
    uuid,
    uuid
)
to authenticated;


-- ===========================================================
-- CONCLUIR SERVICO
-- ===========================================================

create or replace function
public.complete_work_order_service(

    target_org_id uuid,

    target_work_order_service_id uuid
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare

    work_order_uuid uuid;

    quote_uuid uuid;

    pending_count integer;

begin

    if auth.uid() is null then

        raise exception
            'Authentication required';

    end if;


    if not public.is_org_member(
        target_org_id
    ) then

        raise exception
            'User does not belong to organization';

    end if;


    -- =======================================================
    -- LOCALIZAR SERVICO
    -- =======================================================

    select
        service.work_order_id,
        work_order.quote_id

    into
        work_order_uuid,
        quote_uuid

    from
        public.work_order_services
            as service

    join
        public.work_orders
            as work_order

        on
            work_order.id =
                service.work_order_id

    where
        service.id =
            target_work_order_service_id

        and
        service.organization_id =
            target_org_id

        and
        work_order.organization_id =
            target_org_id;


    if
        work_order_uuid is null
    then

        raise exception
            'Work order service not found';

    end if;


    -- =======================================================
    -- CONCLUIR
    -- =======================================================

    update
        public.work_order_services

    set
        status =
            'completed',

        completed_at =
            coalesce(
                completed_at,
                now()
            )

    where
        id =
            target_work_order_service_id

        and
        organization_id =
            target_org_id

        and
        status =
            'in_progress';


    if not found then

        raise exception
            'Service must be started before completion';

    end if;


    -- =======================================================
    -- EXISTE ALGUM SERVICO AINDA NAO CONCLUIDO?
    -- =======================================================

    select
        count(*)

    into
        pending_count

    from
        public.work_order_services

    where
        organization_id =
            target_org_id

        and
        work_order_id =
            work_order_uuid

        and
        status <>
            'completed';


    -- =======================================================
    -- TODOS CONCLUIDOS
    -- =======================================================

    if
        pending_count =
            0
    then

        update
            public.work_orders

        set
            status =
                'completed',

            completed_at =
                coalesce(
                    completed_at,
                    now()
                )

        where
            id =
                work_order_uuid

            and
            organization_id =
                target_org_id;


        update
            public.quotes

        set
            status =
                'completed'

        where
            id =
                quote_uuid

            and
            organization_id =
                target_org_id;


        return
            'completed';

    end if;


    -- =======================================================
    -- CONTINUA EM EXECUCAO
    -- =======================================================

    update
        public.work_orders

    set
        status =
            'in_progress'

    where
        id =
            work_order_uuid

        and
        organization_id =
            target_org_id;


    update
        public.quotes

    set
        status =
            'in_progress'

    where
        id =
            quote_uuid

        and
        organization_id =
            target_org_id;


    return
        'in_progress';

end;
$$;


revoke all
on function
public.complete_work_order_service(
    uuid,
    uuid
)
from public,
anon;


grant execute
on function
public.complete_work_order_service(
    uuid,
    uuid
)
to authenticated;


notify pgrst, 'reload schema';