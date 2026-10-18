-- =====================================================================
-- Fase 0.5: "¿estoy autorizada?" para la app.
--
-- Con RLS, un usuario autenticado que NO está en
-- private.usuarias_autorizadas ve todas las listas vacías, sin ningún
-- error. La app llama a esta función después del login para poder decirle
-- claramente "tu usuario no está autorizado".
--
-- - Está en `public` porque `private` no está expuesto en la API.
-- - Es SECURITY INVOKER: no necesita privilegios extra. `authenticated` ya
--   tiene USAGE en `private` y EXECUTE en private.es_usuaria_autorizada()
--   (migración 20261017000001), que es la que lee la tabla privada.
-- - Solo devuelve true/false sobre el propio usuario: no expone la lista.
-- - Solo la puede ejecutar `authenticated`. Hay que revocar también a
--   PUBLIC: Postgres le da EXECUTE a PUBLIC por defecto en toda función nueva.
--
-- Mientras no esté aplicada, la app no muestra el aviso y funciona igual que
-- antes (ver respuesta.md / AvisoNoAutorizada).
-- =====================================================================

begin;

create function public.soy_autorizada()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.es_usuaria_autorizada();
$$;

revoke all on function public.soy_autorizada() from public, anon;
grant execute on function public.soy_autorizada() to authenticated;

commit;

-- =====================================================================
-- ROLLBACK
-- =====================================================================
-- drop function if exists public.soy_autorizada();
