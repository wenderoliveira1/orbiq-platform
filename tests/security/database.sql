-- Synthetic users/organizations only. The runner always rolls back.
create temporary table security_fixture (name text primary key, id uuid not null);
insert into security_fixture select name, gen_random_uuid()
from unnest(array['owner','admin','viewer','technician','estimator','outsider','org','other_org','catalog','customer','other_customer']) name;
grant select on security_fixture to authenticated, anon;

insert into auth.users (id, email, raw_user_meta_data)
select id, 'security-' || id || '@example.invalid', '{}'::jsonb
from security_fixture where name in ('owner','admin','viewer','technician','estimator','outsider');
insert into public.organizations (id, name, slug)
select id, 'Security audit fixture', 'security-' || id
from security_fixture where name in ('org','other_org');
insert into public.organization_members (organization_id, user_id, role, status)
select org.id, member.id, member.name, 'active'
from security_fixture org cross join security_fixture member
where org.name = 'org' and member.name in ('owner','admin','viewer','technician','estimator');
insert into public.organization_members (organization_id, user_id, role, status)
select org.id, member.id, 'owner', 'active'
from security_fixture org cross join security_fixture member
where org.name = 'other_org' and member.name = 'owner';
insert into public.service_catalog (id, organization_id, category, description, default_labor_amount)
select item.id, org.id, 'SECURITY TEST', 'SECURITY TEST SERVICE', 100
from security_fixture item cross join security_fixture org
where item.name = 'catalog' and org.name = 'org';
insert into public.customers (id, organization_id, name)
select id, (select id from security_fixture where name = 'org'), 'Security Customer'
from security_fixture where name = 'customer';
insert into public.customers (id, organization_id, name)
select id, (select id from security_fixture where name = 'other_org'), 'Other Tenant Customer'
from security_fixture where name = 'other_customer';

-- APPLY_SECURITY_MIGRATION

create function pg_temp.login_as(actor text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', (select id from security_fixture where name = actor), 'role', 'authenticated'
  )::text, true);
end;
$$;

set local role authenticated;
select pg_temp.login_as('admin');
do $$
declare changed integer;
begin
  begin
    update public.organization_members set role = 'owner'
    where organization_id = (select id from security_fixture where name = 'org')
      and user_id = auth.uid();
    get diagnostics changed = row_count;
    if current_setting('security_test.baseline') = 'true' and changed = 1 then
      raise notice 'REPRODUCED: admin self-promotion to owner';
    else
      raise exception 'SECURITY FAILURE: direct membership mutation permitted';
    end if;
  exception when insufficient_privilege then
    if current_setting('security_test.baseline') = 'true' then raise; end if;
    raise notice 'PASS: admin cannot mutate memberships directly';
  end;
end;
$$;

select pg_temp.login_as('viewer');
do $$
declare changed integer;
begin
  update public.service_catalog set default_labor_amount = 999
  where id = (select id from security_fixture where name = 'catalog');
  get diagnostics changed = row_count;
  if current_setting('security_test.baseline') = 'true' then
    if changed <> 1 then raise exception 'Baseline not reproduced'; end if;
    raise notice 'REPRODUCED: viewer changes catalog prices';
  elsif changed <> 0 then
    raise exception 'SECURITY FAILURE: viewer changes catalog prices';
  else
    raise notice 'PASS: viewer cannot change catalog prices';
  end if;
end;
$$;

select pg_temp.login_as('estimator');
do $$
begin
  begin
    insert into public.vehicles (organization_id, customer_id, plate, model)
    values ((select id from security_fixture where name = 'org'),
            (select id from security_fixture where name = 'other_customer'),
            'SEC0A01', 'Security test');
    if current_setting('security_test.baseline') = 'true' then
      raise notice 'REPRODUCED: vehicle references another tenant customer';
    else
      raise exception 'SECURITY FAILURE: cross-tenant customer reference accepted';
    end if;
  exception when foreign_key_violation then
    if current_setting('security_test.baseline') = 'true' then raise; end if;
    raise notice 'PASS: cross-tenant customer reference rejected';
  end;
  insert into public.vehicles (organization_id, customer_id, plate, model)
  values ((select id from security_fixture where name = 'org'),
          (select id from security_fixture where name = 'customer'),
          'SEC0A02', 'Security test');
  raise notice 'PASS: same-tenant customer reference accepted';
  if current_setting('security_test.baseline') = 'false' then
    begin
      update public.vehicles
      set customer_id = (select id from security_fixture where name = 'other_customer')
      where organization_id = (select id from security_fixture where name = 'org') and plate = 'SEC0A02';
      raise exception 'SECURITY FAILURE: cross-tenant reference update accepted';
    exception when foreign_key_violation then null;
    end;
    perform pg_temp.login_as('owner');
    begin
      update public.customers
      set organization_id = (select id from security_fixture where name = 'other_org')
      where id = (select id from security_fixture where name = 'customer');
      raise exception 'SECURITY FAILURE: parent moved across tenants';
    exception when insufficient_privilege then null;
    end;
    raise notice 'PASS: reference updates and parent reassignment blocked';
  end if;
end;
$$;

-- Remaining checks apply to the corrected permissions.
reset role;
do $$
begin
  if current_setting('security_test.baseline') = 'false' then
    if exists (
      select 1 from pg_class r join pg_namespace n on n.oid = r.relnamespace
      where n.nspname = 'public' and r.relkind = 'r'
        and exists (select 1 from pg_attribute a where a.attrelid = r.oid
                    and a.attname = 'organization_id' and not a.attisdropped)
        and not exists (select 1 from pg_trigger t where t.tgrelid = r.oid
                        and t.tgname = 'orbiq_tenant_references' and t.tgenabled = 'O')
    ) then raise exception 'A tenant table is missing its guard'; end if;
    if has_function_privilege('authenticated', 'orbiq_private.enforce_tenant_references()', 'EXECUTE')
       or has_function_privilege('anon', 'orbiq_private.enforce_tenant_references()', 'EXECUTE') then
      raise exception 'Private tenant guard exposed';
    end if;
    if has_table_privilege('authenticated', 'public.organization_members', 'INSERT')
      or has_table_privilege('authenticated', 'public.organization_members', 'UPDATE')
      or has_table_privilege('authenticated', 'public.organization_members', 'DELETE')
      or has_table_privilege('anon', 'public.organization_members', 'UPDATE') then
      raise exception 'Membership write grants remain';
    end if;
    raise notice 'PASS: membership writes revoked at the database boundary';
  end if;
end;
$$;
set local role authenticated;
do $$
declare actor text; affected integer; target_org uuid; other_org uuid; target_catalog uuid; saved uuid; denied boolean;
begin
  if current_setting('security_test.baseline') = 'true' then return; end if;
  select id into target_org from security_fixture where name = 'org';
  select id into other_org from security_fixture where name = 'other_org';
  select id into target_catalog from security_fixture where name = 'catalog';
  foreach actor in array array['viewer','technician','outsider'] loop
    perform pg_temp.login_as(actor);
    begin
      insert into public.service_catalog (organization_id, category, description)
      values (target_org, 'SECURITY TEST', 'DENIED ' || actor);
      raise exception 'SECURITY FAILURE: catalog insert permitted for %', actor;
    exception when insufficient_privilege then null;
    end;
    delete from public.service_catalog where id = target_catalog;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'SECURITY FAILURE: catalog delete permitted for %', actor; end if;
    begin
      perform public.save_service_catalog(target_org, 'SECURITY TEST', 'RPC DENIED ' || actor, 1);
      raise exception 'SECURITY FAILURE: catalog RPC permitted for %', actor;
    exception
      when insufficient_privilege then null;
      when raise_exception then
        if sqlerrm <> 'User does not belong to organization' then raise; end if;
    end;
    raise notice 'PASS: catalog insert/delete/RPC denied for %', actor;
  end loop;

  perform pg_temp.login_as('estimator');
  saved := public.save_service_catalog(target_org, 'SECURITY TEST', 'AUTHORIZED RPC', 125);
  if saved is null then raise exception 'Authorized catalog save failed'; end if;
  perform public.save_service_catalog(target_org, 'SECURITY TEST', 'AUTHORIZED RPC', 150);
  if not exists (select 1 from public.service_catalog where id = saved and default_labor_amount = 150) then
    raise exception 'Authorized catalog update failed';
  end if;
  begin
    insert into public.service_catalog (organization_id, category, description)
    values (other_org, 'SECURITY TEST', 'CROSS TENANT');
    raise exception 'SECURITY FAILURE: cross-tenant insert permitted';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.service_catalog set organization_id = other_org where id = saved;
    raise exception 'SECURITY FAILURE: cross-tenant reassignment permitted';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: estimator can save/update; cross-tenant writes denied';

  perform pg_temp.login_as('admin');
  denied := false;
  begin
    perform public.update_organization_member_role(target_org, auth.uid(), 'owner');
  exception when others then denied := true;
  end;
  if not denied then raise exception 'SECURITY FAILURE: admin promotes self via RPC'; end if;
  denied := false;
  begin
    perform public.set_organization_member_status(target_org,
      (select id from security_fixture where name = 'owner'), 'disabled');
  exception when others then denied := true;
  end;
  if not denied then raise exception 'SECURITY FAILURE: admin disables owner via RPC'; end if;
  raise notice 'PASS: team RPCs preserve owner and self-promotion restrictions';

  perform pg_temp.login_as('owner');
  perform public.update_organization_member_role(target_org,
    (select id from security_fixture where name = 'viewer'), 'estimator');
  if not exists (select 1 from public.organization_members
      where user_id = (select id from security_fixture where name = 'viewer')
        and organization_id = target_org and role = 'estimator') then
    raise exception 'Authorized team RPC failed';
  end if;
  perform public.set_organization_member_status(target_org,
    (select id from security_fixture where name = 'viewer'), 'disabled');
  perform pg_temp.login_as('viewer');
  if exists (select 1 from public.service_catalog where organization_id = target_org) then
    raise exception 'SECURITY FAILURE: disabled member reads catalog';
  end if;
  raise notice 'PASS: owner team RPCs work; disabled member loses catalog access';
  perform pg_temp.login_as('outsider');
  saved := public.create_organization('Security bootstrap', 'security-bootstrap-' || auth.uid(), null);
  if not public.has_org_role(saved, array['owner']) then raise exception 'Organization bootstrap failed'; end if;
  raise notice 'PASS: new organization bootstrap still creates its owner';
end;
$$;
reset role;
