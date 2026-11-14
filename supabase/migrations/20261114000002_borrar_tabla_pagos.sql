-- =====================================================================
-- Datos reales — Borra la tabla vieja `pagos` (sin uso desde la Fase 2:
-- los pagos van en pagos_tpa y en sesiones_rpg).
--
-- Guarda: aborta si `pagos` tiene alguna fila distinta de las 2 de prueba
-- conocidas (leídas el 13/11/2026: octubre $12.000 "ambos" pendiente y
-- noviembre $8.000 "TPA" pagado, armadas con los precios inventados de la
-- pantalla vieja). Si aborta, no borra nada: avisarle al agente.
--
-- ⚠️ Aplicar DESPUÉS del merge de fase-2/datos-reales: la app de `main`
-- todavía cuenta las filas de `pagos` en el diálogo "Eliminar paciente".
-- La app nueva ya no la lee ni la escribe.
-- =====================================================================

begin;

do $$
declare
  v_otras integer;
begin
  if to_regclass('public.pagos') is null then
    raise notice 'La tabla pagos ya no existe: nada que hacer.';
    return;
  end if;

  select count(*) into v_otras
    from public.pagos
   where id not in ('2ea90862-c178-4a4e-8c2d-e45b09d4e093', '97c38ccd-6194-422a-a6dc-c305bc925f4d');

  if v_otras > 0 then
    raise exception 'pagos tiene % fila(s) que no son las 2 de prueba: no se borra nada.', v_otras;
  end if;
end;
$$;

drop table if exists public.pagos;

commit;

-- =====================================================================
-- Verificación (correr después de aplicar):
--
-- select to_regclass('public.pagos');   -- null
-- select count(*) from pg_constraint where contype = 'f' and confrelid = 'public.pacientes'::regclass;   -- 6
-- =====================================================================

-- =====================================================================
-- Rollback: no tiene. Las 2 filas eran de prueba y la app nueva no usa la
-- tabla. Si hiciera falta recrearla vacía, la definición está en la línea
-- base (20260520000000_esquema_inicial.sql), con su RLS de la migración
-- 20261017000001, y FK ON DELETE RESTRICT (20261114000001).
-- =====================================================================
