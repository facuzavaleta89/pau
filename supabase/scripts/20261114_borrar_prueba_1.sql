-- =====================================================================
-- Borrar el paciente de prueba "Prueba 1" y todos sus datos (tanda de
-- datos reales).
--
-- NO es una migración: es un cambio de DATOS que se corre una sola vez, en
-- el SQL Editor. Está fuera de supabase/migrations/ para que
-- `supabase db push` nunca lo ejecute. Anda antes o después de la migración
-- 20261114000001 (borra los datos del paciente uno por uno, sin depender del
-- ON DELETE CASCADE, que esa migración saca).
--
-- Qué tenía (leído con el MCP de solo lectura el 13/11/2026):
--   id 246736fa-02a9-46cc-a11c-29d75a835a51, 3 horarios fijos (lunes 08:00,
--   10:30 y 11:30), 1 turno de RPG (20/10/2026), sin asistencias, notas,
--   pagos ni lista de espera.
--
-- Protección (si algo no coincide, no borra nada):
--   1. Tiene que haber exactamente un paciente llamado "Prueba 1" y con ese id.
--   2. No puede tener más datos que los conocidos (si alguien lo usó en otra
--      prueba, aborta para revisarlo a mano).
--
-- NO toca clases: la clase de prueba de Pau del vie 30/10/2026 10:30 (con
-- sus 3 "Recupera" de pacientes reales) queda como está.
-- =====================================================================

-- 1) Mirar primero qué se va a borrar:
select p.id, p.nombre,
       (select count(*) from public.horarios_tpa    x where x.paciente_id = p.id) as horarios,
       (select count(*) from public.sesiones_rpg    x where x.paciente_id = p.id) as turnos_rpg,
       (select count(*) from public.asistencia_tpa  x where x.paciente_id = p.id) as asistencias,
       (select count(*) from public.notas_evolucion x where x.paciente_id = p.id) as notas,
       (select count(*) from public.pagos_tpa       x where x.paciente_id = p.id) as pagos_tpa,
       (select count(*) from public.lista_espera    x where x.paciente_id = p.id) as lista_espera
  from public.pacientes p
 where p.nombre = 'Prueba 1';
-- Esperado: una fila, id 246736fa-…, 3 · 1 · 0 · 0 · 0 · 0.

-- 2) Borrar (todo o nada):
begin;

do $$
declare
  v_id constant uuid := '246736fa-02a9-46cc-a11c-29d75a835a51';
  v_pacientes int;
  v_horarios  int;
  v_turnos    int;
  v_otros     int;
begin
  select count(*) into v_pacientes from public.pacientes where nombre = 'Prueba 1';
  if v_pacientes <> 1 or not exists (select 1 from public.pacientes where id = v_id and nombre = 'Prueba 1') then
    raise exception 'No hay exactamente un "Prueba 1" con el id conocido (hay %): no se borra nada.', v_pacientes;
  end if;

  select count(*) into v_horarios from public.horarios_tpa where paciente_id = v_id;
  select count(*) into v_turnos   from public.sesiones_rpg where paciente_id = v_id;
  select (select count(*) from public.asistencia_tpa  where paciente_id = v_id)
       + (select count(*) from public.notas_evolucion where paciente_id = v_id)
       + (select count(*) from public.pagos_tpa       where paciente_id = v_id)
       + (select count(*) from public.lista_espera    where paciente_id = v_id)
    into v_otros;
  if v_horarios > 3 or v_turnos > 1 or v_otros > 0 then
    raise exception '"Prueba 1" tiene más datos que los conocidos (% horarios, % turnos, % otros): no se borra nada. Revisar a mano.',
      v_horarios, v_turnos, v_otros;
  end if;

  -- La tabla vieja pagos puede ya no existir (migración 20261114000002).
  if to_regclass('public.pagos') is not null then
    execute 'delete from public.pagos where paciente_id = $1' using v_id;
  end if;
  delete from public.horarios_tpa where paciente_id = v_id;
  delete from public.sesiones_rpg where paciente_id = v_id;
  delete from public.pacientes    where id = v_id;
end;
$$;

commit;

-- 3) Verificar:
-- select count(*) from public.pacientes where nombre = 'Prueba 1';   -- 0
-- select count(*) from public.asistencia_tpa a join public.clases_tpa c on c.id = a.clase_id
--  where c.fecha = '2026-10-30' and c.hora = '10:30';               -- 3 (la clase de Pau, intacta)
