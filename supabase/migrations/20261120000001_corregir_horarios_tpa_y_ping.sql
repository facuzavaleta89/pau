-- =====================================================================
-- Corregir horarios de TPA cargados por error + ping para mantener activo
-- el proyecto (rama fase-3/correcciones-horarios, 20/11/2026).
--
-- 1. borrar_horario_tpa(p_horario): "Lo cargué por error". Borra el horario
--    como si nunca hubiera existido, solo si en las clases de ese día y hora
--    en las que era fijo no hay asistencias suyas, notas suyas ni clases
--    canceladas, y si ninguna cuota cobrada queda sin horario ese mes.
--    (La app además compara sus recuperaciones con y sin el horario:
--    motivosParaNoBorrar en src/lib/horarios.ts.)
-- 2. deshacer_baja_horario_tpa(p_horario, p_cupo): vuelve activo y sin fecha
--    de baja si el paciente está activo, no tiene otro horario activo ese
--    día y hora y el lugar sigue libre (menos fijos que el cupo y ninguna
--    clase ya registrada desde la baja completa sin él). Si no, avisa y no
--    cambia nada. Mismas reglas que conflictoAlReactivar (src/lib/horarios.ts).
-- 3. reactivar_paciente(p_paciente, p_horarios, p_cupo): reactiva al
--    paciente y, en la misma transacción, deshace la baja de los horarios
--    elegidos (con las validaciones de 2). Si uno falla, no cambia nada.
-- 4. ping(): select 1, sin datos. Lo llama la ruta /api/mantener-activo
--    (Vercel Cron, una vez por día) con la clave anon, para que el plan Free
--    no pause el proyecto. Es la única función que puede ejecutar anon.
--
-- Todas security invoker (corren con la RLS de quien llama), search_path
-- vacío y revoke a public y anon (salvo ping, solo anon). Los mensajes
-- empiezan con "TPA: " o "Pacientes: " y la app los muestra tal cual.
--
-- Compatible con la app de `main`: solo agrega funciones nuevas, no cambia
-- tablas ni funciones existentes. Se puede aplicar antes del merge.
-- =====================================================================

begin;

-- Día de la semana de una fecha en el formato de horarios_tpa.dia_semana.
create function public.dia_tpa_de_fecha(p_fecha date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case extract(isodow from p_fecha)::int
    when 1 then 'lunes' when 3 then 'miercoles' when 5 then 'viernes' end;
$$;

revoke all on function public.dia_tpa_de_fecha(date) from public, anon;
grant execute on function public.dia_tpa_de_fecha(date) to authenticated;

-- ---------------------------------------------------------------------
-- 1. borrar_horario_tpa
-- ---------------------------------------------------------------------
create function public.borrar_horario_tpa(p_horario uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  h public.horarios_tpa%rowtype;
  v_fin date; -- exclusive: desde ese día ya no es fijo
begin
  select * into h from public.horarios_tpa where id = p_horario for update;
  if not found then
    raise exception 'TPA: no se encontró el horario (puede que ya se haya borrado o que la sesión se haya cerrado).';
  end if;

  -- Vigencia como eraFijoEn (src/lib/tpa.ts): desde el alta; hasta la baja
  -- sin incluirla; un inactivo sin fecha de baja nunca fue fijo.
  v_fin := case when h.activo then 'infinity'::date else coalesce(h.fecha_baja, h.fecha_alta) end;

  if exists (
    select 1
      from public.asistencia_tpa a
      join public.clases_tpa c on c.id = a.clase_id
     where a.paciente_id = h.paciente_id
       and c.hora = h.hora and public.dia_tpa_de_fecha(c.fecha) = h.dia_semana
       and c.fecha >= h.fecha_alta
       and (c.fecha < v_fin or a.tipo = 'fijo')
  ) then
    raise exception 'TPA: no se puede borrar porque ya tiene asistencia cargada en ese horario. Dalo de baja.';
  end if;

  if exists (
    select 1
      from public.notas_evolucion n
      join public.clases_tpa c on c.id = n.clase_tpa_id
     where n.paciente_id = h.paciente_id
       and c.hora = h.hora and public.dia_tpa_de_fecha(c.fecha) = h.dia_semana
       and c.fecha >= h.fecha_alta and c.fecha < v_fin
  ) then
    raise exception 'TPA: no se puede borrar porque tiene notas de evolución de clases de ese horario. Dalo de baja.';
  end if;

  if exists (
    select 1
      from public.clases_tpa c
     where c.motivo_cancelacion is not null
       and c.hora = h.hora and public.dia_tpa_de_fecha(c.fecha) = h.dia_semana
       and c.fecha >= h.fecha_alta and c.fecha < v_fin
  ) then
    raise exception 'TPA: no se puede borrar porque se cancelaron clases de ese horario mientras estaba (le cuentan para recuperar). Dalo de baja.';
  end if;

  -- Cuota cobrada de un mes en que este horario tuvo clases y ningún otro
  -- horario suyo: sin él no sería fijo ese mes.
  if exists (
    select 1
      from public.pagos_tpa p
     where p.paciente_id = h.paciente_id and p.concepto = 'cuota'
       and exists (
         select 1 from generate_series(p.mes, (p.mes + interval '1 month - 1 day')::date, interval '1 day') d
          where public.dia_tpa_de_fecha(d::date) = h.dia_semana and d::date >= h.fecha_alta and d::date < v_fin)
       and not exists (
         select 1
           from public.horarios_tpa o
           cross join generate_series(p.mes, (p.mes + interval '1 month - 1 day')::date, interval '1 day') d
          where o.paciente_id = h.paciente_id and o.id <> h.id
            and public.dia_tpa_de_fecha(d::date) = o.dia_semana
            and d::date >= o.fecha_alta
            and (o.activo or (o.fecha_baja is not null and d::date < o.fecha_baja)))
  ) then
    raise exception 'TPA: no se puede borrar porque ya está cobrada una cuota que cuenta este horario. Dalo de baja.';
  end if;

  delete from public.horarios_tpa where id = h.id;
end;
$$;

revoke all on function public.borrar_horario_tpa(uuid) from public, anon;
grant execute on function public.borrar_horario_tpa(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. deshacer_baja_horario_tpa
-- ---------------------------------------------------------------------
create function public.deshacer_baja_horario_tpa(p_horario uuid, p_cupo integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  h public.horarios_tpa%rowtype;
  v_activo boolean;
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_fecha date;
begin
  if p_cupo is null or p_cupo < 1 then
    raise exception 'TPA: falta el cupo de la clase.';
  end if;

  select * into h from public.horarios_tpa where id = p_horario for update;
  if not found then
    raise exception 'TPA: no se encontró el horario (puede que se haya borrado o que la sesión se haya cerrado).';
  end if;
  if h.activo then
    raise exception 'TPA: este horario ya está activo.';
  end if;
  if h.fecha_baja is null then
    raise exception 'TPA: se cerró antes de que la app guardara la fecha de baja: inscribilo de nuevo.';
  end if;

  select activo into v_activo from public.pacientes where id = h.paciente_id;
  if not coalesce(v_activo, false) then
    raise exception 'TPA: primero hay que reactivar al paciente, desde su historia clínica.';
  end if;

  if exists (
    select 1 from public.horarios_tpa o
     where o.paciente_id = h.paciente_id and o.id <> h.id and o.activo
       and o.dia_semana = h.dia_semana and o.hora = h.hora
  ) then
    raise exception 'TPA: ya tiene otro horario activo ese día y hora.';
  end if;

  if (
    select count(distinct o.paciente_id) from public.horarios_tpa o
     where o.paciente_id <> h.paciente_id
       and o.dia_semana = h.dia_semana and o.hora = h.hora
       and (o.activo or o.fecha_baja > v_hoy)
  ) >= p_cupo then
    raise exception 'TPA: el horario ya tiene los % lugares ocupados por fijos.', p_cupo;
  end if;

  -- Clases ya registradas desde la baja (no canceladas).
  select min(c.fecha) into v_fecha
    from public.clases_tpa c
    join public.asistencia_tpa a on a.clase_id = c.id and a.paciente_id = h.paciente_id and a.tipo <> 'fijo'
   where c.hora = h.hora and public.dia_tpa_de_fecha(c.fecha) = h.dia_semana
     and c.fecha >= h.fecha_baja and c.motivo_cancelacion is null;
  if v_fecha is not null then
    raise exception 'TPA: ya está anotado en la clase del % de otra forma (recupera, cambio o suelta).', to_char(v_fecha, 'DD/MM');
  end if;

  -- Ocupados sin él, como contarLugares (src/lib/tpa.ts): las filas que no
  -- son avisos de fijo + los fijos vigentes de esa fecha sin fila. Si él
  -- avisó para esa clase, no ocupa lugar.
  select min(c.fecha) into v_fecha
    from public.clases_tpa c
   where c.hora = h.hora and public.dia_tpa_de_fecha(c.fecha) = h.dia_semana
     and c.fecha >= h.fecha_baja and c.motivo_cancelacion is null
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
           and o.dia_semana = h.dia_semana and o.hora = h.hora
           and o.fecha_alta <= c.fecha
           and (o.activo or o.fecha_baja > c.fecha)
           and not exists (select 1 from public.asistencia_tpa a where a.clase_id = c.id and a.paciente_id = o.paciente_id))
     ) >= p_cupo;
  if v_fecha is not null then
    raise exception 'TPA: la clase del % ya está completa: alguien ocupó su lugar.', to_char(v_fecha, 'DD/MM');
  end if;

  update public.horarios_tpa set activo = true, fecha_baja = null where id = h.id;
end;
$$;

revoke all on function public.deshacer_baja_horario_tpa(uuid, integer) from public, anon;
grant execute on function public.deshacer_baja_horario_tpa(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 3. reactivar_paciente
-- ---------------------------------------------------------------------
-- El trigger pacientes_limpiar_baja borra la fecha de baja al pasar a activo.
-- Devuelve cuántos horarios recuperó.
create function public.reactivar_paciente(p_paciente uuid, p_horarios uuid[], p_cupo integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_cuantos integer := 0;
begin
  update public.pacientes set activo = true where id = p_paciente;
  if not found then
    raise exception 'Pacientes: no se encontró el paciente (puede que la sesión se haya cerrado).';
  end if;

  foreach v_id in array coalesce(p_horarios, '{}'::uuid[]) loop
    if not exists (select 1 from public.horarios_tpa where id = v_id and paciente_id = p_paciente) then
      raise exception 'TPA: uno de los horarios no es de este paciente.';
    end if;
    perform public.deshacer_baja_horario_tpa(v_id, p_cupo);
    v_cuantos := v_cuantos + 1;
  end loop;

  return v_cuantos;
end;
$$;

revoke all on function public.reactivar_paciente(uuid, uuid[], integer) from public, anon;
grant execute on function public.reactivar_paciente(uuid, uuid[], integer) to authenticated;

-- ---------------------------------------------------------------------
-- 4. ping (mantener activo el proyecto)
-- ---------------------------------------------------------------------
create function public.ping()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select 1;
$$;

revoke all on function public.ping() from public, authenticated;
grant execute on function public.ping() to anon;

commit;

-- =====================================================================
-- Verificación (correr después de aplicar):
--
-- select p.proname, p.prosecdef,
--        has_function_privilege('anon', p.oid, 'execute') as anon,
--        has_function_privilege('authenticated', p.oid, 'execute') as authenticated
--   from pg_proc p
--  where p.pronamespace = 'public'::regnamespace
--    and p.proname in ('dia_tpa_de_fecha', 'borrar_horario_tpa', 'deshacer_baja_horario_tpa', 'reactivar_paciente', 'ping')
--  order by 1;
-- -- 5 filas, prosecdef = false en todas.
-- -- ping: anon = true, authenticated = false. Las otras 4: anon = false, authenticated = true.
--
-- select public.ping();  -- 1
-- =====================================================================

-- =====================================================================
-- Rollback (solo si hace falta volver atrás; no toca datos):
--
-- begin;
-- drop function if exists public.reactivar_paciente(uuid, uuid[], integer);
-- drop function if exists public.deshacer_baja_horario_tpa(uuid, integer);
-- drop function if exists public.borrar_horario_tpa(uuid);
-- drop function if exists public.dia_tpa_de_fecha(date);
-- drop function if exists public.ping();
-- commit;
-- =====================================================================
