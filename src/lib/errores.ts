// Errores sin datos de pacientes.
//
// Los errores de Postgres/Supabase pueden traer filas completas en `details`
// (por ejemplo "Failing row contains (...)"), así que en producción solo se
// loguea el contexto y el código, y a la usuaria se le muestra un mensaje
// genérico o uno escrito por nosotros (ErrorApp).

// Error con un mensaje pensado para mostrarle a la usuaria.
export class ErrorApp extends Error {}

// ---------------------------------------------------------------------
// Cortes por tiempo (fetchConTiempoMaximo, src/lib/tiempo-maximo.ts)
// ---------------------------------------------------------------------
// Verificado en @supabase/postgrest-js 2.106: si el fetch falla, la consulta
// no tira una excepción sino que devuelve
// { error: { message: `${nombre}: ${mensaje}`, code: '' } }. El código se
// pierde, así que el corte se reconoce por una marca en el mensaje. Y el
// nombre tiene que ser "AbortError": con cualquier otro, supabase-js reintenta
// las lecturas hasta 3 veces y la espera se multiplica.

type TipoPeticion = 'lectura' | 'escritura';

const MARCA_TIEMPO_AGOTADO: Record<TipoPeticion, string> = {
  lectura: 'tiempo-agotado-lectura',
  escritura: 'tiempo-agotado-escritura',
};

export const MENSAJE_RESULTADO_INCIERTO =
  'La conexión tardó demasiado y no sabemos si se guardó. Podés tocar Guardar de nuevo: no se va a duplicar.';

/** El error con el que fetchConTiempoMaximo corta una petición. */
export function errorTiempoAgotado(tipo: TipoPeticion): Error {
  const error = new Error(MARCA_TIEMPO_AGOTADO[tipo]);
  error.name = 'AbortError';
  return error;
}

function tiempoAgotado(error: unknown): TipoPeticion | null {
  if (typeof error !== 'object' || error === null || !('message' in error)) return null;
  const { message } = error as { message: unknown };
  if (typeof message !== 'string') return null;
  if (message.includes(MARCA_TIEMPO_AGOTADO.escritura)) return 'escritura';
  if (message.includes(MARCA_TIEMPO_AGOTADO.lectura)) return 'lectura';
  return null;
}

// Las funciones y el trigger de TPA (migración 20261023000001) escriben sus
// mensajes para Pau con este prefijo; no traen datos de pacientes.
const PREFIJO_MENSAJE_BASE = 'TPA: ';

function mensajeDeLaBase(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('message' in error)) return null;
  const { message } = error as { message: unknown };
  if (typeof message !== 'string' || !message.startsWith(PREFIJO_MENSAJE_BASE)) return null;
  return message.slice(PREFIJO_MENSAJE_BASE.length);
}

function codigoDeError(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error as { code: unknown };
    if (typeof code === 'string' || typeof code === 'number') return String(code);
  }
  return null;
}

export function registrarError(contexto: string, error: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    console.error(contexto, error);
    return;
  }
  console.error(contexto, codigoDeError(error) ?? 'sin código');
}

export function mensajeError(error: unknown): string {
  if (error instanceof ErrorApp) return error.message;

  const deLaBase = mensajeDeLaBase(error);
  if (deLaBase) return deLaBase.charAt(0).toUpperCase() + deLaBase.slice(1);

  switch (tiempoAgotado(error)) {
    case 'escritura':
      // Genérico (por ejemplo, al eliminar). Para los guardados: mensajeErrorAlGuardar.
      return 'La conexión tardó demasiado y no sabemos si se hizo el cambio. Revisá la pantalla antes de volver a intentar.';
    case 'lectura':
      return 'La conexión tardó demasiado. Revisá la señal y probá de nuevo.';
  }

  switch (codigoDeError(error)) {
    case '42501':
    case 'PGRST301':
      return 'No tenés permiso para hacer esto. Probá cerrar sesión y volver a entrar.';
    case '23505':
      return 'Ya existe un registro igual.';
    default:
      return 'Ocurrió un error. Revisá la conexión y probá de nuevo.';
  }
}

/**
 * Mensaje para un guardado que falló: `${prefijo} ${motivo}`. Si la escritura
 * se cortó por tiempo, solo el aviso de que no se sabe si se guardó (un
 * "No se pudo guardar" sería falso).
 */
export function mensajeErrorAlGuardar(prefijo: string, error: unknown): string {
  if (tiempoAgotado(error) === 'escritura') return MENSAJE_RESULTADO_INCIERTO;
  return `${prefijo} ${mensajeError(error)}`;
}
