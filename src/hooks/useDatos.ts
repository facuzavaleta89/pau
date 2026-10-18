"use client";

import { useCallback, useEffect, useState } from 'react';
import { mensajeError, registrarError } from '@/lib/errores';
import { useToast } from '@/components/ui/ToastProvider';

interface EstadoDatos<T> {
  datos: T | null;
  /** Está cargando (si ya había datos, se siguen mostrando mientras tanto). */
  cargando: boolean;
  /** La última carga falló: mostrar un estado de error con "Reintentar". */
  error: boolean;
  recargar: () => void;
}

/**
 * Carga datos con una clave (por ejemplo, la semana) y avisa SIEMPRE si falla:
 * Toast de error + `error: true` para que la pantalla muestre "Reintentar"
 * en lugar de quedar vacía como si no hubiera datos.
 *
 * `cargar` tiene que depender solo de `clave` (envolverla en useCallback).
 * Con `clave` null no carga nada (por ejemplo, mientras no se sabe si es celular).
 */
export function useDatos<T>(clave: string | null, cargar: () => Promise<T>, mensajeFallo: string): EstadoDatos<T> {
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const [resultado, setResultado] = useState<{ clave: string; datos: T | null; error: boolean }>({
    clave: '',
    datos: null,
    error: false,
  });

  const claveCompleta = `${clave}#${version}`;

  useEffect(() => {
    if (clave === null) return;
    let cancelado = false;
    cargar()
      .then((datos) => {
        if (!cancelado) setResultado({ clave: claveCompleta, datos, error: false });
      })
      .catch((err: unknown) => {
        registrarError(mensajeFallo, err);
        if (cancelado) return;
        toast.error(`${mensajeFallo} ${mensajeError(err)}`);
        setResultado((prev) => ({
          clave: claveCompleta,
          datos: prev.clave.split('#')[0] === clave ? prev.datos : null,
          error: true,
        }));
      });
    return () => { cancelado = true; };
  }, [clave, claveCompleta, cargar, mensajeFallo, toast]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  // Al cambiar de clave (otra semana) no se muestran los datos de la anterior;
  // al recargar la misma clave, sí (para que no parpadee después de guardar).
  const mismaClave = resultado.clave.split('#')[0] === clave;

  return {
    datos: mismaClave ? resultado.datos : null,
    cargando: resultado.clave !== claveCompleta,
    error: resultado.clave === claveCompleta && resultado.error,
    recargar,
  };
}
