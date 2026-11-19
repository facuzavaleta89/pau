"use client";

import { useMemo, useSyncExternalStore } from 'react';

const UN_MINUTO = 60_000;

function suscribir(avisar: () => void): () => void {
  const intervalo = setInterval(avisar, UN_MINUTO);
  window.addEventListener('focus', avisar);
  document.addEventListener('visibilitychange', avisar);
  return () => {
    clearInterval(intervalo);
    window.removeEventListener('focus', avisar);
    document.removeEventListener('visibilitychange', avisar);
  };
}

const minutoActual = () => Math.floor(Date.now() / UN_MINUTO);
const sinHoraEnElServidor = () => null;

/**
 * La hora actual, al minuto. Se actualiza sola y al volver a la pestaña: una
 * pantalla "Hoy" que quedó abierta de un día para el otro no muestra el día anterior.
 *
 * null en el primer render: las páginas se generan al compilar, y una fecha
 * calculada ahí sería la del deploy, no la de hoy.
 */
export function useAhora(): Date | null {
  const minuto = useSyncExternalStore(suscribir, minutoActual, sinHoraEnElServidor);
  return useMemo(() => (minuto === null ? null : new Date(minuto * UN_MINUTO)), [minuto]);
}
