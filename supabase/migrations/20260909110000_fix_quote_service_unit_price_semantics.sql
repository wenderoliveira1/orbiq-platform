-- ===========================================================
-- ORBIQ PLATFORM
-- FIX QUOTE SERVICE UNIT PRICE SEMANTICS
-- ===========================================================

alter table public.quote_services
    add column if not exists quantity numeric(12,3) not null default 1;

update public.quote_services
set quantity = 1
where quantity is null or quantity <= 0;

alter table public.quote_services
    drop constraint if exists quote_services_quantity_check;

alter table public.quote_services
    add constraint quote_services_quantity_check
    check (quantity > 0);

-- The canonical meaning of quote_services.labor_amount is the UNIT price.
-- If the earlier quantity migration was already executed, it stored line
-- totals for rows with quantity > 1. Convert those rows back to unit prices.
update public.quote_services
set labor_amount = round(labor_amount / quantity, 2)
where quantity > 1
  and labor_amount is not null;

create or replace function public.recalculate_quote_final_amount(target_quote_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
    target_org_id uuid;
begin
    select organization_id
    into target_org_id
    from public.quotes
    where id = target_quote_id;

    if target_org_id is null or not public.is_org_member(target_org_id) then
        raise exception 'Quote does not belong to current organization';
    end if;

    update public.quotes
    set final_amount = round(
        coalesce((
            select sum(coalesce(qs.labor_amount, 0) * coalesce(qs.quantity, 1))
            from public.quote_services qs
            where qs.quote_id = target_quote_id
        ), 0)
        +
        coalesce((
            select sum(coalesce(qi.chosen_amount, 0) * qi.quantity)
            from public.quote_items qi
            where qi.quote_id = target_quote_id
              and qi.chosen_amount is not null
        ), 0),
        2
    )
    where id = target_quote_id;
end;
$$;

create or replace function public.trg_recalculate_quote_final_amount()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
    if tg_op = 'DELETE' then
        perform public.recalculate_quote_final_amount(old.quote_id);
        return old;
    end if;

    perform public.recalculate_quote_final_amount(new.quote_id);

    if tg_op = 'UPDATE' and old.quote_id <> new.quote_id then
        perform public.recalculate_quote_final_amount(old.quote_id);
    end if;

    return new;
end;
$$;

drop trigger if exists quote_services_recalculate_final_amount on public.quote_services;
create trigger quote_services_recalculate_final_amount
after insert or update or delete on public.quote_services
for each row execute function public.trg_recalculate_quote_final_amount();

drop trigger if exists quote_items_recalculate_final_amount on public.quote_items;
create trigger quote_items_recalculate_final_amount
after insert or update or delete on public.quote_items
for each row execute function public.trg_recalculate_quote_final_amount();

update public.quotes q
set final_amount = round(
    coalesce((
        select sum(coalesce(qs.labor_amount, 0) * coalesce(qs.quantity, 1))
        from public.quote_services qs
        where qs.quote_id = q.id
    ), 0)
    +
    coalesce((
        select sum(coalesce(qi.chosen_amount, 0) * qi.quantity)
        from public.quote_items qi
        where qi.quote_id = q.id
          and qi.chosen_amount is not null
    ), 0),
    2
);

notify pgrst, 'reload schema';
