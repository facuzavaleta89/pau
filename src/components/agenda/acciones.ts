import type { AlertaFaltas } from '@/lib/alertas';
import type { CeldaTPA, SesionRPG } from '@/types';

/** Lo que se puede hacer desde cualquier vista de la agenda (abre los modales de siempre). */
export interface AccionesAgenda {
  /** "+": TurnoModal con esa fecha ('yyyy-MM-dd') y, si hay, esa hora ('HH:mm'). */
  onNuevoTurno: (fecha: string, hora?: string) => void;
  onEditarTurno: (turno: SesionRPG) => void;
  /** TpaClaseModal; `ocupar` = directo a "Ocupar lugar". */
  onAbrirClase: (celda: CeldaTPA, ocupar?: boolean) => void;
  onAbrirPaciente: (pacienteId: string) => void;
  /** Ir a la vista Día de esa fecha. */
  onAbrirDia: (fecha: string) => void;
  alertaDe: (pacienteId: string) => AlertaFaltas | null;
}
