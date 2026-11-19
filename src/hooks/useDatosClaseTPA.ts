"use client";

import { useCallback, useMemo } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { cargarDatosAlertas, cargarDatosRecuperaciones } from '@/lib/queries';
import { alertasDeFaltas, DIAS_HACIA_ATRAS_ALERTA, type AlertaFaltas } from '@/lib/alertas';
import { hoyArgentina } from '@/lib/pagos';
import { useDatos } from './useDatos';

/**
 * Lo que necesitan TpaClaseModal y TpaHorarioCard fuera de la agenda TPA
 * (Hoy, Agenda): el historial de recuperaciones y la alerta de faltas. Si
 * algo falla, avisa y la pantalla sigue andando.
 */
export function useDatosClaseTPA(ahora: Date) {
  const hoy = hoyArgentina(ahora);
  const cargarRec = useCallback(() => cargarDatosRecuperaciones(), []);
  const rec = useDatos('recuperaciones', cargarRec, 'No se pudieron cargar las recuperaciones.');
  const cargarAlertas = useCallback(
    () => cargarDatosAlertas(format(addDays(parseISO(hoy), -DIAS_HACIA_ATRAS_ALERTA), 'yyyy-MM-dd'), hoy),
    [hoy]
  );
  const filas = useDatos(`alertas_${hoy}`, cargarAlertas, 'No se pudieron cargar las alertas de faltas.');

  const alertas = useMemo(() => alertasDeFaltas(filas.datos ?? [], ahora), [filas.datos, ahora]);
  const alertaDe = useCallback((pacienteId: string): AlertaFaltas | null => alertas.get(pacienteId) ?? null, [alertas]);
  const recargarRec = rec.recargar;
  const recargarAlertas = filas.recargar;
  const recargar = useCallback(() => { recargarRec(); recargarAlertas(); }, [recargarRec, recargarAlertas]);

  return { datosRec: rec.datos, filasAlertas: filas.datos, alertaDe, recargar };
}
