-- =====================================================================
-- Fase 1 — Asistencia TPA, entrega 4: notas de evolución.
-- Diseño: docs/DISENO_ASISTENCIA_TPA.md (6.2).
--
-- 1. Guarda: aborta si alguna fila de asistencia_tpa tiene texto en `nota`.
-- 2. notas_evolucion: una nota por alumno por clase (clase_tpa_id) o nota
--    libre (clase_tpa_id null), con RLS igual al resto de las tablas.
-- 3. validar_asistencia_tpa: además, no deja insertar ni cambiar asistencias
--    de una clase cancelada (antes solo lo controlaba guardar_clase_tpa).
-- 4. guardar_clase_tpa: guarda también las notas de la clase en la misma
--    transacción, y no borra una clase que tiene notas aunque quede sin
--    asistencias. Misma firma (jsonb): la app de la entrega 3 sigue igual.
-- 5. cambiar_cancelacion_tpa: al reactivar, no borra las clases con notas.
-- 6. Sacar asistencia_tpa.nota (nunca se usó: las notas van en notas_evolucion).
--
-- Compatible con la app de la entrega 3 (producción mientras no se mergea):
-- no lee `nota` por nombre (select *), y manda a guardar_clase_tpa lo mismo
-- que antes (sin la clave "notas").
-- Las notas son datos de salud: ningún mensaje de error de acá las incluye.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Guarda
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.asistencia_tpa where nullif(btrim(nota), '') is not null) then
    raise exception 'Hay asistencias con texto en la columna nota: no se borra. Revisarlas antes de aplicar esta migración.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. notas_evolucion
-- ---------------------------------------------------------------------
create table public.notas_evolucion (
  id           uuid primary key default gen_random_uuid(),
  paciente_id  uuid not null references public.pacientes (id) on delete cascade,
  fecha        date not null,
  texto        text not null
    constraint notas_evolucion_texto_no_vacio check (btrim(texto) <> '')
    constraint notas_evolucion_texto_largo check (char_length(texto) <= 5000),
  -- null = nota libre (cargada desde la historia clínica). Si se borra la
  -- clase, la nota queda como nota libre de esa fecha.
  clase_tpa_id uuid references public.clases_tpa (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.notas_evolucion is
  'Notas de evolución (datos de salud). Una por alumno por clase de TPA, o libres (clase_tpa_id null).';

-- Una nota por alumno por clase.
create unique index notas_evolucion_paciente_clase_key
  on public.notas_evolucion (paciente_id, clase_tpa_id) where clase_tpa_id is not null;
-- Línea de tiempo de la historia clínica.
create index notas_evolucion_paciente_fecha_idx on public.notas_evolucion (paciente_id, fecha desc);
-- Notas de las clases de una semana (y la FK).
create index notas_evolucion_clase_idx on public.notas_evolucion (clase_tpa_id) where clase_tpa_id is not null;

create trigger notas_evolucion_updated_at
  before update on public.notas_evolucion
  for each row execute function public.update_updated_at();

alter table public.notas_evolucion enable row level security;

create policy "Solo usuaria autorizada" on public.notas_evolucion
  for all to authenticated
  using ((select private.es_usuaria_autorizada()))
  with check ((select private.es_usuaria_autorizada()));

revoke all on public.notas_evolucion from public, anon;
grant select, insert, update, delete on public.notas_evolucion to authenticated;

-- ---------------------------------------------------------------------
-- 3. Validación de asistencias (reemplaza la de la entrega 3: misma lógica
--    + clase cancelada)
-- ---------------------------------------------------------------------
create or replace function public.validar_asistencia_tpa()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_cambia boolean;
begin
  -- Mensajes con el prefijo "TPA: ": la app los muestra tal cual (no traen datos de pacientes).

  -- Clase cancelada: no se marca asistencia ni se ocupan lugares. Lo que ya
  -- estaba se conserva (cancelar no toca asistencias). Se deja pasar que un
  -- enlace quede en null: es lo que hace la base sola (on delete set null)
  -- cuando se borra un paciente o la fila del fijo.
  if tg_op = 'INSERT' then
    v_cambia := true;
  else
    v_cambia := new.clase_id is distinct from old.clase_id
             or new.paciente_id is distinct from old.paciente_id
             or new.tipo is distinct from old.tipo
             or new.estado is distinct from old.estado
             or new.avisado_at is distinct from old.avisado_at
             or (new.ocupa_lugar_de is not null and new.ocupa_lugar_de is distinct from old.ocupa_lugar_de)
             or (new.cambio_de is not null and new.cambio_de is distinct from old.cambio_de);
  end if;
  if v_cambia and exists (
    select 1 from public.clases_tpa k
    where k.motivo_cancelacion is not null
      and (k.id = new.clase_id or (tg_op = 'UPDATE' and k.id = old.clase_id))
  ) then
    raise exception 'TPA: la clase está cancelada. Reactivala para marcar asistencia u ocupar lugares.'
      using errcode = '23514';
  end if;

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

-- Igual que antes + avisado_at (cambiarlo en una clase cancelada también se rechaza).
drop trigger asistencia_tpa_validar on public.asistencia_tpa;
create trigger asistencia_tpa_validar
  before insert or update of clase_id, paciente_id, tipo, estado, avisado_at, ocupa_lugar_de, cambio_de
  on public.asistencia_tpa
  for each row execute function public.validar_asistencia_tpa();

-- ---------------------------------------------------------------------
-- 4. guardar_clase_tpa (misma firma; reemplaza la de la entrega 3)
--
-- p_clases: array de clases, cada una
--   { "fecha": "2026-10-26", "hora": "10:30",
--     "cambios": [ ... como en la entrega 3 ... ],
--     "notas": [ { "paciente_id": uuid, "texto": text | null } ] }  -- opcional
--   En "notas": texto vacío o null = borrar la nota de ese alumno en esa clase.
--
-- Orden (no depende del orden en que llegan):
--   pasada 0: crea las clases que hagan falta (si se marca a alguien o hay
--             una nota con texto) y las bloquea; una clase cancelada no
--             admite cambios ni notas.
--   pasada 1: quita a quienes ocupaban un lugar y suelta los enlaces que cambian;
--   pasada 2: fijos (primero los avisos/estados, después los "sin marcar");
--   pasada 3: quienes ocupan un lugar (necesitan el aviso del fijo ya guardado);
--   pasada 4: notas;
--   pasada 5: borra las clases que quedaron vacías, salvo las canceladas y
--             las que tienen notas.
-- Reintentable: llamarla dos veces con lo mismo deja el mismo resultado.
-- Devuelve [{ fecha, hora, clase_id }] (clase_id null si la clase no quedó).
-- ---------------------------------------------------------------------
create or replace function public.guardar_clase_tpa(p_clases jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_clase       jsonb;
  v_cambio      jsonb;
  v_notas       jsonb;
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
    if v_clase ? 'notas' and jsonb_typeof(v_clase -> 'notas') is distinct from 'array' then
      raise exception 'TPA: las notas de una clase tienen que ser una lista.' using errcode = 'P0001';
    end if;
    v_notas := coalesce(v_clase -> 'notas', '[]'::jsonb);

    if exists (select 1 from jsonb_array_elements(v_clase -> 'cambios') c where c ->> 'estado' is not null)
       or exists (select 1 from jsonb_array_elements(v_notas) n where nullif(btrim(n ->> 'texto'), '') is not null)
    then
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

    if v_motivo is not null and (jsonb_array_length(v_clase -> 'cambios') > 0 or jsonb_array_length(v_notas) > 0) then
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
    -- Su nota de esta clase (si tiene) queda: está en notas_evolucion.
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

  -- Pasada 4: notas (una por alumno por clase; vacía = borrarla)
  for v_i in 0 .. jsonb_array_length(p_clases) - 1 loop
    v_clase_id := v_ids[v_i + 1];
    continue when v_clase_id is null;
    v_notas := coalesce(p_clases -> v_i -> 'notas', '[]'::jsonb);

    insert into public.notas_evolucion (paciente_id, fecha, texto, clase_tpa_id)
    select (n ->> 'paciente_id')::uuid, (p_clases -> v_i ->> 'fecha')::date, btrim(n ->> 'texto'), v_clase_id
    from jsonb_array_elements(v_notas) n
    where nullif(btrim(n ->> 'texto'), '') is not null
    on conflict (paciente_id, clase_tpa_id) where clase_tpa_id is not null do update
      set texto = excluded.texto;

    delete from public.notas_evolucion e
    using jsonb_array_elements(v_notas) n
    where e.clase_tpa_id = v_clase_id
      and e.paciente_id = (n ->> 'paciente_id')::uuid
      and nullif(btrim(n ->> 'texto'), '') is null;
  end loop;

  -- Pasada 5: clases vacías (salvo canceladas o con notas) y resultado
  for v_i in 0 .. jsonb_array_length(p_clases) - 1 loop
    v_clase_id := v_ids[v_i + 1];
    if v_clase_id is not null then
      delete from public.clases_tpa k
      where k.id = v_clase_id
        and k.motivo_cancelacion is null
        and not exists (select 1 from public.asistencia_tpa a where a.clase_id = k.id)
        and not exists (select 1 from public.notas_evolucion n where n.clase_tpa_id = k.id);
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
-- 5. cambiar_cancelacion_tpa (misma firma; al reactivar no borra las
--    clases con notas)
-- ---------------------------------------------------------------------
create or replace function public.cambiar_cancelacion_tpa(p_fecha date, p_horas time[], p_motivo text)
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
      and not exists (select 1 from public.asistencia_tpa a where a.clase_id = k.id)
      and not exists (select 1 from public.notas_evolucion n where n.clase_tpa_id = k.id);
  end if;

  return v_cantidad;
end;
$$;

revoke all on function public.cambiar_cancelacion_tpa(date, time[], text) from public, anon;
grant execute on function public.cambiar_cancelacion_tpa(date, time[], text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Sacar asistencia_tpa.nota (vacía: lo verificó la guarda del paso 1)
-- ---------------------------------------------------------------------
alter table public.asistencia_tpa drop column nota;

commit;

-- =====================================================================
-- ROLLBACK — ⚠️ BORRA TODAS LAS NOTAS DE EVOLUCIÓN. Antes, exportarlas si
-- hay alguna real. Correr todo junto en el SQL Editor. Vuelve a las
-- funciones y al trigger de la entrega 3 (20261023000001).
-- =====================================================================
-- begin;
-- -- 1. La columna vuelve (vacía).
-- alter table public.asistencia_tpa add column nota text;
-- -- 2. Trigger de la entrega 3 (sin el control de clase cancelada).
-- create or replace function public.validar_asistencia_tpa()
-- returns trigger
-- language plpgsql
-- set search_path = ''
-- as $$
-- begin
--   -- Mensajes con el prefijo "TPA: ": la app los muestra tal cual (no traen datos de pacientes).
--   -- Quien ocupa un lugar: el lugar tiene que ser de un fijo de esta clase que avisó.
--   if new.ocupa_lugar_de is not null and not exists (
--     select 1 from public.asistencia_tpa f
--     where f.id = new.ocupa_lugar_de
--       and f.clase_id = new.clase_id
--       and f.tipo = 'fijo'
--       and f.estado = any (array['aviso_con_tiempo', 'aviso_sin_tiempo'])
--   ) then
--     raise exception 'TPA: solo se puede ocupar el lugar de un fijo de esta clase que avisó.'
--       using errcode = '23514';
--   end if;
--
--   -- Cambio de horario: el origen es un aviso del mismo alumno, en otra clase.
--   if new.cambio_de is not null and not exists (
--     select 1 from public.asistencia_tpa o
--     where o.id = new.cambio_de
--       and o.paciente_id = new.paciente_id
--       and o.clase_id <> new.clase_id
--       and o.tipo = 'fijo'
--       and o.estado = any (array['aviso_con_tiempo', 'aviso_sin_tiempo'])
--   ) then
--     raise exception 'TPA: un cambio de horario necesita el aviso del mismo alumno en su horario de origen.'
--       using errcode = '23514';
--   end if;
--
--   -- Un fijo cuyo lugar está ocupado, o que es origen de un cambio de horario,
--   -- no puede dejar de ser "avisó" ni cambiar de clase o de alumno: primero
--   -- hay que sacar o mover a quien ocupa su lugar / quitar el cambio.
--   if tg_op = 'UPDATE'
--      and (new.tipo <> 'fijo'
--           or new.estado <> all (array['aviso_con_tiempo', 'aviso_sin_tiempo'])
--           or new.clase_id <> old.clase_id
--           or new.paciente_id <> old.paciente_id)
--   then
--     if exists (select 1 from public.asistencia_tpa o where o.ocupa_lugar_de = new.id) then
--       raise exception 'TPA: alguien ocupa el lugar de este fijo. Primero sacalo de la clase o dejalo en un lugar libre.'
--         using errcode = '23514';
--     end if;
--     if exists (select 1 from public.asistencia_tpa o where o.cambio_de = new.id) then
--       raise exception 'TPA: este aviso es el origen de un cambio de horario. Primero quitá el cambio.'
--         using errcode = '23514';
--     end if;
--   end if;
--
--   return new;
-- end;
-- $$;
--
-- revoke all on function public.validar_asistencia_tpa() from public, anon, authenticated;
--
-- drop trigger asistencia_tpa_validar on public.asistencia_tpa;
-- create trigger asistencia_tpa_validar
--   before insert or update of clase_id, paciente_id, tipo, estado, ocupa_lugar_de, cambio_de
--   on public.asistencia_tpa
--   for each row execute function public.validar_asistencia_tpa();
-- -- 3. guardar_clase_tpa de la entrega 3 (sin notas).
-- create or replace function public.guardar_clase_tpa(p_clases jsonb)
-- returns jsonb
-- language plpgsql
-- security invoker
-- set search_path = ''
-- as $$
-- declare
--   v_clase       jsonb;
--   v_cambio      jsonb;
--   v_clase_id    uuid;
--   v_motivo      text;
--   v_ids         uuid[] := '{}';
--   v_i           int;
--   v_lugar_de    uuid;
--   v_origen      uuid;
--   v_resultado   jsonb := '[]'::jsonb;
-- begin
--   -- Con RLS, un usuario no autorizado no vería nada y los cambios afectarían
--   -- 0 filas sin error: mejor decirlo.
--   if not public.soy_autorizada() then
--     raise exception 'TPA: tu usuario no está autorizado.' using errcode = '42501';
--   end if;
--   if p_clases is null or jsonb_typeof(p_clases) <> 'array' or jsonb_array_length(p_clases) = 0 then
--     raise exception 'TPA: no hay nada para guardar.' using errcode = 'P0001';
--   end if;
--
--   -- Pasada 0: clases
--   for v_i in 0 .. jsonb_array_length(p_clases) - 1 loop
--     v_clase := p_clases -> v_i;
--     if jsonb_typeof(v_clase -> 'cambios') is distinct from 'array' then
--       raise exception 'TPA: falta la lista de cambios de una clase.' using errcode = 'P0001';
--     end if;
--
--     if exists (select 1 from jsonb_array_elements(v_clase -> 'cambios') c where c ->> 'estado' is not null) then
--       insert into public.clases_tpa (fecha, hora)
--       values ((v_clase ->> 'fecha')::date, (v_clase ->> 'hora')::time)
--       on conflict (fecha, hora) do nothing;
--     end if;
--
--     v_clase_id := null;
--     v_motivo := null;
--     select k.id, k.motivo_cancelacion into v_clase_id, v_motivo
--     from public.clases_tpa k
--     where k.fecha = (v_clase ->> 'fecha')::date and k.hora = (v_clase ->> 'hora')::time
--     for update;
--
--     if v_motivo is not null and jsonb_array_length(v_clase -> 'cambios') > 0 then
--       raise exception 'TPA: la clase está cancelada. Reactivala para marcar asistencia u ocupar lugares.'
--         using errcode = 'P0001';
--     end if;
--     v_ids := v_ids || v_clase_id; -- puede ser null: solo había "sin marcar" en una clase que no existe
--   end loop;
--
--   -- Pasada 1: quitar a quienes ocupaban un lugar y soltar los enlaces que cambian
--   for v_i in 0 .. jsonb_array_length(p_clases) - 1 loop
--     v_clase_id := v_ids[v_i + 1];
--     continue when v_clase_id is null;
--
--     delete from public.asistencia_tpa a
--     using jsonb_array_elements(p_clases -> v_i -> 'cambios') c
--     where a.clase_id = v_clase_id
--       and a.paciente_id = (c ->> 'paciente_id')::uuid
--       and a.tipo <> 'fijo'
--       and c ->> 'tipo' <> 'fijo'
--       and c ->> 'estado' is null;
--
--     update public.asistencia_tpa a
--     set ocupa_lugar_de = case when c ? 'ocupa_lugar_de_paciente' then null else a.ocupa_lugar_de end,
--         cambio_de      = case when c ? 'cambio_de' then null else a.cambio_de end
--     from jsonb_array_elements(p_clases -> v_i -> 'cambios') c
--     where a.clase_id = v_clase_id
--       and a.paciente_id = (c ->> 'paciente_id')::uuid
--       and c ->> 'tipo' <> 'fijo'
--       and ((c ? 'ocupa_lugar_de_paciente' and a.ocupa_lugar_de is not null)
--            or (c ? 'cambio_de' and a.cambio_de is not null));
--   end loop;
--
--   -- Pasada 2: fijos
--   for v_i in 0 .. jsonb_array_length(p_clases) - 1 loop
--     v_clase_id := v_ids[v_i + 1];
--     continue when v_clase_id is null;
--
--     insert into public.asistencia_tpa (clase_id, paciente_id, tipo, estado, avisado_at)
--     select v_clase_id, (c ->> 'paciente_id')::uuid, 'fijo', c ->> 'estado', (c ->> 'avisado_at')::timestamptz
--     from jsonb_array_elements(p_clases -> v_i -> 'cambios') c
--     where c ->> 'tipo' = 'fijo' and c ->> 'estado' is not null
--     on conflict (clase_id, paciente_id) do update
--       set tipo = excluded.tipo, estado = excluded.estado, avisado_at = excluded.avisado_at;
--
--     -- "Sin marcar" = sin fila. Quien ocupaba su lugar queda en un lugar libre (FK on delete set null).
--     delete from public.asistencia_tpa a
--     using jsonb_array_elements(p_clases -> v_i -> 'cambios') c
--     where a.clase_id = v_clase_id
--       and a.paciente_id = (c ->> 'paciente_id')::uuid
--       and c ->> 'tipo' = 'fijo'
--       and c ->> 'estado' is null;
--   end loop;
--
--   -- Pasada 3: quienes ocupan un lugar
--   for v_i in 0 .. jsonb_array_length(p_clases) - 1 loop
--     v_clase_id := v_ids[v_i + 1];
--     continue when v_clase_id is null;
--
--     for v_cambio in
--       select c from jsonb_array_elements(p_clases -> v_i -> 'cambios') c
--       where c ->> 'tipo' <> 'fijo' and c ->> 'estado' is not null
--     loop
--       v_lugar_de := null;
--       if v_cambio ->> 'ocupa_lugar_de_paciente' is not null then
--         select a.id into v_lugar_de
--         from public.asistencia_tpa a
--         where a.clase_id = v_clase_id and a.paciente_id = (v_cambio ->> 'ocupa_lugar_de_paciente')::uuid;
--         if v_lugar_de is null then
--           raise exception 'TPA: el fijo cuyo lugar se quiere ocupar no está anotado en esa clase.' using errcode = 'P0001';
--         end if;
--       end if;
--
--       v_origen := null;
--       if jsonb_typeof(v_cambio -> 'cambio_de') = 'object' then
--         select a.id into v_origen
--         from public.asistencia_tpa a
--         join public.clases_tpa k on k.id = a.clase_id
--         where k.fecha = (v_cambio -> 'cambio_de' ->> 'fecha')::date
--           and k.hora = (v_cambio -> 'cambio_de' ->> 'hora')::time
--           and a.paciente_id = (v_cambio ->> 'paciente_id')::uuid;
--         if v_origen is null then
--           raise exception 'TPA: falta el aviso en el horario de origen del cambio de horario.' using errcode = 'P0001';
--         end if;
--       end if;
--
--       insert into public.asistencia_tpa (clase_id, paciente_id, tipo, estado, ocupa_lugar_de, cambio_de)
--       values (v_clase_id, (v_cambio ->> 'paciente_id')::uuid, v_cambio ->> 'tipo', v_cambio ->> 'estado', v_lugar_de, v_origen)
--       on conflict (clase_id, paciente_id) do update
--         set tipo           = excluded.tipo,
--             estado         = excluded.estado,
--             avisado_at     = null,
--             ocupa_lugar_de = case when v_cambio ? 'ocupa_lugar_de_paciente' then excluded.ocupa_lugar_de
--                                   else public.asistencia_tpa.ocupa_lugar_de end,
--             cambio_de      = case when v_cambio ? 'cambio_de' then excluded.cambio_de
--                                   else public.asistencia_tpa.cambio_de end;
--     end loop;
--   end loop;
--
--   -- Pasada 4: clases vacías (salvo canceladas) y resultado
--   for v_i in 0 .. jsonb_array_length(p_clases) - 1 loop
--     v_clase_id := v_ids[v_i + 1];
--     if v_clase_id is not null then
--       delete from public.clases_tpa k
--       where k.id = v_clase_id
--         and k.motivo_cancelacion is null
--         and not exists (select 1 from public.asistencia_tpa a where a.clase_id = k.id);
--       if found then
--         v_clase_id := null; -- quedó vacía y se borró
--       end if;
--     end if;
--     v_resultado := v_resultado || jsonb_build_object(
--       'fecha', p_clases -> v_i ->> 'fecha',
--       'hora', p_clases -> v_i ->> 'hora',
--       'clase_id', v_clase_id
--     );
--   end loop;
--
--   return v_resultado;
-- end;
-- $$;
--
-- revoke all on function public.guardar_clase_tpa(jsonb) from public, anon;
-- grant execute on function public.guardar_clase_tpa(jsonb) to authenticated;
-- -- 4. cambiar_cancelacion_tpa de la entrega 3.
-- create or replace function public.cambiar_cancelacion_tpa(p_fecha date, p_horas time[], p_motivo text)
-- returns integer
-- language plpgsql
-- security invoker
-- set search_path = ''
-- as $$
-- declare
--   v_cantidad integer;
-- begin
--   if not public.soy_autorizada() then
--     raise exception 'TPA: tu usuario no está autorizado.' using errcode = '42501';
--   end if;
--   if p_fecha is null or p_horas is null or cardinality(p_horas) = 0 then
--     raise exception 'TPA: falta la fecha o las horas.' using errcode = 'P0001';
--   end if;
--
--   if p_motivo is not null then
--     insert into public.clases_tpa (fecha, hora, motivo_cancelacion)
--     select p_fecha, h, p_motivo from unnest(p_horas) as h
--     on conflict (fecha, hora) do update set motivo_cancelacion = excluded.motivo_cancelacion;
--     get diagnostics v_cantidad = row_count;
--   else
--     update public.clases_tpa
--     set motivo_cancelacion = null
--     where fecha = p_fecha and hora = any (p_horas) and motivo_cancelacion is not null;
--     get diagnostics v_cantidad = row_count;
--
--     delete from public.clases_tpa k
--     where k.fecha = p_fecha and k.hora = any (p_horas) and k.motivo_cancelacion is null
--       and not exists (select 1 from public.asistencia_tpa a where a.clase_id = k.id);
--   end if;
--
--   return v_cantidad;
-- end;
-- $$;
--
-- revoke all on function public.cambiar_cancelacion_tpa(date, time[], text) from public, anon;
-- grant execute on function public.cambiar_cancelacion_tpa(date, time[], text) to authenticated;
-- -- 5. La tabla de notas (con todas las notas).
-- drop table public.notas_evolucion;
-- commit;
