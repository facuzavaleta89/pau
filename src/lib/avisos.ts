import { differenceInMinutes } from 'date-fns';
import type { AsistenciaTPA, EstadoAsistenciaTPA } from '@/types';
import { normalizarHora } from './horas';

// Avisos de falta en TPA: con tiempo / sin tiempo (docs/DISENO_ASISTENCIA_TPA.md, 3.4).
// La app solo SUGIERE: Pau confirmó que nunca bloquea y que hace excepciones.

/** Con tiempo = el aviso se carga 24 h o más antes del inicio de la clase. */
export const HORAS_CON_TIEMPO = 24;

// Las clases son en Argentina, que está en UTC−3 todo el año (sin horario de
// verano desde 2009). Se fija el desfase en lugar de usar la hora del
// dispositivo: así la cuenta da igual aunque la compu esté en otra zona.
const DESFASE_ARGENTINA = '-03:00';

export type EstadoAviso = Extract<EstadoAsistenciaTPA, 'aviso_con_tiempo' | 'aviso_sin_tiempo'>;

export function esAviso(estado: string): estado is EstadoAviso {
  return estado === 'aviso_con_tiempo' || estado === 'aviso_sin_tiempo';
}

/** Instante en que empieza la clase ('yyyy-MM-dd' + 'HH:mm' o 'HH:mm:ss', hora argentina). */
export function inicioClaseTPA(fecha: string, hora: string): Date {
  return new Date(`${fecha}T${normalizarHora(hora)}:00${DESFASE_ARGENTINA}`);
}

/**
 * Clase futura = todavía no empezó. En una clase futura solo se cargan
 * avisos: no se puede marcar Presente ni No avisó.
 */
export function esClaseFutura(fecha: string, hora: string, ahora: Date): boolean {
  return inicioClaseTPA(fecha, hora).getTime() > ahora.getTime();
}

export interface SugerenciaAviso {
  estado: EstadoAviso;
  /** Lo que se le muestra a Pau, con el motivo: "Faltan 49 h para la clase → con tiempo". */
  motivo: string;
}

function textoFalta(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  // En horas hasta 3 días ("Faltan 49 h"): cerca del límite de 24 h importa la precisión.
  if (minutos < 72 * 60) return `${Math.floor(minutos / 60)} h`;
  return `${Math.floor(minutos / (24 * 60))} días`;
}

/**
 * Con tiempo o sin tiempo, si el aviso se carga ahora. null si la clase ya
 * empezó: la app no sabe cuándo llegó el aviso y elige Pau.
 */
export function sugerirAviso(fecha: string, hora: string, ahora: Date): SugerenciaAviso | null {
  const minutos = differenceInMinutes(inicioClaseTPA(fecha, hora), ahora);
  if (minutos <= 0) return null;
  const conTiempo = minutos >= HORAS_CON_TIEMPO * 60;
  return {
    estado: conTiempo ? 'aviso_con_tiempo' : 'aviso_sin_tiempo',
    motivo: `Faltan ${textoFalta(minutos)} para la clase → ${conTiempo ? 'con tiempo' : 'sin tiempo'}`,
  };
}

/**
 * Valor de `avisado_at` al guardar un estado. Solo los avisos lo llevan (la
 * base lo exige). Pasar de C.T. a S.T. (o al revés) conserva el momento del
 * primer aviso; un aviso nuevo toma `ahora` (también en clases pasadas: es
 * cuándo se cargó, no cuándo avisó).
 */
export function avisadoAtAlGuardar(
  anterior: Pick<AsistenciaTPA, 'estado' | 'avisado_at'> | null,
  nuevoEstado: EstadoAsistenciaTPA,
  ahora: Date,
): string | null {
  if (!esAviso(nuevoEstado)) return null;
  if (anterior && esAviso(anterior.estado) && anterior.avisado_at) return anterior.avisado_at;
  return ahora.toISOString();
}
