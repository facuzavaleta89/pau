-- =====================================================================
-- Fase 0 — Un alumno no puede estar inscripto dos veces en el mismo
-- horario fijo de TPA (bug N7).
--
-- Es un índice único PARCIAL (solo filas activas) y no un UNIQUE común:
-- desinscribir hoy pone `activo = false` (deactivateHorarioTPA) y volver a
-- inscribir inserta una fila nueva. Con un UNIQUE sobre todas las filas,
-- reinscribir a alguien en su viejo horario fallaría.
--
-- Verificado el 17/10/2026: no hay duplicados en la base, el índice se
-- crea sin errores.
-- =====================================================================

create unique index horarios_tpa_paciente_dia_hora_activo_key
  on public.horarios_tpa (paciente_id, dia_semana, hora)
  where activo;

-- =====================================================================
-- ROLLBACK
-- =====================================================================
-- drop index if exists public.horarios_tpa_paciente_dia_hora_activo_key;
