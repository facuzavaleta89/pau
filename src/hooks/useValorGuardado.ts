"use client";

import { useCallback, useSyncExternalStore } from 'react';

// Un valor chico que se recuerda en este navegador (por ejemplo, la última
// pestaña de TPA o cuándo se descargó la última copia). Si el navegador no deja guardar (modo privado, sitio
// bloqueado), se recuerda solo mientras la página está abierta.

const oyentes = new Set<() => void>();
const enMemoria = new Map<string, string>();

function leer(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave) ?? enMemoria.get(clave) ?? null;
  } catch {
    return enMemoria.get(clave) ?? null;
  }
}

function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  return () => { oyentes.delete(avisar); };
}

/** [texto, guardar]: el último texto guardado con esa clave, o null (también en el render del servidor). */
export function useTextoGuardado(clave: string): [string | null, (valor: string) => void] {
  const guardado = useSyncExternalStore(suscribir, () => leer(clave), () => null);

  const guardar = useCallback((nuevo: string) => {
    enMemoria.set(clave, nuevo);
    try {
      window.localStorage.setItem(clave, nuevo);
    } catch {
      // Sin almacenamiento: queda en memoria.
    }
    oyentes.forEach((avisar) => avisar());
  }, [clave]);

  return [guardado, guardar];
}

/**
 * [valor, guardar]. `valor` es `inicial` la primera vez (y en el render del
 * servidor) y después el último guardado, si es uno de `validos`.
 */
export function useValorGuardado<T extends string>(clave: string, inicial: T, validos: readonly T[]): [T, (valor: T) => void] {
  const [guardado, guardar] = useTextoGuardado(clave);
  return [validos.find((v) => v === guardado) ?? inicial, guardar];
}
