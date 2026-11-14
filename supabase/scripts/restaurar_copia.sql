-- =====================================================================
-- Restaurar una copia de seguridad ("Descargar copia" en Pacientes,
-- archivo pau-kinesio-copia-AAAA-MM-DD-HHMM.json) en una base VACÍA.
--
-- NO es una migración y NO se corre en el SQL Editor (usa comandos de
-- psql). Se corre desde una terminal con psql:
--
--   COPIA=/ruta/a/pau-kinesio-copia-2026-11-13-2130.json \
--     psql "<cadena de conexión de Supabase: Connect → Session pooler>" \
--     -f supabase/scripts/restaurar_copia.sql
--
-- Antes: la base nueva tiene que tener todas las migraciones aplicadas
-- (supabase/migrations/ en orden; en un proyecto nuevo también la línea
-- base) y las tablas vacías. Las tablas son las de la versión de la app que
-- hizo la copia: si después se agregó una columna, queda en null o con su
-- default.
--
-- Todo en una transacción: si algo falla, no queda nada a medias. Mientras
-- carga, sin triggers ni chequeos de FK (session_replication_role = replica):
-- las filas ya eran válidas, y así entran también, por ejemplo, las
-- asistencias de clases que después se cancelaron.
-- Probado el 13/11/2026 en un Postgres local descartable (origen = destino).
-- =====================================================================

\set ON_ERROR_STOP on
\set contenido `cat "$COPIA"`
begin;
create temp table copia (j jsonb) on commit drop;
insert into copia values (:'contenido');
-- Sin triggers ni chequeos de FK mientras se carga (las filas ya eran válidas).
set local session_replication_role = replica;
insert into public.pacientes       select * from jsonb_populate_recordset(null::public.pacientes,       (select j->'tablas'->'pacientes'       from copia));
insert into public.precios_mes     select * from jsonb_populate_recordset(null::public.precios_mes,     (select j->'tablas'->'precios_mes'     from copia)) on conflict (mes) do nothing;
insert into public.horarios_tpa    select * from jsonb_populate_recordset(null::public.horarios_tpa,    (select j->'tablas'->'horarios_tpa'    from copia));
insert into public.clases_tpa      select * from jsonb_populate_recordset(null::public.clases_tpa,      (select j->'tablas'->'clases_tpa'      from copia));
insert into public.asistencia_tpa  select * from jsonb_populate_recordset(null::public.asistencia_tpa,  (select j->'tablas'->'asistencia_tpa'  from copia));
insert into public.notas_evolucion select * from jsonb_populate_recordset(null::public.notas_evolucion, (select j->'tablas'->'notas_evolucion' from copia));
insert into public.sesiones_rpg    select * from jsonb_populate_recordset(null::public.sesiones_rpg,    (select j->'tablas'->'sesiones_rpg'    from copia));
insert into public.pagos_tpa       select * from jsonb_populate_recordset(null::public.pagos_tpa,       (select j->'tablas'->'pagos_tpa'       from copia));
insert into public.lista_espera    select * from jsonb_populate_recordset(null::public.lista_espera,    (select j->'tablas'->'lista_espera'    from copia));
select t.tabla, (select jsonb_array_length(j->'tablas'->t.tabla) from copia) as en_la_copia
  from unnest(array['pacientes','precios_mes','horarios_tpa','clases_tpa','asistencia_tpa','notas_evolucion','sesiones_rpg','pagos_tpa','lista_espera']) as t(tabla);
commit;
