"use client";

import { useSyncExternalStore } from 'react';

function suscribir(avisar: () => void) {
  window.addEventListener('online', avisar);
  window.addEventListener('offline', avisar);
  return () => {
    window.removeEventListener('online', avisar);
    window.removeEventListener('offline', avisar);
  };
}

/** true si el navegador dice que hay conexión. En el servidor, se asume que sí. */
export function useConexion(): boolean {
  return useSyncExternalStore(suscribir, () => navigator.onLine, () => true);
}
