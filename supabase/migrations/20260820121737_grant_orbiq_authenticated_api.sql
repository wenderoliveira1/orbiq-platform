-- ===========================================================
-- ORBIQ
-- DATA API PRIVILEGES
--
-- IMPORTANTE:
-- GRANT e RLS sao camadas diferentes.
--
-- GRANT permite que o papel authenticated acesse a tabela.
-- RLS continua decidindo QUAIS linhas podem ser acessadas.
-- ===========================================================


grant usage
on schema public
to authenticated;


-- ===========================================================
-- ESTRUTURA DA EMPRESA
-- ===========================================================

grant select, update
on table public.organizations
to authenticated;


grant select, update
on table public.profiles
to authenticated;


grant select, insert, update, delete
on table public.organization_members
to authenticated;


-- ===========================================================
-- OPERACAO ORBIQ
-- ===========================================================

grant select, insert, update, delete
on table public.customers
to authenticated;


grant select, insert, update, delete
on table public.vehicles
to authenticated;


grant select, insert, update, delete
on table public.supplier_categories
to authenticated;


grant select, insert, update, delete
on table public.suppliers
to authenticated;


grant select, insert, update, delete
on table public.supplier_category_links
to authenticated;


grant select, insert, update, delete
on table public.labor_items
to authenticated;


-- ===========================================================
-- POSTGREST
-- ===========================================================

notify pgrst, 'reload schema';