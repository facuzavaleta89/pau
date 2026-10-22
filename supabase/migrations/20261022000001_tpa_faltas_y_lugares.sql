-- =====================================================================
-- Fase 1 — Asistencia TPA, entrega 2: estados nuevos definitivos, quién
-- ocupa cada lugar, avisos con fecha, clases canceladas y fecha de alta de
-- los fijos. Diseño: docs/DISENO_ASISTENCIA_TPA.md (secciones 2 y 4).
--
-- Una sola migración (sin expandir/contraer). ANTES: correr
-- supabase/scripts/20261022_borrar_asistencia_prueba.sql. Se aplica justo
-- antes de probar el preview y se mergea el mismo día. Mientras tanto, la app
-- de producción (entrega 1) lee los estados nuevos sin romperse, pero no
-- puede guardar "Avisó", "Recupera", "De otro horario" ni "Cancelado" (los
-- rechaza el check). "Presente" y "Faltó" siguen funcionando.
--
-- Todo en una transacción: si algo falla, no cambia nada.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Solo sobre datos limpios
-- ---------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from public.asistencia_tpa
    where estado is null or estado not in ('presente', 'falto_sin_avisar')
  ) then
    raise exception 'Hay asistencias con estados viejos: correr antes supabase/scripts/20261022_borrar_asistencia_prueba.sql.';
  end if;

  if exists (select 1 from public.asistencia_tpa where clase_id is null or paciente_id is null or created_at is null)
  or exists (select 1 from public.horarios_tpa where paciente_id is null or dia_semana is null or activo is null or created_at is null)
  or exists (select 1 from public.clases_tpa where created_at is null)
  then
    raise exception 'Hay filas con columnas vacías que pasan a ser obligatorias: revisar a mano.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Estados definitivos
--    fijo:           presente | aviso_con_tiempo | aviso_sin_tiempo | falto_sin_avisar
--                    (sin marcar = sin fila; nunca 'pendiente')
--    quien ocupa:    pendiente | presente | falto_sin_avisar
-- ---------------------------------------------------------------------
alter table public.asistencia_tpa drop constraint asistencia_tpa_estado_check;
alter table public.asistencia_tpa add constraint asistencia_tpa_estado_check
  check (estado = any (array['presente', 'aviso_con_tiempo', 'aviso_sin_tiempo', 'falto_sin_avisar', 'pendiente']));
alter table public.asistencia_tpa alter column estado drop default;

-- ---------------------------------------------------------------------
-- 2. Nulos que no tienen sentido
-- ---------------------------------------------------------------------
alter table public.asistencia_tpa
  alter column clase_id    set not null,
  alter column paciente_id set not null,
  alter column estado      set not null,
  alter column created_at  set not null;

alter table public.horarios_tpa
  alter column paciente_id set not null,
  alter column dia_semana  set not null,
  alter column activo      set not null,
  alter column created_at  set not null;

alter table public.clases_tpa
  alter column created_at set not null;

-- ---------------------------------------------------------------------
-- 3. Quién ocupa cada lugar y cuándo avisó
-- ---------------------------------------------------------------------
alter table public.asistencia_tpa
  add column tipo           text not null default 'fijo',
  add column ocupa_lugar_de uuid,
  add column avisado_at     timestamptz,
  add column updated_at     timestamptz not null default now();

alter table public.asistencia_tpa
  add constraint asistencia_tpa_tipo_check
    check (tipo = any (array['fijo', 'recupera', 'cambio', 'suelta'])),
  -- Si se borra la fila del fijo (vuelve a "Sin marcar" o se borra el
  -- paciente), quien ocupaba su lugar queda en un lugar libre.
  add constraint asistencia_tpa_ocupa_lugar_de_fkey
    foreign key (ocupa_lugar_de) references public.asistencia_tpa (id) on delete set null,
  -- Un lugar lo ocupa una sola persona (crea también el índice).
  add constraint asistencia_tpa_ocupa_lugar_de_key unique (ocupa_lugar_de),
  add constraint asistencia_tpa_ocupa_solo_no_fijos
    check (ocupa_lugar_de is null or tipo <> 'fijo'),
  add constraint asistencia_tpa_estado_segun_tipo
    check (
      (tipo = 'fijo' and estado <> 'pendiente')
      or (tipo <> 'fijo' and estado = any (array['pendiente', 'presente', 'falto_sin_avisar']))
    ),
  -- Todo aviso lleva su fecha, y solo los avisos la llevan.
  add constraint asistencia_tpa_avisado_at_solo_avisos
    check ((avisado_at is not null) = (estado = any (array['aviso_con_tiempo', 'aviso_sin_tiempo'])));

comment on column public.asistencia_tpa.tipo is
  'fijo = alumno fijo de este horario; recupera / cambio / suelta = viene a ocupar un lugar solo en esta clase.';
comment on column public.asistencia_tpa.ocupa_lugar_de is
  'Fila del fijo (misma clase, que avisó) cuyo lugar ocupa. NULL = ocupa un lugar libre.';
comment on column public.asistencia_tpa.avisado_at is
  'Momento en que se cargó el aviso de falta (para con tiempo / sin tiempo). Solo en avisos.';

-- Historia clínica y recuperaciones buscan por paciente.
create index asistencia_tpa_paciente_id_idx on public.asistencia_tpa (paciente_id);

create trigger asistencia_tpa_updated_at
  before update on public.asistencia_tpa
  for each row execute function public.update_updated_at();

-- ---------------------------------------------------------------------
-- 4. ocupa_lugar_de: tiene que ser un fijo de la misma clase que avisó.
--    Un check no puede mirar otras filas: lo hace un trigger. Es una red de
--    seguridad (la app valida lo mismo). Mensajes sin datos de pacientes.
-- ---------------------------------------------------------------------
create function public.validar_asistencia_tpa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Quien ocupa un lugar: el lugar tiene que ser de un fijo de esta clase que avisó.
  if new.ocupa_lugar_de is not null and not exists (
    select 1 from public.asistencia_tpa f
    where f.id = new.ocupa_lugar_de
      and f.clase_id = new.clase_id
      and f.tipo = 'fijo'
      and f.estado = any (array['aviso_con_tiempo', 'aviso_sin_tiempo'])
  ) then
    raise exception 'ocupa_lugar_de tiene que ser un fijo de la misma clase que avisó'
      using errcode = '23514';
  end if;

  -- El fijo cuyo lugar está ocupado no puede dejar de ser "avisó" ni
  -- cambiar de clase: primero hay que sacar o mover a quien ocupa su lugar.
  if tg_op = 'UPDATE'
     and (new.tipo <> 'fijo'
          or new.estado <> all (array['aviso_con_tiempo', 'aviso_sin_tiempo'])
          or new.clase_id <> old.clase_id)
     and exists (select 1 from public.asistencia_tpa o where o.ocupa_lugar_de = new.id)
  then
    raise exception 'Alguien ocupa el lugar de este fijo: primero hay que sacarlo de la clase'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Solo la usa el trigger: nadie la ejecuta por la API.
revoke all on function public.validar_asistencia_tpa() from public, anon, authenticated;

create trigger asistencia_tpa_validar
  before insert or update of clase_id, tipo, estado, ocupa_lugar_de
  on public.asistencia_tpa
  for each row execute function public.validar_asistencia_tpa();

-- ---------------------------------------------------------------------
-- 5. Clase cancelada: un solo dato con valores fijos (no un boolean + texto
--    libre). Cada motivo tiene reglas de recuperación distintas y así no
--    puede quedar "cancelada sin motivo". Corte de luz, paro, etc. =
--    cancelada_por_pau (decisión del 22/10/2026). La UI llega en la entrega 3.
-- ---------------------------------------------------------------------
alter table public.clases_tpa
  add column motivo_cancelacion text,
  add constraint clases_tpa_motivo_cancelacion_check
    check (motivo_cancelacion = any (array['feriado', 'cancelada_por_pau']));

comment on column public.clases_tpa.motivo_cancelacion is
  'NULL = la clase se da. feriado = recupera solo si queda con menos de 4 clases en el mes por vez por semana (en total). cancelada_por_pau = se recupera siempre, fuera del tope y sin vencimiento.';

-- ---------------------------------------------------------------------
-- 6. Desde cuándo es fijo (editable al inscribir; reemplaza a created_at en
--    eraFijoEn). Los existentes: el día de la inscripción en hora argentina.
-- ---------------------------------------------------------------------
alter table public.horarios_tpa add column fecha_alta date;

update public.horarios_tpa
set fecha_alta = (created_at at time zone 'America/Argentina/Buenos_Aires')::date;

alter table public.horarios_tpa
  alter column fecha_alta set not null,
  alter column fecha_alta set default ((now() at time zone 'America/Argentina/Buenos_Aires')::date),
  -- Desinscribir un alta futura deja fecha_baja = fecha_alta (nunca fue fijo).
  add constraint horarios_tpa_baja_despues_de_alta
    check (fecha_baja is null or fecha_baja >= fecha_alta);

comment on column public.horarios_tpa.fecha_alta is
  'Desde qué fecha es fijo de este horario (inclusive).';

commit;

-- =====================================================================
-- ROLLBACK (pierde C.T./S.T., quién ocupa, las cancelaciones y las fechas
-- de alta). Correr todo junto en el SQL Editor.
-- =====================================================================
-- begin;
-- alter table public.horarios_tpa drop constraint if exists horarios_tpa_baja_despues_de_alta;
-- alter table public.horarios_tpa drop column if exists fecha_alta;
-- alter table public.clases_tpa drop column if exists motivo_cancelacion;
-- drop trigger if exists asistencia_tpa_validar on public.asistencia_tpa;
-- drop function if exists public.validar_asistencia_tpa();
-- drop trigger if exists asistencia_tpa_updated_at on public.asistencia_tpa;
-- drop index if exists public.asistencia_tpa_paciente_id_idx;
-- -- Las filas que el esquema viejo no admite se borran (no hay a qué convertirlas).
-- delete from public.asistencia_tpa where tipo <> 'fijo' or estado not in ('presente', 'falto_sin_avisar');
-- alter table public.asistencia_tpa
--   drop constraint if exists asistencia_tpa_avisado_at_solo_avisos,
--   drop constraint if exists asistencia_tpa_estado_segun_tipo,
--   drop constraint if exists asistencia_tpa_ocupa_solo_no_fijos,
--   drop constraint if exists asistencia_tpa_ocupa_lugar_de_key,
--   drop constraint if exists asistencia_tpa_ocupa_lugar_de_fkey,
--   drop constraint if exists asistencia_tpa_tipo_check,
--   drop column if exists updated_at,
--   drop column if exists avisado_at,
--   drop column if exists ocupa_lugar_de,
--   drop column if exists tipo;
-- alter table public.asistencia_tpa drop constraint asistencia_tpa_estado_check;
-- alter table public.asistencia_tpa add constraint asistencia_tpa_estado_check check (estado = any (array[
--   'presente', 'aviso_ausencia', 'falto_sin_avisar', 'recupera', 'vino_otra_clase', 'cancelado', 'pendiente']));
-- alter table public.asistencia_tpa alter column estado set default 'pendiente';
-- alter table public.asistencia_tpa
--   alter column clase_id drop not null, alter column paciente_id drop not null,
--   alter column estado drop not null, alter column created_at drop not null;
-- alter table public.horarios_tpa
--   alter column paciente_id drop not null, alter column dia_semana drop not null,
--   alter column activo drop not null, alter column created_at drop not null;
-- alter table public.clases_tpa alter column created_at drop not null;
-- commit;
