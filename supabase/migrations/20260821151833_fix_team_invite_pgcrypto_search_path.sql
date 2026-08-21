-- ===========================================================
-- ORBIQ PLATFORM
-- HOTFIX 1.7A.1
--
-- PGCRYPTO SEARCH PATH
--
-- Em Supabase o pgcrypto pode estar no schema extensions.
-- As funcoes da Fase 1.7A estavam limitadas a public.
-- ===========================================================


alter function
public.create_organization_invite(
    uuid,
    text,
    text
)
set search_path =
    public,
    extensions;


alter function
public.public_get_organization_invite(
    text
)
set search_path =
    public,
    extensions;


alter function
public.accept_organization_invite(
    text
)
set search_path =
    public,
    extensions;


notify pgrst, 'reload schema';