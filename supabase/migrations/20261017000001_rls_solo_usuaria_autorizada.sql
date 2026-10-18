-- =====================================================================
-- Fase 0 — RLS: solo la usuaria autorizada (Pau) puede leer y escribir.
--
-- Qué hace:
--   1. Crea el esquema `private` (NO expuesto por la API de Supabase) con:
--      - la tabla `private.usuarias_autorizadas` (lista de UIDs permitidos);
--      - la función `private.es_usuaria_autorizada()`.
--   2. Borra las políticas "Permitir todo a publico en …".
--   3. Crea una política por tabla, solo para `authenticated`, que exige
--      que el UID esté en la lista de autorizadas.
--   4. Defensa en profundidad: quita al rol `anon` todos los permisos sobre
--      las tablas de `public` (también para tablas futuras).
--
-- ⚠️ Después de aplicar esta migración la app deja de funcionar sin login.
--    Aplicarla recién cuando el login esté implementado (ver respuesta.md).
--
-- ⚠️ El UID de Pau NO va en este archivo (el repo es público). Después de
--    aplicar, insertarlo a mano en el SQL Editor:
--      insert into private.usuarias_autorizadas (user_id, nota)
--      select id, 'Pau' from auth.users where email = '<email de Pau>';
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Lista de usuarias autorizadas (esquema privado)
-- ---------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table private.usuarias_autorizadas (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  nota       text,
  created_at timestamptz not null default now()
);

revoke all on private.usuarias_autorizadas from public, anon, authenticated;

-- security definer: lee la tabla privada sin darle permisos a `authenticated`.
-- search_path vacío + nombres calificados: no se puede secuestrar.
create function private.es_usuaria_autorizada()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.usuarias_autorizadas
    where user_id = (select auth.uid())
  );
$$;

revoke all on function private.es_usuaria_autorizada() from public, anon;
grant execute on function private.es_usuaria_autorizada() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Borrar las políticas abiertas
-- ---------------------------------------------------------------------

drop policy if exists "Permitir todo a publico en pacientes"      on public.pacientes;
drop policy if exists "Permitir todo a publico en sesiones_rpg"   on public.sesiones_rpg;
drop policy if exists "Permitir todo a publico en horarios_tpa"   on public.horarios_tpa;
drop policy if exists "Permitir todo a publico en clases_tpa"     on public.clases_tpa;
drop policy if exists "Permitir todo a publico en asistencia_tpa" on public.asistencia_tpa;
drop policy if exists "Permitir todo a publico en pagos"          on public.pagos;

-- ---------------------------------------------------------------------
-- 3. Políticas nuevas: solo `authenticated` + UID autorizado
--    `(select …)` hace que Postgres evalúe la función una vez por consulta,
--    no una vez por fila.
-- ---------------------------------------------------------------------

create policy "Solo usuaria autorizada" on public.pacientes
  for all to authenticated
  using ((select private.es_usuaria_autorizada()))
  with check ((select private.es_usuaria_autorizada()));

create policy "Solo usuaria autorizada" on public.sesiones_rpg
  for all to authenticated
  using ((select private.es_usuaria_autorizada()))
  with check ((select private.es_usuaria_autorizada()));

create policy "Solo usuaria autorizada" on public.horarios_tpa
  for all to authenticated
  using ((select private.es_usuaria_autorizada()))
  with check ((select private.es_usuaria_autorizada()));

create policy "Solo usuaria autorizada" on public.clases_tpa
  for all to authenticated
  using ((select private.es_usuaria_autorizada()))
  with check ((select private.es_usuaria_autorizada()));

create policy "Solo usuaria autorizada" on public.asistencia_tpa
  for all to authenticated
  using ((select private.es_usuaria_autorizada()))
  with check ((select private.es_usuaria_autorizada()));

create policy "Solo usuaria autorizada" on public.pagos
  for all to authenticated
  using ((select private.es_usuaria_autorizada()))
  with check ((select private.es_usuaria_autorizada()));

-- lista_espera no tenía políticas (inaccesible). Se le da la misma regla
-- para que quede lista cuando se haga su pantalla.
create policy "Solo usuaria autorizada" on public.lista_espera
  for all to authenticated
  using ((select private.es_usuaria_autorizada()))
  with check ((select private.es_usuaria_autorizada()));

-- ---------------------------------------------------------------------
-- 4. Defensa en profundidad: `anon` sin permisos sobre las tablas
--    Aunque alguien cree por error una política `to public`, anon no
--    podrá usarla porque no tiene el GRANT de la tabla.
-- ---------------------------------------------------------------------

revoke all on all tables in schema public from anon;

-- Tablas y funciones que cree el rol postgres en el futuro (SQL Editor).
alter default privileges for role postgres in schema public
  revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke all on functions from anon;

commit;

-- =====================================================================
-- ROLLBACK (ejecutar a mano solo si hay que volver atrás)
-- Vuelve al estado INSEGURO anterior: la app funciona sin login.
-- =====================================================================
-- begin;
-- drop policy if exists "Solo usuaria autorizada" on public.pacientes;
-- drop policy if exists "Solo usuaria autorizada" on public.sesiones_rpg;
-- drop policy if exists "Solo usuaria autorizada" on public.horarios_tpa;
-- drop policy if exists "Solo usuaria autorizada" on public.clases_tpa;
-- drop policy if exists "Solo usuaria autorizada" on public.asistencia_tpa;
-- drop policy if exists "Solo usuaria autorizada" on public.pagos;
-- drop policy if exists "Solo usuaria autorizada" on public.lista_espera;
--
-- create policy "Permitir todo a publico en pacientes"      on public.pacientes      for all to public using (true) with check (true);
-- create policy "Permitir todo a publico en sesiones_rpg"   on public.sesiones_rpg   for all to public using (true) with check (true);
-- create policy "Permitir todo a publico en horarios_tpa"   on public.horarios_tpa   for all to public using (true) with check (true);
-- create policy "Permitir todo a publico en clases_tpa"     on public.clases_tpa     for all to public using (true) with check (true);
-- create policy "Permitir todo a publico en asistencia_tpa" on public.asistencia_tpa for all to public using (true) with check (true);
-- create policy "Permitir todo a publico en pagos"          on public.pagos          for all to public using (true) with check (true);
--
-- grant all on all tables in schema public to anon;
-- alter default privileges for role postgres in schema public grant all on tables to anon;
-- alter default privileges for role postgres in schema public grant execute on functions to anon;
--
-- drop function if exists private.es_usuaria_autorizada();
-- drop table if exists private.usuarias_autorizadas;
-- drop schema if exists private;
-- commit;
