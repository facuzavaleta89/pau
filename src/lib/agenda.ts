import { addDays, eachDayOfInterval, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import type { CeldaTPA, SesionRPG } from '@/types';
import { celdasEntre, type DatosSemanaTPA } from './tpa';

// ---------------------------------------------------------------------
// Agenda unificada (/agenda): turnos individuales + clases de TPA.
// Única fuente para las vistas Día, Semana y Mes (docs/DISENO_AGENDA.md, 1.6).
// ---------------------------------------------------------------------

export interface DatosAgenda {
  sesiones: SesionRPG[];
  tpa: DatosSemanaTPA;
}

export type EventoAgenda =
  | { tipo: 'turno'; clave: string; fecha: string; hora: string; turno: SesionRPG }
  | { tipo: 'clase'; clave: string; fecha: string; hora: string; celda: CeldaTPA; vacia: boolean };

export type Vista = 'dia' | 'semana' | 'mes';

/** Encabezado del mes (lunes a domingo). */
export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

/** Turnos que se ven en una celda del mes antes de "+N más". */
export const MAX_TURNOS_POR_DIA = 3;

/** Horas que la vista Día muestra siempre (para poder dar un turno a cualquier hora). */
export const PRIMERA_HORA_DIA = 8;
export const ULTIMA_HORA_DIA = 20;

const SEMANA = { weekStartsOn: 1 } as const;
const aTexto = (d: Date) => format(d, 'yyyy-MM-dd');

/** Clase sin nadie (ni fijos ni quien ocupe un lugar) y sin notas: se atenúa o se oculta. */
export function claseVacia(celda: CeldaTPA): boolean {
  return celda.alumnos.length === 0 && celda.notas.length === 0;
}

/** "10:30" → "10": la fila de la hora en Día y Semana. */
export function bloqueDeHora(hora: string): string {
  return hora.slice(0, 2);
}

/**
 * Turnos y clases entre `desde` y `hasta` ('yyyy-MM-dd', inclusive), ordenados
 * por fecha y hora (a la misma hora, el turno primero). Las clases salen de
 * celdasEntre: nunca se vuelven a filtrar los horarios acá.
 */
export function eventosEntre(desde: string, hasta: string, datos: DatosAgenda): EventoAgenda[] {
  const turnos: EventoAgenda[] = datos.sesiones
    .filter((s) => s.fecha >= desde && s.fecha <= hasta)
    .map((turno) => ({ tipo: 'turno', clave: `turno_${turno.id}`, fecha: turno.fecha, hora: turno.hora, turno }));
  const clases: EventoAgenda[] = celdasEntre(desde, hasta, datos.tpa)
    .map((celda) => ({ tipo: 'clase', clave: celda.clave, fecha: celda.fecha, hora: celda.hora, celda, vacia: claseVacia(celda) }));

  const nombre = (e: EventoAgenda) => (e.tipo === 'turno' ? e.turno.pacientes?.nombre ?? '' : '');
  return [...turnos, ...clases].sort((a, b) =>
    a.fecha.localeCompare(b.fecha)
    || a.hora.localeCompare(b.hora)
    || (a.tipo === b.tipo ? 0 : a.tipo === 'turno' ? -1 : 1)
    || nombre(a).localeCompare(nombre(b), 'es'));
}

export interface DiaAgenda {
  fecha: string;
  eventos: EventoAgenda[];
}

function agruparPorDia(fechas: string[], eventos: EventoAgenda[]): DiaAgenda[] {
  return fechas.map((fecha) => ({ fecha, eventos: eventos.filter((e) => e.fecha === fecha) }));
}

export interface SemanaAgenda {
  dias: DiaAgenda[];
  /** Filas de la grilla: las horas ("10") con algo en algún día, ordenadas. */
  horas: string[];
}

/** Los 7 días (lunes a domingo) de la semana de `fecha`. */
export function armarSemanaAgenda(fecha: Date, datos: DatosAgenda): SemanaAgenda {
  const lunes = startOfWeek(fecha, SEMANA);
  const fechas = Array.from({ length: 7 }, (_, i) => aTexto(addDays(lunes, i)));
  const eventos = eventosEntre(fechas[0], fechas[6], datos);
  return {
    dias: agruparPorDia(fechas, eventos),
    horas: [...new Set(eventos.map((e) => bloqueDeHora(e.hora)))].sort(),
  };
}

/** Horas de la vista Día: de 8 a 20 siempre, más las de cualquier evento fuera de ese rango. */
export function horasDelDia(eventos: EventoAgenda[]): string[] {
  const horas = new Set<string>();
  for (let h = PRIMERA_HORA_DIA; h <= ULTIMA_HORA_DIA; h++) horas.add(String(h).padStart(2, '0'));
  eventos.forEach((e) => horas.add(bloqueDeHora(e.hora)));
  return [...horas].sort();
}

export interface ResumenTPA {
  /** Clases con alumnos que se dan (no canceladas). */
  clases: number;
  /** Lugares libres en esas clases. */
  libres: number;
  canceladas: number;
}

/** Resumen de las clases de un día. Las clases vacías no cuentan: taparían los turnos. null si no hay nada. */
export function resumenTPA(celdas: CeldaTPA[]): ResumenTPA | null {
  const conAlguien = celdas.filter((c) => !claseVacia(c));
  const canceladas = conAlguien.filter((c) => c.lugares.cancelada).length;
  const dadas = conAlguien.filter((c) => !c.lugares.cancelada);
  if (dadas.length === 0 && canceladas === 0) return null;
  return { clases: dadas.length, libres: dadas.reduce((n, c) => n + c.lugares.libres, 0), canceladas };
}

/** "TPA: 5 clases · 3 libres", "TPA: 1 clase · completa", "TPA: 7 canceladas". */
export function textoResumenTPA(r: ResumenTPA): string {
  const partes: string[] = [];
  if (r.clases > 0) {
    partes.push(`${r.clases} ${r.clases === 1 ? 'clase' : 'clases'}`);
    partes.push(r.libres === 0 ? (r.clases === 1 ? 'completa' : 'completas') : `${r.libres} ${r.libres === 1 ? 'libre' : 'libres'}`);
  }
  if (r.canceladas > 0) partes.push(`${r.canceladas} ${r.canceladas === 1 ? 'cancelada' : 'canceladas'}`);
  return `TPA: ${partes.join(' · ')}`;
}

export interface DiaMes {
  fecha: string;
  /** false = día de relleno del mes anterior o siguiente. */
  delMes: boolean;
  /** Los primeros MAX_TURNOS_POR_DIA turnos, por hora. */
  turnos: SesionRPG[];
  /** Turnos que no entran: "+N más" (0 = no se muestra). */
  masTurnos: number;
  tpa: ResumenTPA | null;
}

/** Rango que muestra el mes de `fecha`: de lunes a domingo, con los días de relleno. */
export function rangoMes(fecha: Date): { desde: string; hasta: string } {
  return {
    desde: aTexto(startOfWeek(startOfMonth(fecha), SEMANA)),
    hasta: aTexto(endOfWeek(endOfMonth(fecha), SEMANA)),
  };
}

/** El mes de `fecha` en semanas de lunes a domingo. Cada día, sus turnos (hasta `max`) y el resumen de TPA. */
export function armarMesAgenda(fecha: Date, datos: DatosAgenda, max = MAX_TURNOS_POR_DIA): DiaMes[][] {
  const { desde, hasta } = rangoMes(fecha);
  const mes = format(fecha, 'yyyy-MM');
  const fechas = eachDayOfInterval({ start: parseISO(desde), end: parseISO(hasta) }).map(aTexto);
  const dias = agruparPorDia(fechas, eventosEntre(desde, hasta, datos)).map(({ fecha: f, eventos }): DiaMes => {
    const turnos = eventos.flatMap((e) => (e.tipo === 'turno' ? [e.turno] : []));
    const celdas = eventos.flatMap((e) => (e.tipo === 'clase' ? [e.celda] : []));
    return {
      fecha: f,
      delMes: f.startsWith(mes),
      turnos: turnos.slice(0, max),
      masTurnos: Math.max(0, turnos.length - max),
      tpa: resumenTPA(celdas),
    };
  });
  return Array.from({ length: dias.length / 7 }, (_, i) => dias.slice(i * 7, i * 7 + 7));
}

/** Rango de datos que necesita cada vista. */
export function rangoVista(vista: Vista, fecha: Date): { desde: string; hasta: string } {
  if (vista === 'mes') return rangoMes(fecha);
  if (vista === 'semana') {
    const lunes = startOfWeek(fecha, SEMANA);
    return { desde: aTexto(lunes), hasta: aTexto(addDays(lunes, 6)) };
  }
  return { desde: aTexto(fecha), hasta: aTexto(fecha) };
}
