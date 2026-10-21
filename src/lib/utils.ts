import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * UUID v4 para el id de un registro nuevo, generado al abrir el formulario:
 * si Pau toca Guardar dos veces (por ejemplo, después de un corte), la base
 * reconoce el mismo id y no lo duplica (ver insertarSinDuplicar en queries.ts).
 * crypto.randomUUID solo existe en https (o localhost) y desde iOS 15.4; si no
 * está (por ejemplo, probando desde el celular por la IP de la red local), se
 * arma con crypto.getRandomValues, que existe en todos lados.
 */
export function nuevoId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // versión 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
