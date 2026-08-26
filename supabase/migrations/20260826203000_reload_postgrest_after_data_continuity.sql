-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 1.9G — HARDENING DE DESENVOLVIMENTO
-- ===========================================================
--
-- As RPCs da fase 1.9G são expostas pelo PostgREST. Em ambientes locais
-- persistentes, uma nova migration pode ser aplicada enquanto o serviço REST
-- permanece ativo com um schema cache anterior. O NOTIFY abaixo solicita a
-- recarga explícita e evita falsos erros de "function not found in schema cache"
-- depois de atualizar a branch.
--
-- Este comando é idempotente e não altera dados.

notify pgrst, 'reload schema';
