-- Harden recalculate_quote_final_amount against Data API callers with null uid.
-- Allow:
--   1) service_role JWT (admin / seed via service key)
--   2) no JWT at all (direct SQL: migrations, AutoQA runPostgres)
--   3) authenticated JWT + org membership
-- Deny: PostgREST anon/authenticated without membership (closes prior uid-null bypass).
-- Keeps EXECUTE on authenticated so security-invoker triggers still work.

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

  -- Data API always attaches a JWT. Direct postgres (migrations / AutoQA) does not.
  if auth.role() is distinct from 'service_role' and auth.jwt() is not null then
    if auth.uid() is null or not public.is_org_member(target_org_id) then
      raise exception 'Quote does not belong to current organization';
    end if;
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

revoke all on function public.recalculate_quote_final_amount(uuid) from public, anon;
grant execute on function public.recalculate_quote_final_amount(uuid) to authenticated;
