-- =====================================================================
-- "Cambiar de horario" de un fijo de TPA (rama fase-3/ajustes-agenda,
-- 20/11/2026). Caso real: una fija de los lunes 16:00 pasa a los lunes
-- 18:00 desde una fecha a mitad de mes porque se liberó un lugar.
--
-- cambiar_horario_tpa(p_horario, p_nuevo, p_dia, p_hora, p_desde, p_cupo):
-- en una sola transacción cierra el horario viejo con fecha_baja = p_desde y
-- abre el nuevo (id p_nuevo, generado por la app al abrir el diálogo) con
-- fecha_alta = p_desde. Devuelve el id del nuevo.
-- Valida (mismas reglas que conflictoFechaCambio y conflictoDestino en
-- src/lib/horarios.ts; las del lugar, como deshacer_baja_horario_tpa):
--   - el horario viejo está activo y el paciente también;
--   - p_desde no es anterior al alta del viejo y es posterior a la última
--     asistencia suya ya cargada en el viejo;
--   - el destino es otro día u hora y no tiene ya un horario ahí;
--   - hay lugar en el destino desde p_desde: menos fijos que el cupo y
--     ninguna clase ya registrada desde p_desde completa sin él ni con él
--     anotado de otra forma (recupera, cambio, suelta).
-- Si algo falla, avisa ("TPA: …") y no cambia nada. Repetirla con el mismo
-- p_nuevo después de un corte no duplica: si ya está hecha, devuelve el id.
--
-- security invoker (RLS de quien llama), search_path vacío, execute solo
-- authenticated (revoke a public y anon). Usa public.dia_tpa_de_fecha de la
-- migración 20261120000001 (ya aplicada).
--
-- Compatible con la app de `main`: solo agrega una función nueva, no cambia
-- tablas ni funciones existentes. Se puede aplicar antes del merge.
-- =====================================================================

begin;

create function public.cambiar_horario_tpa(
  p_horario uuid, p_nuevo uuid, p_dia text, p_hora time, p_desde date, p_cupo integer
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  h public.horarios_tpa%rowtype;
  v_activo boolean;
  v_fecha date;
begin
  if p_cupo is null or p_cupo < 1 then
    raise exception 'TPA: falta el cupo de la clase.';
  end if;
  if p_nuevo is null or p_dia is null or p_hora is null or p_desde is null then
    raise exception 'TPA: faltan el horario nuevo o la fecha del cambio.';
  end if;

  -- Ya hecho (reintento después de un corte): devolver el mismo id.
  if exists (select 1 from public.horarios_tpa where id = p_nuevo) then
    if exists (
      select 1
        from public.horarios_tpa n
        join public.horarios_tpa v on v.id = p_horario
       where n.id = p_nuevo and n.paciente_id = v.paciente_id
         and n.dia_semana = p_dia and n.hora = p_hora and n.fecha_alta = p_desde
         and not v.activo and v.fecha_baja = p_desde
    ) then
      return p_nuevo;
    end if;
    raise exception 'TPA: el horario nuevo ya existe con otros datos. Cerrá y volvé a abrir la pantalla.';
  end if;

  select * into h from public.horarios_tpa where id = p_horario for update;
  if not found then
    raise exception 'TPA: no se encontró el horario (puede que se haya borrado o que la sesión se haya cerrado).';
  end if;
  if not h.activo then
    raise exception 'TPA: este horario ya no está activo (puede que ya se haya cambiado o dado de baja).';
  end if;

  select activo into v_activo from public.pacientes where id = h.paciente_id;
  if not coalesce(v_activo, false) then
    raise exception 'TPA: el paciente está dado de baja: primero hay que reactivarlo, desde su historia clínica.';
  end if;

  if p_desde < h.fecha_alta then
    raise exception 'TPA: es fijo desde el %: el cambio no puede ser antes.', to_char(h.fecha_alta, 'DD/MM');
  end if;

  if p_dia not in ('lunes', 'miercoles', 'viernes') then
    raise exception 'TPA: las clases son los lunes, miércoles y viernes.';
  end if;
  if p_dia = h.dia_semana and p_hora = h.hora then
    raise exception 'TPA: es el mismo horario.';
  end if;

  -- Última asistencia suya en el horario viejo.
  select max(c.fecha) into v_fecha
    from public.asistencia_tpa a
    join public.clases_tpa c on c.id = a.clase_id
   where a.paciente_id = h.paciente_id
     and c.hora = h.hora and public.dia_tpa_de_fecha(c.fecha) = h.dia_semana
     and c.fecha >= h.fecha_alta;
  if v_fecha is not null and v_fecha >= p_desde then
    raise exception 'TPA: ya tiene asistencia cargada el % en este horario: el cambio tiene que ser después de esa fecha.',
      to_char(v_fecha, 'DD/MM');
  end if;

  -- Destino: sin otro horario suyo vigente desde p_desde.
  if exists (
    select 1 from public.horarios_tpa o
     where o.paciente_id = h.paciente_id and o.id <> h.id
       and o.dia_semana = p_dia and o.hora = p_hora
       and (o.activo or o.fecha_baja > p_desde)
  ) then
    raise exception 'TPA: ya tiene un horario ese día y hora.';
  end if;

  if (
    select count(distinct o.paciente_id) from public.horarios_tpa o
     where o.paciente_id <> h.paciente_id
       and o.dia_semana = p_dia and o.hora = p_hora
       and (o.activo or o.fecha_baja > p_desde)
  ) >= p_cupo then
    raise exception 'TPA: el horario nuevo ya tiene los % lugares ocupados por fijos.', p_cupo;
  end if;

  -- Clases ya registradas en el destino desde p_desde (no canceladas).
  select min(c.fecha) into v_fecha
    from public.clases_tpa c
    join public.asistencia_tpa a on a.clase_id = c.id and a.paciente_id = h.paciente_id and a.tipo <> 'fijo'
   where c.hora = p_hora and public.dia_tpa_de_fecha(c.fecha) = p_dia
     and c.fecha >= p_desde and c.motivo_cancelacion is null;
  if v_fecha is not null then
    raise exception 'TPA: ya está anotado en la clase del % de otra forma (recupera, cambio o suelta).', to_char(v_fecha, 'DD/MM');
  end if;

  -- Ocupados sin él, como contarLugares (src/lib/tpa.ts).
  select min(c.fecha) into v_fecha
    from public.clases_tpa c
   where c.hora = p_hora and public.dia_tpa_de_fecha(c.fecha) = p_dia
     and c.fecha >= p_desde and c.motivo_cancelacion is null
     and not exists (
       select 1 from public.asistencia_tpa a
        where a.clase_id = c.id and a.paciente_id = h.paciente_id
          and a.estado in ('aviso_con_tiempo', 'aviso_sin_tiempo'))
     and (
       (select count(*) from public.asistencia_tpa a
         where a.clase_id = c.id and a.paciente_id <> h.paciente_id
           and not (a.tipo = 'fijo' and a.estado in ('aviso_con_tiempo', 'aviso_sin_tiempo')))
       + (select count(distinct o.paciente_id) from public.horarios_tpa o
         where o.paciente_id <> h.paciente_id
           and o.dia_semana = p_dia and o.hora = p_hora
           and o.fecha_alta <= c.fecha
           and (o.activo or o.fecha_baja > c.fecha)
           and not exists (select 1 from public.asistencia_tpa a where a.clase_id = c.id and a.paciente_id = o.paciente_id))
     ) >= p_cupo;
  if v_fecha is not null then
    raise exception 'TPA: la clase del % del horario nuevo ya está completa: no queda lugar.', to_char(v_fecha, 'DD/MM');
  end if;

  update public.horarios_tpa set activo = false, fecha_baja = p_desde where id = h.id;
  insert into public.horarios_tpa (id, paciente_id, dia_semana, hora, activo, fecha_alta)
  values (p_nuevo, h.paciente_id, p_dia, p_hora, true, p_desde);

  return p_nuevo;
end;
$$;

revoke all on function public.cambiar_horario_tpa(uuid, uuid, text, time, date, integer) from public, anon;
grant execute on function public.cambiar_horario_tpa(uuid, uuid, text, time, date, integer) to authenticated;

commit;

-- =====================================================================
-- Verificación (correr después de aplicar):
--
-- select p.proname, p.prosecdef,
--        has_function_privilege('anon', p.oid, 'execute') as anon,
--        has_function_privilege('authenticated', p.oid, 'execute') as authenticated
--   from pg_proc p
--  where p.pronamespace = 'public'::regnamespace and p.proname = 'cambiar_horario_tpa';
-- -- 1 fila: prosecdef = false, anon = false, authenticated = true.
-- =====================================================================

-- =====================================================================
-- Rollback (solo si hace falta volver atrás; no toca datos: los cambios de
-- horario ya hechos quedan como una baja + un alta normales):
--
-- drop function if exists public.cambiar_horario_tpa(uuid, uuid, text, time, date, integer);
-- =====================================================================
