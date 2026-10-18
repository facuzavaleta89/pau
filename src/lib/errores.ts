// Errores sin datos de pacientes.
//
// Los errores de Postgres/Supabase pueden traer filas completas en `details`
// (por ejemplo "Failing row contains (...)"), así que en producción solo se
// loguea el contexto y el código, y a la usuaria se le muestra un mensaje
// genérico o uno escrito por nosotros (ErrorApp).

// Error con un mensaje pensado para mostrarle a la usuaria.
export class ErrorApp extends Error {}

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
