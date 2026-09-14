-- ORBIQ: protocolo curto ORB-YYMMDD-XXXX (sem hora).
-- Não altera fórmula de preço, RLS nem dados existentes.

create or replace function public.orbiq_next_quote_protocol()
returns text
language sql
volatile
set search_path = public
as $$
  select
    'ORB-'
    || to_char(clock_timestamp(), 'YYMMDD')
    || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
$$;

revoke all on function public.orbiq_next_quote_protocol() from public, anon;
grant execute on function public.orbiq_next_quote_protocol() to authenticated;

do $patch$
declare
  src text;
begin
  select pg_get_functiondef(
    'public.create_quote_with_quantities(uuid,uuid,uuid,text,integer,text,jsonb,jsonb)'::regprocedure
  )
  into src;

  if src is null then
    raise exception 'create_quote_with_quantities not found';
  end if;

  src := replace(
    src,
    $$'ORB-' || to_char(now(),'YYMMDD-HH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,4))$$,
    $$public.orbiq_next_quote_protocol()$$
  );

  src := replace(
    src,
    $$'ORB-' || to_char(now(), 'YYMMDD-HH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4))$$,
    $$public.orbiq_next_quote_protocol()$$
  );

  src := regexp_replace(src, '^CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION');

  execute src;
end
$patch$;
