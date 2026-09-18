begin;

-- Single-column FKs validate existence, but not tenant ownership. Keep them
-- (and PostgREST's relationship names) and enforce the tenant at every write.
-- The private trigger needs to inspect parents even when the actor cannot
-- SELECT them through RLS. It returns no parent data and has no RPC grants.
create or replace function orbiq_private.enforce_tenant_references()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
    row_data jsonb := to_jsonb(new);
    reference_id uuid;
    reference_exists boolean;
    argument_index integer := 0;
begin
    if tg_op = 'UPDATE' then
        if new.organization_id is distinct from old.organization_id
           or row_data ->> 'id' is distinct from to_jsonb(old) ->> 'id' then
            raise exception 'Organization and record identity are immutable'
                using errcode = '42501';
        end if;
    end if;

    while argument_index < tg_nargs loop
        reference_id := (row_data ->> tg_argv[argument_index])::uuid;
        if reference_id is not null then
            reference_exists := false;
            execute format(
                'select true from public.%I where id = $1 and organization_id = $2 for key share',
                tg_argv[argument_index + 1]
            ) into reference_exists using reference_id, new.organization_id;
            if not coalesce(reference_exists, false) then
                raise exception 'Referenced record does not belong to organization'
                    using errcode = '23503';
            end if;
        end if;
        argument_index := argument_index + 2;
    end loop;
    return new;
end;
$$;

revoke all on function orbiq_private.enforce_tenant_references()
from public, anon, authenticated;

do $$
declare
    target record;
    reference_arguments text;
begin
    for target in
        select relation.oid, relation.relname
        from pg_class relation
        join pg_namespace namespace on namespace.oid = relation.relnamespace
        where namespace.nspname = 'public' and relation.relkind = 'r'
          and exists (select 1 from pg_attribute column_row
                      where column_row.attrelid = relation.oid
                        and column_row.attname = 'organization_id'
                        and not column_row.attisdropped)
    loop
        select string_agg(format('%L, %L', child_column.attname, parent.relname), ', '
                          order by foreign_key.conname)
        into reference_arguments
        from pg_constraint foreign_key
        join pg_class parent on parent.oid = foreign_key.confrelid
        join pg_namespace parent_namespace on parent_namespace.oid = parent.relnamespace
        join pg_attribute child_column on child_column.attrelid = foreign_key.conrelid
                                      and child_column.attnum = foreign_key.conkey[1]
        join pg_attribute parent_column on parent_column.attrelid = parent.oid
                                       and parent_column.attnum = foreign_key.confkey[1]
        where foreign_key.contype = 'f' and foreign_key.conrelid = target.oid
          and cardinality(foreign_key.conkey) = 1
          and parent_namespace.nspname = 'public' and parent_column.attname = 'id'
          and exists (select 1 from pg_attribute organization_column
                      where organization_column.attrelid = parent.oid
                        and organization_column.attname = 'organization_id'
                        and not organization_column.attisdropped);

        execute format('drop trigger if exists orbiq_tenant_references on public.%I', target.relname);
        execute format(
            'create trigger orbiq_tenant_references before insert or update on public.%I '
            'for each row execute function orbiq_private.enforce_tenant_references(%s)',
            target.relname, coalesce(reference_arguments, '')
        );
    end loop;
end;
$$;

notify pgrst, 'reload schema';
commit;
