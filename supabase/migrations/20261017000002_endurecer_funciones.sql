-- =====================================================================
-- Fase 0 — Advisors de seguridad de Supabase
--
-- 1. rls_auto_enable(): es SECURITY DEFINER y hoy la pueden ejecutar
--    PUBLIC, anon y authenticated vía /rest/v1/rpc/rls_auto_enable.
--    Solo la usa el event trigger `ensure_rls`, que la invoca el sistema:
--    no necesita el permiso EXECUTE de esos roles.
--    Ojo: hay que revocar también a PUBLIC (el ACL actual es "=X/postgres");
--    revocar solo a anon/authenticated no alcanza.
-- 2. update_updated_at(): search_path fijo y vacío (usa solo now(), que
--    vive en pg_catalog y se resuelve igual).
--
-- Se puede aplicar en cualquier momento: no afecta a la app.
-- =====================================================================

begin;

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

alter function public.update_updated_at() set search_path = '';

commit;

-- =====================================================================
-- ROLLBACK
-- =====================================================================
-- begin;
-- grant execute on function public.rls_auto_enable() to public, anon, authenticated;
-- alter function public.update_updated_at() reset search_path;
-- commit;
