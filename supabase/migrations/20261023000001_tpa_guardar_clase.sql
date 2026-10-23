-- =====================================================================
-- Fase 1 — Asistencia TPA, entrega 3: guardar una clase entera en una sola
-- transacción, cambio de horario enlazado con su aviso de origen y
-- cancelar / reactivar clases. Diseño: docs/DISENO_ASISTENCIA_TPA.md (6.1).
--
-- 1. asistencia_tpa.cambio_de: el "cambio de horario" apunta al aviso del
--    mismo alumno en su horario de origen. Hace falta para que un cambio que
--    cruza el mes cuente en el mes de la falta (decisión 10.2.5).
-- 2. validar_asistencia_tpa: valida también cambio_de.
-- 3. guardar_clase_tpa(p_clases): una o varias clases (cambio de horario =
--    origen y destino) en una transacción.
-- 4. cambiar_cancelacion_tpa(p_fecha, p_horas, p_motivo): cancelar o
--    reactivar una clase o un día entero.
--
-- Funciones SECURITY INVOKER (respetan RLS), search_path vacío, execute solo
-- para authenticated. Mensajes de error sin datos de pacientes, con el
-- prefijo "TPA: " para que la app los muestre tal cual (src/lib/errores.ts).
-- Mientras no esté aplicada, la app de producción (entrega 2) sigue igual:
-- no usa nada de esto.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. cambio_de
-- ---------------------------------------------------------------------
alter table public.asistencia_tpa
  add column cambio_de uuid,
  add constraint asistencia_tpa_cambio_de_fkey
    foreign key (cambio_de) references public.asistencia_tpa (id) on delete set null,
  -- Un aviso es origen de un solo cambio (crea también el índice).
  add constraint asistencia_tpa_cambio_de_key unique (cambio_de),
  add constraint asistencia_tpa_cambio_de_solo_cambios
    check (cambio_de is null or tipo = 'cambio');

comment on column public.asistencia_tpa.cambio_de is
  'Solo tipo cambio: fila del aviso del mismo alumno en su horario de origen (otra clase). Si se borra el aviso, queda NULL.';

-- ---------------------------------------------------------------------
-- 2. Validación (reemplaza la de la entrega 2: misma lógica + cambio_de)
-- ---------------------------------------------------------------------
create or replace function public.validar_asistencia_tpa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Mensajes con el prefijo "TPA: ": la app los muestra tal cual (no traen datos de pacientes).
  -- Quien ocupa un lugar: el lugar tiene que ser de un fijo de esta clase que avisó.
  if new.ocupa_lugar_de is not null and not exists (
    select 1 from public.asistencia_tpa f
    where f.id = new.ocupa_lugar_de
      and f.clase_id = new.clase_id
      and f.tipo = 'fijo'
      and f.estado = any (array['aviso_con_tiempo', 'aviso_sin_tiempo'])
  ) then
    raise exception 'TPA: solo se puede ocupar el lugar de un fijo de esta clase que avisó.'
      using errcode = '23514';
  end if;

  -- Cambio de horario: el origen es un aviso del mismo alumno, en otra clase.
  if new.cambio_de is not null and not exists (
    select 1 from public.asistencia_tpa o
    where o.id = new.cambio_de
      and o.paciente_id = new.paciente_id
      and o.clase_id <> new.clase_id
      and o.tipo = 'fijo'
      and o.estado = any (array['aviso_con_tiempo', 'aviso_sin_tiempo'])
  ) then
    raise exception 'TPA: un cambio de horario necesita el aviso del mismo alumno en su horario de origen.'
      using errcode = '23514';
  end if;

  -- Un fijo cuyo lugar está ocupado, o que es origen de un cambio de horario,
  -- no puede dejar de ser "avisó" ni cambiar de clase o de alumno: primero
  -- hay que sacar o mover a quien ocupa su lugar / quitar el cambio.
  if tg_op = 'UPDATE'
     and (new.tipo <> 'fijo'
          or new.estado <> all (array['aviso_con_tiempo', 'aviso_sin_tiempo'])
          or new.clase_id <> old.clase_id
          or new.paciente_id <> old.paciente_id)
  then
    if exists (select 1 from public.asistencia_tpa o where o.ocupa_lugar_de = new.id) then
      raise exception 'TPA: alguien ocupa el lugar de este fijo. Primero sacalo de la clase o dejalo en un lugar libre.'
        using errcode = '23514';
    end if;
    if exists (select 1 from public.asistencia_tpa o where o.cambio_de = new.id) then
      raise exception 'TPA: este aviso es el origen de un cambio de horario. Primero quitá el cambio.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validar_asistencia_tpa() from public, anon, authenticated;

drop trigger asistencia_tpa_validar on public.asistencia_tpa;
create trigger asistencia_tpa_validar
  before insert or update of clase_id, paciente_id, tipo, estado, ocupa_lugar_de, cambio_de
  on public.asistencia_tpa
  for each row execute function public.validar_asistencia_tpa();

-- ---------------------------------------------------------------------
-- 3. guardar_clase_tpa
--
-- p_clases: array de clases, cada una
--   { "fecha": "2026-10-26", "hora": "10:30",
--     "cambios": [ { "paciente_id": uuid,
--                    "tipo": "fijo" | "recupera" | "cambio" | "suelta",
--                    "estado": estado | null,          -- null = sin marcar / quitar de la clase
--                    "avisado_at": timestamptz | null, -- solo avisos
--                    "ocupa_lugar_de_paciente": uuid | null,       -- opcional (solo no fijos)
--                    "cambio_de": { "fecha", "hora" } | null } ] } -- opcional (solo tipo cambio)
--   En "ocupa_lugar_de_paciente" y "cambio_de": si la clave no está, se
--   conserva lo que había; si está en null, se borra.
--
-- Orden (no depende del orden en que llegan):
--   pasada 0: crea las clases que hagan falta (solo si se marca a alguien) y
--             las bloquea; una clase cancelada no admite cambios.
--   pasada 1: quita a quienes ocupaban un lugar y suelta los enlaces que cambian;
--   pasada 2: fijos (primero los avisos/estados, después los "sin marcar");
--   pasada 3: quienes ocupan un lugar (necesitan el aviso del fijo ya guardado);
--   pasada 4: borra las clases que quedaron vacías, salvo las canceladas.
-- Reintentable: llamarla dos veces con lo mismo deja el mismo resultado.
-- Devuelve [{ fecha, hora, clase_id }] (clase_id null si la clase no quedó).
-- ---------------------------------------------------------------------
create function public.guardar_clase_tpa(p_clases jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_clase       jsonb;
  v_cambio      jsonb;
  v_clase_id    uuid;
  v_motivo      text;
  v_ids         uuid[] := '{}';
  v_i           int;
  v_lugar_de    uuid;
  v_origen      uuid;
  v_resultado   jsonb := '[]'::jsonb;
begin
  -- Con RLS, un usuario no autorizado no vería nada y los cambios afectarían
  -- 0 filas sin error: mejor decirlo.
  if not public.soy_autorizada() then
    raise exception 'TPA: tu usuario no está autorizado.' using errcode = '42501';
  end if;
  if p_clases is null or jsonb_typeof(p_clases) <> 'array' or jsonb_array_length(p_clases) = 0 then
    raise exception 'TPA: no hay nada para guardar.' using errcode = 'P0001';
  end if;

  -- Pasada 0: clases
  for v_i in 0 .. jsonb_array_length(p_clases) - 1 loop
    v_clase := p_clases -> v_i;
    if jsonb_typeof(v_clase -> 'cambios') is distinct from 'array' then
      raise exception 'TPA: falta la lista de cambios de una clase.' using errcode = 'P0001';
    end if;

    if exists (select 1 from jsonb_array_elements(v_clase -> 'cambios') c where c ->> 'estado' is not null) then
      insert into public.clases_tpa (fecha, hora)
      values ((v_clase ->> 'fecha')::date, (v_clase ->> 'hora')::time)
      on conflict (fecha, hora) do nothing;
    end if;

    v_clase_id := null;
    v_motivo := null;
    select k.id, k.motivo_cancelacion into v_clase_id, v_motivo
    from public.clases_tpa k
    where k.fecha = (v_clase ->> 'fecha')::date and k.hora = (v_clase ->> 'hora')::time
    for update;

    if v_motivo is not null and jsonb_array_length(v_clase -> 'cambios') > 0 then
      raise exception 'TPA: la clase está cancelada. Reactivala para marcar asistencia u ocupar lugares.'
        using errcode = 'P0001';
    end if;
    v_ids := v_ids || v_clase_id; -- puede ser null: solo había "sin marcar" en una clase que no existe
  end loop;

  -- Pasada 1: quitar a quienes ocupaban un lugar y soltar los enlaces que cambian
  for v_i in 0 .. jsonb_array_length(p_clases) - 1 loop
    v_clase_id := v_ids[v_i + 1];
    continue when v_clase_id is null;

    delete from public.asistencia_tpa a
    using jsonb_array_elements(p_clases -> v_i -> 'cambios') c
    where a.clase_id = v_clase_id
      and a.paciente_id = (c ->> 'paciente_id')::uuid
      and a.tipo <> 'fijo'
      and c ->> 'tipo' <> 'fijo'
      and c ->> 'estado' is null;

    update public.asistencia_tpa a
    set ocupa_lugar_de = case when c ? 'ocupa_lugar_de_paciente' then null else a.ocupa_lugar_de end,
        cambio_de      = case when c ? 'cambio_de' then null else a.cambio_de end
    from jsonb_array_elements(p_clases -> v_i -> 'cambios') c
    where a.clase_id = v_clase_id
      and a.paciente_id = (c ->> 'paciente_id')::uuid
      and c ->> 'tipo' <> 'fijo'
      and ((c ? 'ocupa_lugar_de_paciente' and a.ocupa_lugar_de is not null)
           or (c ? 'cambio_de' and a.cambio_de is not null));
  end loop;

  -- Pasada 2: fijos
  for v_i in 0 .. jsonb_array_length(p_clases) - 1 loop
    v_clase_id := v_ids[v_i + 1];
    continue when v_clase_id is null;

    insert into public.asistencia_tpa (clase_id, paciente_id, tipo, estado, avisado_at)
    select v_clase_id, (c ->> 'paciente_id')::uuid, 'fijo', c ->> 'estado', (c ->> 'avisado_at')::timestamptz
    from jsonb_array_elements(p_clases -> v_i -> 'cambios') c
    where c ->> 'tipo' = 'fijo' and c ->> 'estado' is not null
    on conflict (clase_id, paciente_id) do update
      set tipo = excluded.tipo, estado = excluded.estado, avisado_at = excluded.avisado_at;

    -- "Sin marcar" = sin fila. Quien ocupaba su lugar queda en un lugar libre (FK on delete set null).
    delete from public.asistencia_tpa a
    using jsonb_array_elements(p_clases -> v_i -> 'cambios') c
    where a.clase_id = v_clase_id
      and a.paciente_id = (c ->> 'paciente_id')::uuid
      and c ->> 'tipo' = 'fijo'
      and c ->> 'estado' is null;
  end loop;

  -- Pasada 3: quienes ocupan un lugar
  for v_i in 0 .. jsonb_array_length(p_clases) - 1 loop
    v_clase_id := v_ids[v_i + 1];
    continue when v_clase_id is null;

    for v_cambio in
      select c from jsonb_array_elements(p_clases -> v_i -> 'cambios') c
      where c ->> 'tipo' <> 'fijo' and c ->> 'estado' is not null
    loop
      v_lugar_de := null;
      if v_cambio ->> 'ocupa_lugar_de_paciente' is not null then
        select a.id into v_lugar_de
        from public.asistencia_tpa a
        where a.clase_id = v_clase_id and a.paciente_id = (v_cambio ->> 'ocupa_lugar_de_paciente')::uuid;
        if v_lugar_de is null then
          raise exception 'TPA: el fijo cuyo lugar se quiere ocupar no está anotado en esa clase.' using errcode = 'P0001';
        end if;
      end if;

      v_origen := null;
      if jsonb_typeof(v_cambio -> 'cambio_de') = 'object' then
        select a.id into v_origen
        from public.asistencia_tpa a
        join public.clases_tpa k on k.id = a.clase_id
        where k.fecha = (v_cambio -> 'cambio_de' ->> 'fecha')::date
          and k.hora = (v_cambio -> 'cambio_de' ->> 'hora')::time
          and a.paciente_id = (v_cambio ->> 'paciente_id')::uuid;
        if v_origen is null then
          raise exception 'TPA: falta el aviso en el horario de origen del cambio de horario.' using errcode = 'P0001';
        end if;
      end if;

      insert into public.asistencia_tpa (clase_id, paciente_id, tipo, estado, ocupa_lugar_de, cambio_de)
      values (v_clase_id, (v_cambio ->> 'paciente_id')::uuid, v_cambio ->> 'tipo', v_cambio ->> 'estado', v_lugar_de, v_origen)
      on conflict (clase_id, paciente_id) do update
        set tipo           = excluded.tipo,
            estado         = excluded.estado,
            avisado_at     = null,
            ocupa_lugar_de = case when v_cambio ? 'ocupa_lugar_de_paciente' then excluded.ocupa_lugar_de
                                  else public.asistencia_tpa.ocupa_lugar_de end,
            cambio_de      = case when v_cambio ? 'cambio_de' then excluded.cambio_de
                                  else public.asistencia_tpa.cambio_de end;
    end loop;
  end loop;

  -- Pasada 4: clases vacías (salvo canceladas) y resultado
  for v_i in 0 .. jsonb_array_length(p_clases) - 1 loop
    v_clase_id := v_ids[v_i + 1];
    if v_clase_id is not null then
      delete from public.clases_tpa k
      where k.id = v_clase_id
        and k.motivo_cancelacion is null
        and not exists (select 1 from public.asistencia_tpa a where a.clase_id = k.id);
      if found then
        v_clase_id := null; -- quedó vacía y se borró
      end if;
    end if;
    v_resultado := v_resultado || jsonb_build_object(
      'fecha', p_clases -> v_i ->> 'fecha',
      'hora', p_clases -> v_i ->> 'hora',
      'clase_id', v_clase_id
    );
  end loop;

  return v_resultado;
end;
$$;

revoke all on function public.guardar_clase_tpa(jsonb) from public, anon;
grant execute on function public.guardar_clase_tpa(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 4. cambiar_cancelacion_tpa: cancelar (p_motivo = 'feriado' |
--    'cancelada_por_pau') o reactivar (p_motivo = null) las clases de una
--    fecha en esas horas. Crea las clases que falten. Las asistencias ya
--    cargadas no se tocan (mientras está cancelada, se ignoran). Al
--    reactivar, borra las que quedan vacías. Devuelve cuántas clases tocó.
-- ---------------------------------------------------------------------
create function public.cambiar_cancelacion_tpa(p_fecha date, p_horas time[], p_motivo text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cantidad integer;
begin
  if not public.soy_autorizada() then
    raise exception 'TPA: tu usuario no está autorizado.' using errcode = '42501';
  end if;
  if p_fecha is null or p_horas is null or cardinality(p_horas) = 0 then
    raise exception 'TPA: falta la fecha o las horas.' using errcode = 'P0001';
  end if;

  if p_motivo is not null then
    insert into public.clases_tpa (fecha, hora, motivo_cancelacion)
    select p_fecha, h, p_motivo from unnest(p_horas) as h
    on conflict (fecha, hora) do update set motivo_cancelacion = excluded.motivo_cancelacion;
    get diagnostics v_cantidad = row_count;
  else
    update public.clases_tpa
    set motivo_cancelacion = null
    where fecha = p_fecha and hora = any (p_horas) and motivo_cancelacion is not null;
    get diagnostics v_cantidad = row_count;

    delete from public.clases_tpa k
    where k.fecha = p_fecha and k.hora = any (p_horas) and k.motivo_cancelacion is null
      and not exists (select 1 from public.asistencia_tpa a where a.clase_id = k.id);
  end if;

  return v_cantidad;
end;
$$;

revoke all on function public.cambiar_cancelacion_tpa(date, time[], text) from public, anon;
grant execute on function public.cambiar_cancelacion_tpa(date, time[], text) to authenticated;

commit;

-- =====================================================================
-- ROLLBACK (pierde los enlaces de cambio de horario; las filas quedan).
-- Correr todo junto en el SQL Editor. Vuelve al trigger de la entrega 2.
-- =====================================================================
-- begin;
-- drop function if exists public.cambiar_cancelacion_tpa(date, time[], text);
-- drop function if exists public.guardar_clase_tpa(jsonb);
-- drop trigger if exists asistencia_tpa_validar on public.asistencia_tpa;
-- alter table public.asistencia_tpa
--   drop constraint if exists asistencia_tpa_cambio_de_solo_cambios,
--   drop constraint if exists asistencia_tpa_cambio_de_key,
--   drop constraint if exists asistencia_tpa_cambio_de_fkey,
--   drop column if exists cambio_de;
-- create or replace function public.validar_asistencia_tpa()
-- returns trigger
-- language plpgsql
-- set search_path = ''
-- as $$
-- begin
--   if new.ocupa_lugar_de is not null and not exists (
--     select 1 from public.asistencia_tpa f
--     where f.id = new.ocupa_lugar_de and f.clase_id = new.clase_id and f.tipo = 'fijo'
--       and f.estado = any (array['aviso_con_tiempo', 'aviso_sin_tiempo'])
--   ) then
--     raise exception 'ocupa_lugar_de tiene que ser un fijo de la misma clase que avisó' using errcode = '23514';
--   end if;
--   if tg_op = 'UPDATE'
--      and (new.tipo <> 'fijo'
--           or new.estado <> all (array['aviso_con_tiempo', 'aviso_sin_tiempo'])
--           or new.clase_id <> old.clase_id)
--      and exists (select 1 from public.asistencia_tpa o where o.ocupa_lugar_de = new.id)
--   then
--     raise exception 'Alguien ocupa el lugar de este fijo: primero hay que sacarlo de la clase' using errcode = '23514';
--   end if;
--   return new;
-- end;
-- $$;
-- revoke all on function public.validar_asistencia_tpa() from public, anon, authenticated;
-- create trigger asistencia_tpa_validar
--   before insert or update of clase_id, tipo, estado, ocupa_lugar_de
--   on public.asistencia_tpa
--   for each row execute function public.validar_asistencia_tpa();
-- commit;
