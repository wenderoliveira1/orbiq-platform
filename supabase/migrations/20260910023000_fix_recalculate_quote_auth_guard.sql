-- Allow quote total recalculation during service-role / seed contexts
-- where auth.uid() is null (AutoQA global setup, migrations).
-- Keep the org-membership guard for authenticated callers.

create or replace function public.recalculate_quote_final_amount(target_quote_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_org_id uuid;
  labor_total numeric := 0;
  parts_total numeric := 0;
begin
  select organization_id
    into target_org_id
  from public.quotes
  where id = target_quote_id;

  if target_org_id is null then
    raise exception 'Quote does not belong to current organization';
  end if;

  if auth.uid() is not null and not public.is_org_member(target_org_id) then
    raise exception 'Quote does not belong to current organization';
  end if;

  select coalesce(sum(round(coalesce(qs.labor_amount, 0), 2) * coalesce(qs.quantity, 1)), 0)
    into labor_total
  from public.quote_services qs
  where qs.quote_id = target_quote_id
    and qs.organization_id = target_org_id;

  select coalesce(sum(round(coalesce(qi.chosen_amount, 0), 2) * coalesce(qi.quantity, 1)), 0)
    into parts_total
  from public.quote_items qi
  where qi.quote_id = target_quote_id
    and qi.organization_id = target_org_id
    and qi.chosen_amount is not null;

  update public.quotes
  set final_amount = round(labor_total + parts_total, 2)
  where id = target_quote_id
    and organization_id = target_org_id;
end;
$$;
