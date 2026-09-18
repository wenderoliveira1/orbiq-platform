begin;

-- Membership changes must go through the RPCs, which protect owners,
-- prevent self-promotion and record the actor in the audit log.
-- RLS team.manage alone lets an admin promote themselves to owner.
revoke insert, update, delete, truncate, references, trigger
on public.organization_members from public, anon, authenticated;

drop policy if exists orbiq_members_insert on public.organization_members;
drop policy if exists orbiq_members_update on public.organization_members;
drop policy if exists orbiq_members_delete on public.organization_members;

-- Keep read access for active members; only staff allowed to maintain labor
-- prices may write the catalog (including the save_service_catalog RPC).
drop policy if exists orbiq_service_catalog_member_all on public.service_catalog;
drop policy if exists orbiq_service_catalog_select on public.service_catalog;
drop policy if exists orbiq_service_catalog_insert on public.service_catalog;
drop policy if exists orbiq_service_catalog_update on public.service_catalog;
drop policy if exists orbiq_service_catalog_delete on public.service_catalog;
create policy orbiq_service_catalog_select
on public.service_catalog for select to authenticated
using ((select public.is_org_member(organization_id)));

create policy orbiq_service_catalog_insert
on public.service_catalog for insert to authenticated
with check (public.orbiq_has_permission(organization_id, 'labor.manage'));

create policy orbiq_service_catalog_update
on public.service_catalog for update to authenticated
using (public.orbiq_has_permission(organization_id, 'labor.manage'))
with check (public.orbiq_has_permission(organization_id, 'labor.manage'));

create policy orbiq_service_catalog_delete
on public.service_catalog for delete to authenticated
using (public.orbiq_has_permission(organization_id, 'labor.manage'));

notify pgrst, 'reload schema';
commit;
