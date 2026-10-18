"use client";

import { useSyncExternalStore } from 'react';

// Mismo corte que Tailwind `md` (768px): por debajo es "celular".
const CONSULTA = '(max-width: 767px)';

function suscribir(avisar: () => void) {
  const mql = window.matchMedia(CONSULTA);
  mql.addEventListener('change', avisar);
  return () => mql.removeEventListener('change', avisar);
}

/**
 * true en pantallas chicas, false en la compu y null mientras no se sabe
 * (render del servidor / primera hidratación). Con null, no renderizar
 * ninguna de las dos vistas para no cargar datos dos veces.
 */
export function useEsCelular(): boolean | null {
  return useSyncExternalStore(
    suscribir,
    () => window.matchMedia(CONSULTA).matches,
    () => null
  );
}
