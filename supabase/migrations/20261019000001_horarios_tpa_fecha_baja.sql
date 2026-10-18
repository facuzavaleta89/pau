-- =====================================================================
-- Fase 1: saber quién era alumno fijo en una semana pasada (bug N2).
--
-- Hoy desinscribir solo pone `activo = false`, sin fecha: no hay forma de
-- saber hasta cuándo alguien fue fijo de un horario. Con `fecha_baja`, la
-- grilla de cada semana muestra como fijo a quien lo era EN ESA FECHA:
--
--   fijo el día F  ⇔  fecha de alta (created_at, hora local) <= F
--                     y (activo  o  fecha_baja > F)
--
-- La app la completa al desinscribir (deactivateHorarioTPA). Las filas
-- desactivadas antes de esta migración quedan con fecha_baja NULL: no se
-- muestran como fijas en ninguna semana (solo aparecen si tienen asistencia
-- registrada). Hoy son datos de prueba.
--
-- Es un cambio aditivo (columna nullable): la app actual sigue funcionando
-- con o sin ella. Aplicarla ANTES de mergear la rama fase-1/vista-celular.
-- =====================================================================

alter table public.horarios_tpa add column fecha_baja date;

comment on column public.horarios_tpa.fecha_baja is
  'Fecha de desinscripción: es fijo de este horario en las fechas anteriores a fecha_baja. NULL si sigue activo (o si se desactivó antes de que existiera la columna).';

-- =====================================================================
-- ROLLBACK
-- =====================================================================
-- alter table public.horarios_tpa drop column if exists fecha_baja;
