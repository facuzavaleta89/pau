import { addDays, eachDayOfInterval, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import type { CeldaTPA, SesionRPG } from '@/types';
import { celdasEntre, type DatosSemanaTPA } from './tpa';

// ---------------------------------------------------------------------
// Agenda (/agenda). Única fuente para las vistas Día, Semana y Mes
// (docs/DISENO_AGENDA.md, 1.6). Día: turnos individuales + clases de TPA.
// Semana y Mes: solo turnos individuales (Pau, 20/11/2026).
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

/** Clase sin nadie (ni fijos ni quien ocupe un lugar) y sin notas: en Día, una línea atenuada. */
export function claseVacia(celda: CeldaTPA): boolean {
  return celda.alumnos.length === 0 && celda.notas.length === 0;
}

/** "10:30" → "10": la fila de la hora en Día. */
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

/** Turnos individuales entre `desde` y `hasta` ('yyyy-MM-dd', inclusive), por fecha, hora y nombre. */
export function turnosEntre(desde: string, hasta: string, sesiones: SesionRPG[]): SesionRPG[] {
  return sesiones
    .filter((s) => s.fecha >= desde && s.fecha <= hasta)
    .sort((a, b) => a.fecha.localeCompare(b.fecha)
      || a.hora.localeCompare(b.hora)
      || (a.pacientes?.nombre ?? '').localeCompare(b.pacientes?.nombre ?? '', 'es'));
}

export interface DiaSemanaAgenda {
  fecha: string;
  /** Sus turnos individuales, por hora. */
  turnos: SesionRPG[];
}

/**
 * Los 7 días (lunes a domingo) de la semana de `fecha`, cada uno con sus
 * turnos individuales. Sin TPA: en Semana y Mes "se le mezcla" (Pau,
 * 20/11/2026); las clases se ven en Día y en TPA.
 */
export function armarSemanaAgenda(fecha: Date, sesiones: SesionRPG[]): DiaSemanaAgenda[] {
  const lunes = startOfWeek(fecha, SEMANA);
  const fechas = Array.from({ length: 7 }, (_, i) => aTexto(addDays(lunes, i)));
  const turnos = turnosEntre(fechas[0], fechas[6], sesiones);
  return fechas.map((f) => ({ fecha: f, turnos: turnos.filter((t) => t.fecha === f) }));
}

/** Horas de la vista Día: de 8 a 20 siempre, más las de cualquier evento fuera de ese rango. */
export function horasDelDia(eventos: EventoAgenda[]): string[] {
  const horas = new Set<string>();
  for (let h = PRIMERA_HORA_DIA; h <= ULTIMA_HORA_DIA; h++) horas.add(String(h).padStart(2, '0'));
  eventos.forEach((e) => horas.add(bloqueDeHora(e.hora)));
  return [...horas].sort();
}

export interface DiaMes {
  fecha: string;
  /** false = día de relleno del mes anterior o siguiente. */
  delMes: boolean;
  /** Los primeros MAX_TURNOS_POR_DIA turnos, por hora. */
  turnos: SesionRPG[];
  /** Turnos que no entran: "+N más" (0 = no se muestra). */
  masTurnos: number;
}

/** Rango que muestra el mes de `fecha`: de lunes a domingo, con los días de relleno. */
export function rangoMes(fecha: Date): { desde: string; hasta: string } {
  return {
    desde: aTexto(startOfWeek(startOfMonth(fecha), SEMANA)),
    hasta: aTexto(endOfWeek(endOfMonth(fecha), SEMANA)),
  };
}

/** El mes de `fecha` en semanas de lunes a domingo. Cada día, sus turnos individuales (hasta `max`); sin TPA. */
export function armarMesAgenda(fecha: Date, sesiones: SesionRPG[], max = MAX_TURNOS_POR_DIA): DiaMes[][] {
  const { desde, hasta } = rangoMes(fecha);
  const mes = format(fecha, 'yyyy-MM');
  const turnos = turnosEntre(desde, hasta, sesiones);
  const dias = eachDayOfInterval({ start: parseISO(desde), end: parseISO(hasta) }).map(aTexto).map((f): DiaMes => {
    const delDia = turnos.filter((t) => t.fecha === f);
    return {
      fecha: f,
      delMes: f.startsWith(mes),
      turnos: delDia.slice(0, max),
      masTurnos: Math.max(0, delDia.length - max),
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
