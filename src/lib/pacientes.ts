// Datos de la ficha del paciente: baja lógica (migración 20261114000001),
// actividad, edad y cumpleaños (migración 20261118000001). Funciones puras.

import { addDays, format, parseISO } from 'date-fns';
import type { Actividad, Paciente } from '@/types';
import { ACTIVIDADES, ORDEN_ACTIVIDADES } from './estados';

/** "13/11/2026" */
function fechaCompleta(f: string): string {
  return `${Number(f.slice(8, 10))}/${Number(f.slice(5, 7))}/${f.slice(0, 4)}`;
}

/** "Dado de baja el 13/11/2026" (o "Dado de baja" si no hay fecha). */
export function textoBaja(paciente: Pick<Paciente, 'fecha_baja'>): string {
  const f = paciente.fecha_baja;
  return f ? `Dado de baja el ${fechaCompleta(f)}` : 'Dado de baja';
}

// ---------------------------------------------------------------------
// Actividad
// ---------------------------------------------------------------------

/**
 * Actividades del paciente, siempre en el mismo orden. Si la columna nueva
 * está vacía (copia vieja restaurada), se deducen de tipo_clase: "ambos" es
 * RPG + TPA.
 */
export function actividadesDe(paciente: Pick<Paciente, 'actividades' | 'tipo_clase'>): Actividad[] {
  const guardadas = ORDEN_ACTIVIDADES.filter((a) => paciente.actividades?.includes(a));
  if (guardadas.length > 0) return guardadas;
  if (paciente.tipo_clase === 'ambos') return ['RPG', 'TPA'];
  return paciente.tipo_clase ? [paciente.tipo_clase] : [];
}

/** "RPG · Domicilio" ('' si no tiene ninguna). */
export function textoActividades(paciente: Pick<Paciente, 'actividades' | 'tipo_clase'>): string {
  return actividadesDe(paciente).map((a) => ACTIVIDADES[a].label).join(' · ');
}

// ---------------------------------------------------------------------
// Edad y cumpleaños (fechas 'yyyy-MM-dd')
// ---------------------------------------------------------------------

function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

/**
 * Mes y día ('MM-dd') en que cumple años ese año. Quien nació un 29/02, los
 * años que no son bisiestos cumple el 28/02: el último día del mes, como
 * cuenta los años el Código Civil y Comercial (art. 6).
 */
function diaDelCumple(nacimiento: string, anio: number): string {
  const dia = nacimiento.slice(5, 10);
  return dia === '02-29' && !esBisiesto(anio) ? '02-28' : dia;
}

/** Años cumplidos en `fecha`; null si todavía no nació. */
export function edadEn(nacimiento: string, fecha: string): number | null {
  if (fecha < nacimiento) return null;
  const anio = Number(fecha.slice(0, 4));
  const yaCumplio = fecha.slice(5, 10) >= diaDelCumple(nacimiento, anio);
  return anio - Number(nacimiento.slice(0, 4)) - (yaCumplio ? 0 : 1);
}

/** La edad calculada si hay fecha de nacimiento; si no, la guardada. */
export function edadDe(paciente: Pick<Paciente, 'edad' | 'fecha_nacimiento'>, hoy: string): number | null {
  return paciente.fecha_nacimiento ? edadEn(paciente.fecha_nacimiento, hoy) : paciente.edad;
}

/** "32 años", "1 año" o "Edad no registrada". */
export function textoEdad(paciente: Pick<Paciente, 'edad' | 'fecha_nacimiento'>, hoy: string): string {
  const edad = edadDe(paciente, hoy);
  if (edad === null || edad === undefined) return 'Edad no registrada';
  return edad === 1 ? '1 año' : `${edad} años`;
}

/** "12/3/1985" */
export function textoFechaNacimiento(fecha: string): string {
  return fechaCompleta(fecha);
}

/** Una fecha de nacimiento que se puede guardar: no futura y desde 1900 (la base exige lo mismo). */
export function fechaNacimientoValida(fecha: string, hoy: string): boolean {
  return fecha >= '1900-01-01' && fecha <= hoy;
}

export interface Cumpleanios {
  pacienteId: string;
  nombre: string;
  /** Día en que lo festeja ('yyyy-MM-dd'). */
  fecha: string;
  /** 0 = hoy. */
  dias: number;
  /** Años que cumple. */
  cumple: number;
}

/**
 * Cumpleaños de pacientes activos desde hoy hasta `diasAdelante` días después,
 * del más cercano al más lejano (cruza fin de mes y fin de año).
 */
export function cumpleaniosProximos(
  pacientes: Pick<Paciente, 'id' | 'nombre' | 'activo' | 'fecha_nacimiento'>[],
  hoy: string,
  diasAdelante = 7,
): Cumpleanios[] {
  const lista: Cumpleanios[] = [];
  for (let dias = 0; dias <= diasAdelante; dias++) {
    const fecha = format(addDays(parseISO(hoy), dias), 'yyyy-MM-dd');
    const anio = Number(fecha.slice(0, 4));
    for (const p of pacientes) {
      const nacimiento = p.fecha_nacimiento;
      if (!p.activo || !nacimiento || diaDelCumple(nacimiento, anio) !== fecha.slice(5, 10)) continue;
      const cumple = edadEn(nacimiento, fecha);
      if (cumple) lista.push({ pacienteId: p.id, nombre: p.nombre, fecha, dias, cumple });
    }
  }
  return lista.sort((a, b) => a.dias - b.dias || a.nombre.localeCompare(b.nombre, 'es'));
}
