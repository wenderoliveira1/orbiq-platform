-- Funilaria/voz não podem falhar o orçamento por corrida no catálogo.
-- Mesma fórmula de preço. Sem service_role.

create or replace function public.save_service_catalog(
    target_org_id uuid,
    target_category text,
    target_description text,
    target_labor_amount numeric
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
    service_uuid uuid;
    normalized_category text;
    normalized_description text;
    normalized_amount numeric(12,2);
begin
    if auth.uid() is null then raise exception 'Authentication required'; end if;
    if not public.is_org_member(target_org_id) then raise exception 'User does not belong to organization'; end if;

    normalized_category := nullif(upper(btrim(coalesce(target_category, ''))), '');
    normalized_description := upper(btrim(coalesce(target_description, '')));
    normalized_amount := round(coalesce(target_labor_amount, 0), 2);

    if normalized_category is null then raise exception 'Service category is required'; end if;
    if char_length(normalized_description) < 2 then raise exception 'Service description is required'; end if;
    if normalized_amount < 0 then raise exception 'Invalid labor amount'; end if;

    select id into service_uuid
    from public.service_catalog
    where organization_id = target_org_id
      and lower(btrim(category)) = lower(normalized_category)
      and lower(btrim(description)) = lower(normalized_description)
    limit 1;

    if service_uuid is not null then
        update public.service_catalog
        set category = normalized_category,
            description = normalized_description,
            default_labor_amount = normalized_amount,
            active = true
        where id = service_uuid
          and organization_id = target_org_id;
        return service_uuid;
    end if;

    begin
        insert into public.service_catalog (
            organization_id,
            category,
            description,
            default_labor_amount,
            requires_part,
            active
        )
        values (
            target_org_id,
            normalized_category,
            normalized_description,
            normalized_amount,
            false,
            true
        )
        returning id into service_uuid;
    exception
        when unique_violation then
            select id into service_uuid
            from public.service_catalog
            where organization_id = target_org_id
              and lower(btrim(category)) = lower(normalized_category)
              and lower(btrim(description)) = lower(normalized_description)
            limit 1;
            if service_uuid is null then
                raise;
            end if;
            update public.service_catalog
            set default_labor_amount = normalized_amount,
                active = true
            where id = service_uuid
              and organization_id = target_org_id;
    end;

    return service_uuid;
end;
$$;

revoke all on function public.save_service_catalog(uuid, text, text, numeric) from public, anon;
grant execute on function public.save_service_catalog(uuid, text, text, numeric) to authenticated;

notify pgrst, 'reload schema';
