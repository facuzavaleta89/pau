-- =====================================================================
-- Borrar las clases y asistencias TPA de prueba (entrega 2 de asistencia).
--
-- NO es una migración: es un cambio de DATOS que se corre una sola vez, en
-- el SQL Editor, INMEDIATAMENTE ANTES de
-- supabase/migrations/20261022000001_tpa_faltas_y_lugares.sql.
-- Está fuera de supabase/migrations/ para que `supabase db push` nunca lo
-- ejecute.
--
-- Borra TODAS las filas de clases_tpa (y sus asistencias, por el
-- ON DELETE CASCADE). No toca pacientes, horarios fijos, turnos ni pagos.
--
-- Protección (si algo no coincide, no borra nada):
--   1. Si la migración de la entrega 2 ya se aplicó (existe
--      asistencia_tpa.tipo), aborta: desde ahí las asistencias son del
--      modelo nuevo y pueden ser reales.
--   2. Si hay más filas que las de prueba conocidas, aborta.
--      Contadas con el MCP de solo lectura el 22/10/2026: 10 asistencias y
--      5 clases. Si cargaste más pruebas después, ACTUALIZAR los números
--      con el select de abajo antes de correrlo.
--   3. Si hay clases de fechas fuera de las pruebas (12/10 a 26/10/2026)
--      o filas creadas después del 23/10/2026, aborta.
--
--   select (select count(*) from public.asistencia_tpa) as asistencias,
--          (select count(*) from public.clases_tpa)     as clases,
--          (select min(fecha) || ' a ' || max(fecha) from public.clases_tpa) as fechas;
-- =====================================================================

do $$
declare
  max_asistencias constant int := 10;
  max_clases      constant int := 5;
  n_asistencias int;
  n_clases      int;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'asistencia_tpa' and column_name = 'tipo'
  ) then
    raise exception 'La migración de la entrega 2 ya está aplicada: no se borra nada.';
  end if;

  select count(*) into n_asistencias from public.asistencia_tpa;
  select count(*) into n_clases from public.clases_tpa;

  if n_asistencias > max_asistencias or n_clases > max_clases then
    raise exception 'Hay % asistencias y % clases (se esperaban como máximo % y %): no se borra nada.',
      n_asistencias, n_clases, max_asistencias, max_clases;
  end if;

  if exists (select 1 from public.clases_tpa where fecha < '2026-10-12' or fecha > '2026-10-26')
  or exists (select 1 from public.clases_tpa where created_at >= '2026-10-24')
  or exists (select 1 from public.asistencia_tpa where created_at >= '2026-10-24')
  then
    raise exception 'Hay clases o asistencias fuera de las de prueba conocidas: no se borra nada. Revisar a mano.';
  end if;

  delete from public.clases_tpa;  -- borra también sus asistencias (on delete cascade)

  if exists (select 1 from public.asistencia_tpa) then
    raise exception 'Quedaron asistencias sin clase: no se borra nada.';
  end if;

  raise notice 'Borradas % clases y % asistencias de prueba.', n_clases, n_asistencias;
end;
$$;

-- =====================================================================
-- ROLLBACK
-- No tiene: los datos borrados no se recuperan. Son de prueba (decisión de
-- Facu del 21/10/2026). Para conservarlos, exportar clases_tpa y
-- asistencia_tpa a CSV desde el Table Editor ANTES de correr esto (y no
-- guardar ese CSV en el repo).
-- =====================================================================
