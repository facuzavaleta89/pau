// Las columnas `time` de Postgres devuelven "HH:mm:ss" y la app trabaja con
// "HH:mm" (grilla TPA, <input type="time">). Toda hora que venga de la base
// pasa por acá antes de comparar o mostrar.
export function normalizarHora(hora: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(hora.trim());
  if (!match) return hora;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}
