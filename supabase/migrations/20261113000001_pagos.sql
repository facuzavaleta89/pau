-- =====================================================================
-- Fase 2 — Pagos (entregas 1 y 2 juntas). Diseño: docs/DISENO_PAGOS.md.
--
-- 1. precios_mes: precios de cada mes (historial), con septiembre y
--    octubre 2026 cargados. Un mes sin fila usa los del anterior (la app avisa).
-- 2. pagos_tpa: pagos ya hechos de TPA. Cuota: uno por alumno y mes (índice
--    único parcial). Clases sueltas: una fila por pago.
-- 3. sesiones_rpg: importe, fecha y medio del pago de cada sesión.
--
-- NO toca la tabla `pagos` (se borra en la tanda de datos reales).
--
-- Compatible con la app de `main` (producción hasta el merge):
-- - No lee ni escribe precios_mes ni pagos_tpa.
-- - Lee sesiones_rpg con select *: las columnas nuevas le sobran.
-- - Pasa una sesión a "pendiente" sin tocar las columnas nuevas: en lugar de
--   un check que la rechazaría, un trigger las limpia (importe, fecha y medio
--   quedan en null). El check de abajo nunca falla porque el trigger corre antes.
-- - Marca "pagado" sin importe: queda en null y la app nueva lo cuenta con
--   el precio de RPG de su mes.
-- Pagos: datos personales (no de salud). Misma RLS que el resto.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. precios_mes
-- ---------------------------------------------------------------------
create table public.precios_mes (
  mes          date primary key,                -- primer día del mes: '2026-10-01'
  tpa_1_vez    integer not null check (tpa_1_vez > 0),
  tpa_2_veces  integer not null check (tpa_2_veces > 0),
  tpa_3_veces  integer not null check (tpa_3_veces > 0),
  tpa_suelta   integer not null check (tpa_suelta > 0),
  rpg_sesion   integer not null check (rpg_sesion > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint precios_mes_primer_dia check (extract(day from mes) = 1)
);

comment on table public.precios_mes is
  'Precios de cada mes en pesos enteros. Un mes sin fila usa los del último mes anterior.';

create trigger precios_mes_updated_at
  before update on public.precios_mes
  for each row execute function public.update_updated_at();

alter table public.precios_mes enable row level security;

create policy "Solo usuaria autorizada" on public.precios_mes
  for all to authenticated
  using ((select private.es_usuaria_autorizada()))
  with check ((select private.es_usuaria_autorizada()));

revoke all on public.precios_mes from public, anon;
grant select, insert, update, delete on public.precios_mes to authenticated;

-- Precios de Pau (REQUISITOS.md, sección 4). RPG de septiembre: supuesto igual que octubre.
insert into public.precios_mes (mes, tpa_1_vez, tpa_2_veces, tpa_3_veces, tpa_suelta, rpg_sesion) values
  ('2026-09-01', 46000, 74000, 100000, 16000, 46000),
  ('2026-10-01', 50000, 80000, 110000, 18000, 46000)
on conflict (mes) do nothing;

-- ---------------------------------------------------------------------
-- 2. pagos_tpa
-- ---------------------------------------------------------------------
create table public.pagos_tpa (
  id                uuid primary key default gen_random_uuid(),
  paciente_id       uuid not null references public.pacientes (id) on delete cascade,
  mes               date not null,               -- primer día del mes que paga
  concepto          text not null,               -- 'cuota' | 'sueltas'
  veces_por_semana  smallint,                    -- solo cuota: 1, 2 o 3
  modalidad         text,                        -- solo cuota: 'plan' | 'por_clase'
  clases            smallint,                    -- por_clase y sueltas: cuántas clases paga
  importe           integer not null check (importe >= 0),
  pagado_el         date not null,
  medio             text not null,               -- 'efectivo' | 'transferencia'
  nota              text check (char_length(nota) <= 500),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint pagos_tpa_mes_primer_dia check (extract(day from mes) = 1),
  constraint pagos_tpa_concepto check (concepto in ('cuota', 'sueltas')),
  constraint pagos_tpa_medio check (medio in ('efectivo', 'transferencia')),
  constraint pagos_tpa_clases check (clases is null or clases >= 1),
  constraint pagos_tpa_detalle check (
    (concepto = 'cuota'
      and veces_por_semana between 1 and 3
      and modalidad in ('plan', 'por_clase')
      and (modalidad = 'plan') = (clases is null))
    or
    (concepto = 'sueltas'
      and veces_por_semana is null
      and modalidad is null
      and clases is not null)
  )
);

comment on table public.pagos_tpa is
  'Pagos hechos de TPA: cuota mensual (uno por alumno y mes) o clases sueltas (una fila por pago). Sin fila = pendiente.';

-- Una sola cuota por alumno y mes. Las sueltas pueden tener varias filas.
create unique index pagos_tpa_una_cuota_por_mes
  on public.pagos_tpa (paciente_id, mes) where concepto = 'cuota';
create index pagos_tpa_mes_idx on public.pagos_tpa (mes);
create index pagos_tpa_paciente_idx on public.pagos_tpa (paciente_id);

create trigger pagos_tpa_updated_at
  before update on public.pagos_tpa
  for each row execute function public.update_updated_at();

alter table public.pagos_tpa enable row level security;

create policy "Solo usuaria autorizada" on public.pagos_tpa
  for all to authenticated
  using ((select private.es_usuaria_autorizada()))
  with check ((select private.es_usuaria_autorizada()));

revoke all on public.pagos_tpa from public, anon;
grant select, insert, update, delete on public.pagos_tpa to authenticated;

-- ---------------------------------------------------------------------
-- 3. Pago de cada sesión de RPG
-- ---------------------------------------------------------------------
alter table public.sesiones_rpg
  add column importe    integer check (importe >= 0),
  add column pagado_el  date,
  add column medio_pago text check (medio_pago in ('efectivo', 'transferencia'));

-- Si la sesión no está pagada, no tiene importe, fecha ni medio. Se limpian
-- solos (la app de main pasa a "pendiente" sin mandar estas columnas).
create or replace function public.limpiar_pago_sesion_rpg()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado_pago is distinct from 'pagado' then
    new.importe := null;
    new.pagado_el := null;
    new.medio_pago := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.limpiar_pago_sesion_rpg() from public, anon, authenticated;

create trigger sesiones_rpg_limpiar_pago
  before insert or update on public.sesiones_rpg
  for each row execute function public.limpiar_pago_sesion_rpg();

-- Garantía en la base (el trigger corre antes: nunca falla por la app de main).
alter table public.sesiones_rpg
  add constraint sesiones_rpg_pago_solo_si_pagado check (
    estado_pago = 'pagado' or (importe is null and pagado_el is null and medio_pago is null)
  );

commit;

-- =====================================================================
-- Verificación (correr después, en el SQL Editor):
-- =====================================================================
-- select to_char(mes, 'yyyy-MM') as mes, tpa_1_vez, tpa_2_veces, tpa_3_veces, tpa_suelta, rpg_sesion
--   from public.precios_mes order by mes;                                   -- 2 filas: 2026-09 y 2026-10
-- select c.relname, c.relrowsecurity,
--        has_table_privilege('anon', c.oid, 'select') as anon_select,
--        has_table_privilege('authenticated', c.oid, 'select') as auth_select,
--        (select count(*) from pg_policies p where p.tablename = c.relname) as politicas
--   from pg_class c where c.relname in ('precios_mes', 'pagos_tpa');        -- true, false, true, 1
-- select column_name from information_schema.columns
--   where table_name = 'sesiones_rpg' and column_name in ('importe', 'pagado_el', 'medio_pago'); -- 3 filas

-- =====================================================================
-- ROLLBACK — ⚠️ BORRA TODOS LOS PAGOS DE TPA, LOS PRECIOS Y EL IMPORTE,
-- FECHA Y MEDIO DE LAS SESIONES DE RPG (el pagado/pendiente queda). Antes,
-- exportarlos si hay alguno real. Correr todo junto en el SQL Editor.
-- =====================================================================
-- begin;
-- alter table public.sesiones_rpg drop constraint sesiones_rpg_pago_solo_si_pagado;
-- drop trigger sesiones_rpg_limpiar_pago on public.sesiones_rpg;
-- drop function public.limpiar_pago_sesion_rpg();
-- alter table public.sesiones_rpg drop column importe, drop column pagado_el, drop column medio_pago;
-- drop table public.pagos_tpa;
-- drop table public.precios_mes;
-- commit;
