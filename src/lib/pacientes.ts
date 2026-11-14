// Textos de la ficha del paciente (baja lógica: migración 20261114000001).

import type { Paciente } from '@/types';

/** "Dado de baja el 13/11/2026" (o "Dado de baja" si no hay fecha). */
export function textoBaja(paciente: Pick<Paciente, 'fecha_baja'>): string {
  const f = paciente.fecha_baja;
  if (!f) return 'Dado de baja';
  return `Dado de baja el ${Number(f.slice(8, 10))}/${Number(f.slice(5, 7))}/${f.slice(0, 4)}`;
}
