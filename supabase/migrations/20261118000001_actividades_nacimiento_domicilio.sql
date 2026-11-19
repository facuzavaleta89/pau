-- =====================================================================
-- Fase 3 — Pedidos de Pau del 18/11/2026 (parte A).
--
-- 1. pacientes.fecha_nacimiento: la edad se calcula sola y permite ver los
--    cumpleaños. La columna `edad` NO se toca: sigue valiendo para quien no
--    tiene fecha cargada.
-- 2. pacientes.actividades: RPG, TPA y/o Domicilio (una o más). Reemplaza de
--    a poco a tipo_clase, que NO se borra.
-- 3. precios_mes.domicilio_sesion: precio de la clase a domicilio. Vacío = se
--    usa el precio de RPG, con aviso.
--
-- "Clase domicilio" no necesita cambios: sesiones_rpg.tipo_sesion es texto
-- libre y sin check. Los turnos existentes (todos "RPG") quedan como están.
--
-- Compatible con la app de `main` (producción hasta el merge):
-- - Lee pacientes y precios con select *: las columnas nuevas le sobran.
-- - Sigue leyendo y guardando tipo_clase. Un trigger mantiene las dos columnas
--   iguales, en los dos sentidos:
--     · main cambia tipo_clase → actividades se actualiza y conserva Domicilio.
--     · la app nueva cambia actividades → tipo_clase se actualiza.
--   Solo Domicilio → tipo_clase = 'RPG' (turno individual, lo más parecido que
--   main conoce). Si quedara vacío, el formulario de main mostraría "RPG" y al
--   guardar le agregaría RPG sin que nadie lo pidiera.
-- - Guarda precios sin domicilio_sesion: el upsert no toca esa columna.
-- - No hay NOT NULL nuevo: una copia de seguridad anterior a esta migración se
--   sigue pudiendo restaurar (la app deduce la actividad desde tipo_clase).
--
-- Datos existentes: solo se completa `actividades` a partir de tipo_clase. No
-- cambia ningún otro dato, ni updated_at (se apaga su trigger para este paso).
-- Se aplica ANTES de probar el preview.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1 y 2. Columnas nuevas de pacientes
-- ---------------------------------------------------------------------
alter table public.pacientes
  add column fecha_nacimiento date,
  add column actividades text[] default '{}',
  add constraint pacientes_fecha_nacimiento_valida
    check (fecha_nacimiento >= date '1900-01-01'),
  add constraint pacientes_actividades_validas
    check (actividades <@ array['RPG', 'TPA', 'Domicilio']::text[]);

comment on column public.pacientes.fecha_nacimiento is
  'Con fecha, la edad se calcula sola; sin fecha, vale la columna edad.';
comment on column public.pacientes.actividades is
  'RPG, TPA y/o Domicilio. Se mantiene igual a tipo_clase con un trigger hasta que se borre tipo_clase.';

-- Completar desde tipo_clase, sin tocar updated_at.
alter table public.pacientes disable trigger trigger_updated_at;

update public.pacientes
   set actividades = case tipo_clase
     when 'RPG'   then array['RPG']
     when 'TPA'   then array['TPA']
     when 'ambos' then array['RPG', 'TPA']
     else '{}'::text[]
   end;

alter table public.pacientes enable trigger trigger_updated_at;

-- Guarda: si algo no quedó igual, no se aplica nada.
do $$
begin
  if exists (
    select 1 from public.pacientes
     where actividades is distinct from case tipo_clase
       when 'RPG'   then array['RPG']
       when 'TPA'   then array['TPA']
       when 'ambos' then array['RPG', 'TPA']
       else '{}'::text[]
     end
  ) then
    raise exception 'actividades no coincide con tipo_clase: no se aplica la migración.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Trigger: tipo_clase y actividades siempre de acuerdo
-- ---------------------------------------------------------------------
create function public.sincronizar_actividades_paciente()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_actividades text[];
begin
  -- Ninguna de las dos cambió (por ejemplo, editar el teléfono o dar de baja).
  if tg_op = 'UPDATE'
     and new.actividades is not distinct from old.actividades
     and new.tipo_clase is not distinct from old.tipo_clase then
    return new;
  end if;

  -- App nueva: manda actividades.
  if (tg_op = 'INSERT' and cardinality(coalesce(new.actividades, '{}')) > 0)
     or (tg_op = 'UPDATE' and new.actividades is distinct from old.actividades) then
    new.actividades := coalesce(new.actividades, '{}');
    new.tipo_clase := case
      when new.actividades @> array['RPG', 'TPA'] then 'ambos'
      when 'TPA' = any (new.actividades) then 'TPA'
      when cardinality(new.actividades) > 0 then 'RPG' -- RPG, o solo Domicilio
      else null
    end;
    return new;
  end if;

  -- App de main: manda tipo_clase. Domicilio no existe para main: se conserva.
  v_actividades := case new.tipo_clase
    when 'RPG'   then array['RPG']
    when 'TPA'   then array['TPA']
    when 'ambos' then array['RPG', 'TPA']
    else '{}'::text[]
  end;
  if tg_op = 'UPDATE' and 'Domicilio' = any (coalesce(old.actividades, '{}')) then
    v_actividades := v_actividades || 'Domicilio'::text;
  end if;
  new.actividades := v_actividades;
  return new;
end;
$$;

revoke all on function public.sincronizar_actividades_paciente() from public, anon, authenticated;

create trigger pacientes_sincronizar_actividades
  before insert or update on public.pacientes
  for each row execute function public.sincronizar_actividades_paciente();

-- ---------------------------------------------------------------------
-- 3. Precio de la clase a domicilio
-- ---------------------------------------------------------------------
alter table public.precios_mes
  add column domicilio_sesion integer check (domicilio_sesion > 0);

comment on column public.precios_mes.domicilio_sesion is
  'Precio de la clase a domicilio. NULL = se usa rpg_sesion (la app avisa).';

commit;

-- =====================================================================
-- Verificación (correr después, en el SQL Editor):
-- =====================================================================
-- select tipo_clase, actividades, count(*) as pacientes,
--        count(*) filter (where fecha_nacimiento is not null) as con_nacimiento
--   from public.pacientes group by 1, 2 order by 1;
-- -- RPG → {RPG} · TPA → {TPA} · ambos → {RPG,TPA}; con_nacimiento = 0.
--
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--  where table_schema = 'public'
--    and ((table_name = 'pacientes' and column_name in ('fecha_nacimiento', 'actividades'))
--      or (table_name = 'precios_mes' and column_name = 'domicilio_sesion'));
-- -- 3 filas, todas is_nullable = YES.
--
-- select tgname, tgenabled from pg_trigger
--  where tgrelid = 'public.pacientes'::regclass and not tgisinternal order by 1;
-- -- pacientes_limpiar_baja, pacientes_sincronizar_actividades y
-- -- trigger_updated_at, las tres con tgenabled = 'O'.

-- =====================================================================
-- ROLLBACK — borra las fechas de nacimiento, quién tiene Domicilio y el
-- precio de domicilio. tipo_clase, edad y el resto quedan como estaban.
-- =====================================================================
-- begin;
-- drop trigger pacientes_sincronizar_actividades on public.pacientes;
-- drop function public.sincronizar_actividades_paciente();
-- alter table public.precios_mes drop column domicilio_sesion;
-- alter table public.pacientes
--   drop column actividades,
--   drop column fecha_nacimiento;
-- commit;
