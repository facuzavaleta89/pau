import {
  ArrowLeftRight, Ban, Check, CircleCheck, CircleDashed, CircleHelp, CircleX, Clock, MessageSquare,
  MessageSquareWarning, RotateCcw, SquareDashed, Ticket, X,
  type LucideIcon,
} from 'lucide-react';
import type {
  EstadoAsistenciaTPA, EstadoPago, EstadoSesionRPG, MotivoCancelacionTPA, TipoAsistenciaTPA,
} from '@/types';

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

// Etiquetas con las palabras del Word de Pau. Avisos en ámbar, "No avisó" en rojo.
export const ESTADOS_ASISTENCIA: Record<EstadoAsistenciaTPA, ConfigEstado> = {
  presente:         { label: 'Presente',   clases: 'bg-emerald-50 text-emerald-700 border-emerald-200', icono: Check },
  aviso_con_tiempo: { label: 'Avisó C.T.', clases: 'bg-amber-50 text-amber-700 border-amber-200',       icono: MessageSquare },
  aviso_sin_tiempo: { label: 'Avisó S.T.', clases: 'bg-amber-50 text-amber-700 border-amber-200',       icono: MessageSquareWarning },
  falto_sin_avisar: { label: 'No avisó',   clases: 'bg-red-50 text-red-700 border-red-200',             icono: X },
  // Borde punteado y texto más oscuro: tiene que distinguirse del fondo de la card.
  pendiente:        { label: 'Sin marcar', clases: 'bg-white text-stone-600 border-dashed border-stone-400', icono: CircleDashed },
};

/** Chips de un fijo en el registro rápido. "Sin marcar" al final, para volver atrás. */
export const ORDEN_ESTADOS_FIJO: EstadoAsistenciaTPA[] = [
  'presente', 'aviso_con_tiempo', 'aviso_sin_tiempo', 'falto_sin_avisar', 'pendiente',
];

/** Chips de quien viene a ocupar un lugar (recupera, cambio, suelta). */
export const ORDEN_ESTADOS_OCUPANTE: EstadoAsistenciaTPA[] = ['presente', 'falto_sin_avisar', 'pendiente'];

/** Qué es quien viene a ocupar un lugar. El color lo da su estado. */
export const TIPOS_OCUPANTE: Record<Exclude<TipoAsistenciaTPA, 'fijo'>, { label: string; icono: LucideIcon }> = {
  recupera: { label: 'Recupera',          icono: RotateCcw },
  cambio:   { label: 'Cambio de horario', icono: ArrowLeftRight },
  suelta:   { label: 'Clase suelta',      icono: Ticket },
};

/** Lugar sin nadie (horario con menos fijos que el cupo, o fijo que avisó sin reemplazo). */
export const LUGAR_LIBRE = {
  label: 'Libre',
  clases: 'bg-teal-50 text-teal-700 border-dashed border-teal-200',
  icono: SquareDashed,
} satisfies ConfigEstado;

export const MOTIVOS_CANCELACION: Record<MotivoCancelacionTPA, string> = {
  feriado: 'Cancelada · Feriado',
  cancelada_por_pau: 'Cancelada por Pau',
};

export const CLASES_CANCELADA = 'bg-stone-100 text-stone-500 border-stone-300';
export const ICONO_CANCELADA = Ban;

export function esEstadoAsistenciaConocido(estado: string): estado is EstadoAsistenciaTPA {
  return Object.prototype.hasOwnProperty.call(ESTADOS_ASISTENCIA, estado);
}

/**
 * Configuración de un estado de asistencia leído de la base. Nunca falla: un
 * estado que esta versión no conoce (por ejemplo, uno nuevo escrito desde un
 * preview que comparte la base) se muestra en gris con su nombre, en lugar de
 * romper la pantalla. Sin fila = "Sin marcar".
 */
export function estadoAsistencia(estado: string | null | undefined): ConfigEstado {
  const valor = estado ?? 'pendiente';
  if (esEstadoAsistenciaConocido(valor)) return ESTADOS_ASISTENCIA[valor];
  const texto = valor.replace(/_/g, ' ');
  return {
    label: texto.charAt(0).toUpperCase() + texto.slice(1),
    clases: 'bg-stone-50 text-stone-600 border-stone-300',
    icono: CircleHelp,
  };
}

/** Etiqueta según quién es: para quien venía a ocupar un lugar, "No avisó" es "No vino". */
export function etiquetaAsistencia(estado: string, tipo: TipoAsistenciaTPA): string {
  if (tipo !== 'fijo' && estado === 'falto_sin_avisar') return 'No vino';
  return estadoAsistencia(estado).label;
}

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
