-- ===========================================================
-- ORBIQ PLATFORM
-- HOTFIX FASE 1.5C.1
--
-- CORRIGE INCONSISTENCIA:
--
-- quote_supplier_item_responses.awarded = true
--
-- mas quote_items.supplier_id / chosen_amount
-- eventualmente ausentes.
-- ===========================================================


-- ===========================================================
-- SINCRONIZAR VENCEDOR DA COTACAO COM A PECA
-- ===========================================================

create or replace function
public.orbiq_sync_awarded_supplier_items(

    target_org_id uuid,

    target_quote_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare

    affected_rows integer;

begin

    update
        public.quote_items
            as quote_item

    set
        supplier_id =
            winner.supplier_id,

        chosen_amount =
            winner.total_price,

        purchase_status =
            case

                when
                    quote_item.purchase_status =
                        'cancelled'
                then
                    quote_item.purchase_status

                else
                    'approved'

            end

    from (

        select distinct on (
            response.quote_item_id
        )

            response.quote_item_id,

            request.supplier_id,

            response.total_price

        from
            public.quote_supplier_item_responses
                as response

        join
            public.quote_supplier_requests
                as request

            on
                request.id =
                    response.request_id

            and
                request.organization_id =
                    response.organization_id

        where
            response.organization_id =
                target_org_id

            and
            request.quote_id =
                target_quote_id

            and
            response.awarded =
                true

            and
            request.status <>
                'cancelled'

        order by

            response.quote_item_id,

            response.updated_at desc,

            response.created_at desc

    )
        as winner

    where
        quote_item.id =
            winner.quote_item_id

        and
        quote_item.organization_id =
            target_org_id

        and
        quote_item.quote_id =
            target_quote_id

        and
        (
            quote_item.supplier_id
                is distinct from
                winner.supplier_id

            or

            quote_item.chosen_amount
                is distinct from
                winner.total_price
        );


    get diagnostics
        affected_rows =
            row_count;


    return
        affected_rows;

end;
$$;


revoke all
on function
public.orbiq_sync_awarded_supplier_items(
    uuid,
    uuid
)
from public,
anon,
authenticated;


-- ===========================================================
-- GERAR LINK PUBLICO
--
-- AGORA NAO DEIXA O ORCAMENTO SER COMPARTILHADO
-- SE A PARTE INTERNA AINDA ESTIVER INCOMPLETA.
-- ===========================================================

create or replace function
public.create_quote_public_link(

    target_org_id uuid,

    target_quote_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare

    generated_token text;

    current_status text;

    current_final numeric;

    missing_supplier integer;

    missing_sale integer;

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


    select

        commercial_status,

        final_amount

    into

        current_status,

        current_final

    from
        public.quotes

    where
        id =
            target_quote_id

        and
        organization_id =
            target_org_id;


    if
        current_status is null
    then

        raise exception
            'Quote not found';

    end if;


    if
        current_status not in (
            'ready',
            'approved'
        )
    then

        raise exception
            'O orçamento comercial precisa ser salvo antes de compartilhar.';

    end if;


    if
        current_final is null
    then

        raise exception
            'O orçamento ainda não possui valor final.';

    end if;


    -- =======================================================
    -- REPARAR LEGADO / INCONSISTENCIA
    -- =======================================================

    perform
        public.orbiq_sync_awarded_supplier_items(
            target_org_id,
            target_quote_id
        );


    -- =======================================================
    -- VALIDAR PECAS
    -- =======================================================

    select

        count(*) filter (
            where
                supplier_id is null
                or
                chosen_amount is null
        ),

        count(*) filter (
            where
                sale_unit_amount is null
                or
                sale_total_amount is null
        )

    into
        missing_supplier,
        missing_sale

    from
        public.quote_items

    where
        organization_id =
            target_org_id

        and
        quote_id =
            target_quote_id;


    if
        missing_supplier >
            0
    then

        raise exception
            'Existe peça sem fornecedor vencedor. Finalize a escolha em Cotações > Respostas.';

    end if;


    if
        missing_sale >
            0
    then

        raise exception
            'Existe peça sem preço de venda. Salve novamente o orçamento Comercial.';

    end if;


    -- =======================================================
    -- REVOGAR LINK ANTERIOR
    -- =======================================================

    update
        public.quote_public_links

    set
        revoked_at =
            now()

    where
        organization_id =
            target_org_id

        and
        quote_id =
            target_quote_id

        and
        revoked_at is null;


    generated_token :=
        replace(
            gen_random_uuid()::text,
            '-',
            ''
        )
        ||
        replace(
            gen_random_uuid()::text,
            '-',
            ''
        );


    insert into
        public.quote_public_links (

            organization_id,

            quote_id,

            token,

            expires_at,

            created_by

        )
    values (

        target_org_id,

        target_quote_id,

        generated_token,

        now() +
            interval '7 days',

        auth.uid()

    );


    return
        generated_token;

end;
$$;


revoke all
on function
public.create_quote_public_link(
    uuid,
    uuid
)
from public,
anon;


grant execute
on function
public.create_quote_public_link(
    uuid,
    uuid
)
to authenticated;


-- ===========================================================
-- DECISAO PUBLICA
-- ===========================================================

create or replace function
public.public_decide_quote(

    target_token text,

    target_decision text,

    target_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare

    target_quote_id uuid;

    target_org_id uuid;

    current_commercial_status text;

    items_count integer;

    missing_supplier integer;

    missing_sale integer;

    next_status text;

    normalized_decision text;

begin

    normalized_decision :=
        lower(
            btrim(
                coalesce(
                    target_decision,
                    ''
                )
            )
        );


    if
        normalized_decision not in (
            'approved',
            'rejected'
        )
    then

        raise exception
            'Decisão inválida.';

    end if;


    select

        public_link.quote_id,

        public_link.organization_id

    into

        target_quote_id,

        target_org_id

    from
        public.quote_public_links
            as public_link

    where
        public_link.token =
            btrim(
                target_token
            )

        and
        public_link.revoked_at is null

        and
        public_link.expires_at >
            now();


    if
        target_quote_id is null
    then

        raise exception
            'Este link é inválido, expirou ou foi revogado.';

    end if;


    select
        commercial_status

    into
        current_commercial_status

    from
        public.quotes

    where
        id =
            target_quote_id

        and
        organization_id =
            target_org_id

    for update;


    if
        current_commercial_status is null
    then

        raise exception
            'Orçamento não encontrado.';

    end if;


    if
        current_commercial_status =
            'approved'

        and
        normalized_decision =
            'approved'
    then

        return
            jsonb_build_object(
                'decision',
                'approved'
            );

    end if;


    if
        current_commercial_status =
            'rejected'

        and
        normalized_decision =
            'rejected'
    then

        return
            jsonb_build_object(
                'decision',
                'rejected'
            );

    end if;


    if
        current_commercial_status <>
            'ready'
    then

        raise exception
            'Este orçamento não está mais aguardando uma decisão.';

    end if;


    -- =======================================================
    -- REPROVACAO NAO DEPENDE DE FORNECEDOR
    -- =======================================================

    if
        normalized_decision =
            'rejected'
    then

        update
            public.quotes

        set
            commercial_status =
                'rejected',

            commercial_approved_at =
                null,

            commercial_rejected_at =
                now(),

            commercial_rejection_reason =
                nullif(
                    btrim(
                        coalesce(
                            target_reason,
                            ''
                        )
                    ),
                    ''
                ),

            status =
                'rejected'

        where
            id =
                target_quote_id

            and
            organization_id =
                target_org_id;


        return
            jsonb_build_object(

                'decision',
                'rejected',

                'workflow_status',
                'rejected'

            );

    end if;


    -- =======================================================
    -- APROVACAO
    --
    -- PRIMEIRO RECONCILIA EVENTUAL VENCEDOR JA REGISTRADO.
    -- =======================================================

    perform
        public.orbiq_sync_awarded_supplier_items(
            target_org_id,
            target_quote_id
        );


    select

        count(*),

        count(*) filter (
            where
                supplier_id is null
                or
                chosen_amount is null
        ),

        count(*) filter (
            where
                sale_unit_amount is null
                or
                sale_total_amount is null
        )

    into

        items_count,

        missing_supplier,

        missing_sale

    from
        public.quote_items

    where
        organization_id =
            target_org_id

        and
        quote_id =
            target_quote_id;


    if
        missing_supplier >
            0
    then

        raise exception
            'Existe peça sem fornecedor vencedor. A oficina precisa finalizar a cotação antes da aprovação.';

    end if;


    if
        missing_sale >
            0
    then

        raise exception
            'Existe peça sem preço de venda. A oficina precisa revisar o orçamento comercial.';

    end if;


    if
        items_count >
            0
    then

        next_status :=
            'awaiting_parts';

    else

        next_status :=
            'approved';

    end if;


    update
        public.quotes

    set
        commercial_status =
            'approved',

        commercial_approved_at =
            now(),

        commercial_rejected_at =
            null,

        commercial_rejection_reason =
            null,

        status =
            next_status

    where
        id =
            target_quote_id

        and
        organization_id =
            target_org_id;


    return
        jsonb_build_object(

            'decision',
            'approved',

            'workflow_status',
            next_status

        );

end;
$$;


revoke all
on function
public.public_decide_quote(
    text,
    text,
    text
)
from public;


grant execute
on function
public.public_decide_quote(
    text,
    text,
    text
)
to anon,
authenticated;


notify pgrst, 'reload schema';