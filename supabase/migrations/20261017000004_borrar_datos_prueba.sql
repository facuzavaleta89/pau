-- =====================================================================
-- Fase 0 — Borrar los datos de prueba (cargados el 20/05/2026).
--
-- Es un cambio de DATOS, no de esquema. Está en un archivo aparte para
-- poder aplicarlo (o no) por separado.
--
-- Protección: si encuentra CUALQUIER fila creada después del 20/05/2026
-- (o sea, posiblemente real), aborta sin borrar nada. Así, si este archivo
-- se vuelve a ejecutar por error en el futuro (por ejemplo con
-- `supabase db push`), no borra pacientes reales.
-- =====================================================================

do $$
begin
  if exists (select 1 from public.pacientes      where created_at >= '2026-05-21')
  or exists (select 1 from public.sesiones_rpg   where created_at >= '2026-05-21')
  or exists (select 1 from public.horarios_tpa   where created_at >= '2026-05-21')
  or exists (select 1 from public.clases_tpa     where created_at >= '2026-05-21')
  or exists (select 1 from public.asistencia_tpa where created_at >= '2026-05-21')
  or exists (select 1 from public.pagos          where created_at >= '2026-05-21')
  or exists (select 1 from public.lista_espera   where created_at >= '2026-05-21')
  then
    raise exception 'Hay filas creadas después del 20/05/2026: no se borra nada. Revisar a mano.';
  end if;

  delete from public.asistencia_tpa;
  delete from public.clases_tpa;
  delete from public.lista_espera;
  delete from public.pagos;
  delete from public.sesiones_rpg;
  delete from public.horarios_tpa;
  delete from public.pacientes;
end;
$$;

-- =====================================================================
-- ROLLBACK
-- No tiene: los datos borrados no se recuperan. Son de prueba (confirmado
-- por Facu el 17/10/2026). Si se quisieran conservar, exportar cada tabla
-- a CSV desde el Table Editor ANTES de ejecutar este archivo.
-- =====================================================================
