-- =====================================================================
-- Datos reales — Baja lógica de pacientes (bloqueante antes de la carga real).
--
-- 1. pacientes.activo: obligatorio (las filas sin valor pasan a true).
-- 2. pacientes.fecha_baja: desde qué día está dado de baja. Un trigger la
--    limpia al reactivar (activo = true), así que nunca queda una fecha de
--    baja en un paciente activo.
-- 3. Todas las FK que apuntan a pacientes pasan de ON DELETE CASCADE a
--    ON DELETE RESTRICT: borrar un paciente ya no borra su historia. Solo se
--    puede borrar un paciente sin ningún dato (cargado por error); el resto
--    se da de baja.
-- 4. dar_de_baja_paciente(p_paciente, p_fecha): en una transacción, marca al
--    paciente inactivo con su fecha de baja y cierra sus horarios fijos de
--    TPA en esa fecha (no figura como deudor en los meses siguientes).
--
-- Compatible con la app de `main` (producción hasta el merge):
-- - Lee pacientes con select *: la columna nueva le sobra.
-- - Siempre guarda activo = true (alta y edición): el trigger limpia la
--   fecha de baja, que main nunca pone.
-- - "Eliminar paciente" de main con un paciente CON historial ahora falla
--   (FK RESTRICT: "Ocurrió un error…") en lugar de borrar todo. Es justo lo
--   que se busca. Un paciente sin datos se sigue pudiendo borrar.
-- - No usa la función nueva.
-- Se aplica ANTES de probar el preview (la app nueva usa la función y la columna).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1 y 2. activo obligatorio y fecha de baja
-- ---------------------------------------------------------------------
update public.pacientes set activo = true where activo is null;
alter table public.pacientes alter column activo set not null;

alter table public.pacientes add column fecha_baja date;

comment on column public.pacientes.activo is
  'false = dado de baja (archivado): no aparece en las listas para elegir pacientes; su historia queda.';
comment on column public.pacientes.fecha_baja is
  'Desde qué día está dado de baja (la pone dar_de_baja_paciente). NULL si está activo.';

create function public.limpiar_baja_paciente()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.activo then
    new.fecha_baja := null;
  end if;
  return new;
end;
$$;

revoke all on function public.limpiar_baja_paciente() from public, anon, authenticated;

create trigger pacientes_limpiar_baja
  before insert or update on public.pacientes
  for each row execute function public.limpiar_baja_paciente();

-- ---------------------------------------------------------------------
-- 3. FK a pacientes: ON DELETE RESTRICT
-- ---------------------------------------------------------------------
alter table public.sesiones_rpg drop constraint sesiones_rpg_paciente_id_fkey,
  add constraint sesiones_rpg_paciente_id_fkey foreign key (paciente_id)
    references public.pacientes(id) on delete restrict;

alter table public.horarios_tpa drop constraint horarios_tpa_paciente_id_fkey,
  add constraint horarios_tpa_paciente_id_fkey foreign key (paciente_id)
    references public.pacientes(id) on delete restrict;

alter table public.asistencia_tpa drop constraint asistencia_tpa_paciente_id_fkey,
  add constraint asistencia_tpa_paciente_id_fkey foreign key (paciente_id)
    references public.pacientes(id) on delete restrict;

alter table public.notas_evolucion drop constraint notas_evolucion_paciente_id_fkey,
  add constraint notas_evolucion_paciente_id_fkey foreign key (paciente_id)
    references public.pacientes(id) on delete restrict;

alter table public.pagos_tpa drop constraint pagos_tpa_paciente_id_fkey,
  add constraint pagos_tpa_paciente_id_fkey foreign key (paciente_id)
    references public.pacientes(id) on delete restrict;

alter table public.lista_espera drop constraint lista_espera_paciente_id_fkey,
  add constraint lista_espera_paciente_id_fkey foreign key (paciente_id)
    references public.pacientes(id) on delete restrict;

-- La tabla vieja `pagos` también (se borra con la migración 20261114000002).
alter table public.pagos drop constraint pagos_paciente_id_fkey,
  add constraint pagos_paciente_id_fkey foreign key (paciente_id)
    references public.pacientes(id) on delete restrict;

-- ---------------------------------------------------------------------
-- 4. dar_de_baja_paciente
-- ---------------------------------------------------------------------
-- Security invoker: corre con los permisos (y la RLS) de quien la llama. Sin
-- autorización, el update no encuentra al paciente y la función avisa.
-- Los horarios se cierran como al desinscribir: fecha_baja exclusive (desde
-- ese día ya no es fijo); un alta a futuro queda cerrada en su fecha de alta
-- (nunca llegó a ser fijo). Devuelve cuántos horarios cerró.
create function public.dar_de_baja_paciente(p_paciente uuid, p_fecha date)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_horarios integer;
begin
  if p_fecha is null then
    raise exception 'Pacientes: falta la fecha de baja.';
  end if;

  update public.pacientes
     set activo = false, fecha_baja = p_fecha
   where id = p_paciente;
  if not found then
    raise exception 'Pacientes: no se encontró el paciente (puede que la sesión se haya cerrado).';
  end if;

  update public.horarios_tpa
     set activo = false, fecha_baja = greatest(p_fecha, fecha_alta)
   where paciente_id = p_paciente and activo;
  get diagnostics v_horarios = row_count;

  return v_horarios;
end;
$$;

revoke all on function public.dar_de_baja_paciente(uuid, date) from public, anon;
grant execute on function public.dar_de_baja_paciente(uuid, date) to authenticated;

commit;

-- =====================================================================
-- Verificación (correr después de aplicar):
--
-- select conrelid::regclass as tabla, conname, confdeltype
--   from pg_constraint
--  where contype = 'f' and confrelid = 'public.pacientes'::regclass
--  order by 1;
-- -- 7 filas, todas con confdeltype = 'r' (restrict).
--
-- select column_name, is_nullable, column_default
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'pacientes'
--    and column_name in ('activo', 'fecha_baja');
-- -- activo: NO / true · fecha_baja: YES / null
--
-- select proname, prosecdef, proacl from pg_proc
--  where proname in ('dar_de_baja_paciente', 'limpiar_baja_paciente');
-- -- prosecdef = false; dar_de_baja_paciente con execute solo para authenticated.
-- =====================================================================

-- =====================================================================
-- Rollback (solo si hace falta volver atrás; vuelve a CASCADE):
--
-- begin;
-- drop function if exists public.dar_de_baja_paciente(uuid, date);
-- drop trigger if exists pacientes_limpiar_baja on public.pacientes;
-- drop function if exists public.limpiar_baja_paciente();
-- alter table public.pacientes drop column if exists fecha_baja;
-- alter table public.pacientes alter column activo drop not null;
-- alter table public.sesiones_rpg drop constraint sesiones_rpg_paciente_id_fkey,
--   add constraint sesiones_rpg_paciente_id_fkey foreign key (paciente_id) references public.pacientes(id) on delete cascade;
-- alter table public.horarios_tpa drop constraint horarios_tpa_paciente_id_fkey,
--   add constraint horarios_tpa_paciente_id_fkey foreign key (paciente_id) references public.pacientes(id) on delete cascade;
-- alter table public.asistencia_tpa drop constraint asistencia_tpa_paciente_id_fkey,
--   add constraint asistencia_tpa_paciente_id_fkey foreign key (paciente_id) references public.pacientes(id) on delete cascade;
-- alter table public.notas_evolucion drop constraint notas_evolucion_paciente_id_fkey,
--   add constraint notas_evolucion_paciente_id_fkey foreign key (paciente_id) references public.pacientes(id) on delete cascade;
-- alter table public.pagos_tpa drop constraint pagos_tpa_paciente_id_fkey,
--   add constraint pagos_tpa_paciente_id_fkey foreign key (paciente_id) references public.pacientes(id) on delete cascade;
-- alter table public.lista_espera drop constraint lista_espera_paciente_id_fkey,
--   add constraint lista_espera_paciente_id_fkey foreign key (paciente_id) references public.pacientes(id) on delete cascade;
-- -- Solo si todavía existe la tabla pagos:
-- alter table public.pagos drop constraint pagos_paciente_id_fkey,
--   add constraint pagos_paciente_id_fkey foreign key (paciente_id) references public.pacientes(id) on delete cascade;
-- commit;
-- =====================================================================
