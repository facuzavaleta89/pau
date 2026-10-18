-- =====================================================================
-- ESQUEMA INICIAL (línea base) — proyecto Supabase "pau" (dmwtoozbctnwccaaitos)
-- Reconstruido el 17/10/2026 leyendo la base en producción (solo lectura).
--
-- ⚠️ NO EJECUTAR contra el proyecto existente: este esquema YA ESTÁ aplicado.
-- Sirve como documentación y para recrear la base desde cero (local o nuevo proyecto).
-- Los cambios futuros van en archivos de migración NUEVOS con fecha posterior.
--
-- ⚠️ Las políticas RLS de este archivo son las que existen HOY y son INSEGURAS
-- (permiten todo a cualquiera con la anon key). Se reemplazan en la Fase 0.
--
-- ⚠️ Todas las FK son ON DELETE CASCADE: borrar un paciente borra toda su historia.
-- Decisión vigente: en Fase 0 se mantiene el borrado real (con confirmación en la app).
-- Pasar a baja lógica + ON DELETE RESTRICT es BLOQUEANTE antes de cargar pacientes reales
-- (ver PENDIENTES.md).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funciones
-- ---------------------------------------------------------------------

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Event trigger que activa RLS automáticamente en tablas nuevas de public.
-- (Creado por Supabase; el advisor de seguridad avisa que anon/authenticated
-- pueden ejecutarlo vía RPC. Ver PENDIENTES.md, Fase 0.)
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name is not null and cmd.schema_name in ('public')
       and cmd.schema_name not in ('pg_catalog', 'information_schema')
       and cmd.schema_name not like 'pg_toast%'
       and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

create table public.pacientes (
  id                      uuid primary key default gen_random_uuid(),
  nombre                  text not null,
  edad                    integer,
  telefono                text,
  telefono_emergencia     text,
  direccion               text,
  profesion               text,
  actividad_fisica        text,
  antecedentes_clinicos   text,
  estudios_imagenologicos text,
  motivo_consulta         text,
  evaluacion_inicial      text,
  objetivo_tratamiento    text,
  tipo_clase              text check (tipo_clase = any (array['RPG', 'TPA', 'ambos'])),
  activo                  boolean default true,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

create trigger trigger_updated_at
  before update on public.pacientes
  for each row execute function public.update_updated_at();

create table public.sesiones_rpg (
  id            uuid primary key default gen_random_uuid(),
  paciente_id   uuid references public.pacientes (id) on delete cascade,
  fecha         date not null,
  hora          time without time zone not null,   -- devuelve "HH:mm:ss"
  tipo_sesion   text,
  estado_pago   text default 'pendiente' check (estado_pago = any (array['pagado', 'pendiente'])),
  estado_sesion text default 'pendiente' check (estado_sesion = any (array['realizada', 'cancelada', 'pendiente'])),
  nota          text,
  created_at    timestamptz default now()
);

create table public.horarios_tpa (
  id          uuid primary key default gen_random_uuid(),
  paciente_id uuid references public.pacientes (id) on delete cascade,
  dia_semana  text check (dia_semana = any (array['lunes', 'miercoles', 'viernes'])),
  hora        time without time zone not null,     -- devuelve "HH:mm:ss"
  activo      boolean default true,
  created_at  timestamptz default now()
);

create table public.clases_tpa (
  id         uuid primary key default gen_random_uuid(),
  fecha      date not null,
  hora       time without time zone not null,      -- devuelve "HH:mm:ss"
  created_at timestamptz default now(),
  constraint clases_tpa_fecha_hora_key unique (fecha, hora)
);

create table public.asistencia_tpa (
  id          uuid primary key default gen_random_uuid(),
  clase_id    uuid references public.clases_tpa (id) on delete cascade,
  paciente_id uuid references public.pacientes (id) on delete cascade,
  estado      text default 'pendiente' check (estado = any (array[
                'presente', 'aviso_ausencia', 'falto_sin_avisar',
                'recupera', 'vino_otra_clase', 'cancelado', 'pendiente'])),
  nota        text,
  created_at  timestamptz default now(),
  constraint asistencia_tpa_clase_id_paciente_id_key unique (clase_id, paciente_id)
);

create table public.pagos (
  id          uuid primary key default gen_random_uuid(),
  paciente_id uuid references public.pacientes (id) on delete cascade,
  mes         integer not null check (mes >= 1 and mes <= 12),
  "año"       integer not null,
  plan        text,
  precio      numeric,
  estado      text default 'pendiente' check (estado = any (array['pagado', 'pendiente'])),
  fecha_pago  date,
  created_at  timestamptz default now(),
  constraint unique_pago_paciente_mes_anio unique (paciente_id, mes, "año")
);

create table public.lista_espera (
  id                uuid primary key default gen_random_uuid(),
  paciente_id       uuid references public.pacientes (id) on delete cascade,
  tipo_clase        text check (tipo_clase = any (array['RPG', 'TPA'])),
  horario_preferido text,
  fecha_ingreso     date default current_date,
  created_at        timestamptz default now()
);

-- ---------------------------------------------------------------------
-- RLS (estado actual — INSEGURO, reemplazar en Fase 0)
-- ---------------------------------------------------------------------

alter table public.pacientes      enable row level security;
alter table public.sesiones_rpg   enable row level security;
alter table public.horarios_tpa   enable row level security;
alter table public.clases_tpa     enable row level security;
alter table public.asistencia_tpa enable row level security;
alter table public.pagos          enable row level security;
alter table public.lista_espera   enable row level security;  -- sin políticas: nadie puede leerla desde la app

create policy "Permitir todo a publico en pacientes"      on public.pacientes      for all to public using (true) with check (true);
create policy "Permitir todo a publico en sesiones_rpg"   on public.sesiones_rpg   for all to public using (true) with check (true);
create policy "Permitir todo a publico en horarios_tpa"   on public.horarios_tpa   for all to public using (true) with check (true);
create policy "Permitir todo a publico en clases_tpa"     on public.clases_tpa     for all to public using (true) with check (true);
create policy "Permitir todo a publico en asistencia_tpa" on public.asistencia_tpa for all to public using (true) with check (true);
create policy "Permitir todo a publico en pagos"          on public.pagos          for all to public using (true) with check (true);
