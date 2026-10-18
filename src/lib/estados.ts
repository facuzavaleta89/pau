import {
  ArrowLeftRight, Ban, Check, CircleCheck, CircleDashed, CircleX, Clock, MessageSquare, RotateCcw, X,
  type LucideIcon,
} from 'lucide-react';
import type { EstadoAsistenciaTPA, EstadoPago, EstadoSesionRPG } from '@/types';

// Única fuente de etiquetas, colores e íconos de estados (ver DESIGN.md).
// Para cambiar el código de colores de Pau, se cambia solo acá.

export interface ConfigEstado {
  label: string;
  /** Fondo + texto + borde, para chips y badges. */
  clases: string;
  icono: LucideIcon;
}

// ---------------------------------------------------------------------
// Asistencia TPA
// ---------------------------------------------------------------------

export const ESTADOS_ASISTENCIA: Record<EstadoAsistenciaTPA, ConfigEstado> = {
  presente:         { label: 'Presente',        clases: 'bg-emerald-50 text-emerald-700 border-emerald-200', icono: Check },
  aviso_ausencia:   { label: 'Avisó',           clases: 'bg-amber-50 text-amber-700 border-amber-200',       icono: MessageSquare },
  falto_sin_avisar: { label: 'Faltó',           clases: 'bg-red-50 text-red-700 border-red-200',             icono: X },
  recupera:         { label: 'Recupera',        clases: 'bg-blue-50 text-blue-700 border-blue-200',          icono: RotateCcw },
  vino_otra_clase:  { label: 'De otro horario', clases: 'bg-teal-50 text-teal-700 border-teal-200',          icono: ArrowLeftRight },
  cancelado:        { label: 'Cancelado',       clases: 'bg-stone-100 text-stone-500 border-stone-300',      icono: Ban },
  // Borde punteado y texto más oscuro: tiene que distinguirse del fondo de la card.
  pendiente:        { label: 'Sin marcar',      clases: 'bg-white text-stone-600 border-dashed border-stone-400', icono: CircleDashed },
};

/** Orden de los chips en el registro rápido: lo más usado primero, "Sin marcar" al final para volver atrás. */
export const ORDEN_ESTADOS_ASISTENCIA: EstadoAsistenciaTPA[] = [
  'presente', 'aviso_ausencia', 'falto_sin_avisar', 'recupera', 'vino_otra_clase', 'cancelado', 'pendiente',
];

// ---------------------------------------------------------------------
// RPG
// ---------------------------------------------------------------------

export const ESTADOS_SESION_RPG: Record<EstadoSesionRPG, ConfigEstado> = {
  realizada: { label: 'Realizada', clases: 'bg-emerald-50 text-emerald-700 border-emerald-200', icono: CircleCheck },
  cancelada: { label: 'Cancelada', clases: 'bg-stone-100 text-stone-500 border-stone-300',      icono: CircleX },
  pendiente: { label: 'Pendiente', clases: 'bg-white text-stone-700 border-stone-200',          icono: Clock },
};

export const ORDEN_ESTADOS_SESION_RPG: EstadoSesionRPG[] = ['pendiente', 'realizada', 'cancelada'];

// ---------------------------------------------------------------------
// Pago (RPG por sesión y pagos mensuales)
// ---------------------------------------------------------------------

export interface ConfigPago extends ConfigEstado {
  /** Color del punto indicador. */
  punto: string;
}

export const ESTADOS_PAGO: Record<EstadoPago, ConfigPago> = {
  pagado:    { label: 'Pagado',    clases: 'bg-emerald-50 text-emerald-700 border-emerald-200', icono: CircleCheck, punto: 'bg-emerald-500' },
  pendiente: { label: 'Pendiente', clases: 'bg-amber-50 text-amber-700 border-amber-200',       icono: Clock,       punto: 'bg-amber-500' },
};

export const ORDEN_ESTADOS_PAGO: EstadoPago[] = ['pendiente', 'pagado'];
