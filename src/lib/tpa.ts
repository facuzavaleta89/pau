import { addDays, format, isWeekend, nextMonday, startOfWeek } from 'date-fns';
import type {
  AlumnoCeldaTPA, AsistenciaTPA, CeldaTPA, ClaseTPA, DiaSemana, HorarioTPA, LugaresTPA, SemanaTPA,
  TipoAsistenciaTPA,
} from '@/types';
import { esAviso } from './avisos';
import { normalizarHora } from './horas';

// ---------------------------------------------------------------------
// Configuración de TPA (cambiar acá si cambian los horarios o el cupo)
// ---------------------------------------------------------------------

/** Lugares por clase. Pendiente de confirmar con Pau (pregunta 2 de PENDIENTES). */
export const CUPO_TPA = 4;

/** Horarios habituales de Pau (REQUISITOS.md). */
export const HORARIOS_TPA: Record<DiaSemana, string[]> = {
  lunes:     ['10:30', '11:30', '12:30', '16:00', '17:00', '18:00', '19:00'],
  miercoles: ['10:30', '11:30', '12:30', '16:00', '17:00', '18:00', '19:00'],
  viernes:   ['10:30', '11:30', '12:30', '16:00', '17:00', '18:00'],
};

export const DIAS_TPA: { id: DiaSemana; label: string; corto: string; offset: number }[] = [
  { id: 'lunes', label: 'Lunes', corto: 'Lun', offset: 0 },
  { id: 'miercoles', label: 'Miércoles', corto: 'Mié', offset: 2 },
  { id: 'viernes', label: 'Viernes', corto: 'Vie', offset: 4 },
];

export function inicioDeSemana(fecha: Date): Date {
  return startOfWeek(fecha, { weekStartsOn: 1 });
}

/** Día de TPA a mostrar al abrir en el celular: hoy si es L/M/V; si no, el próximo. */
export function diaTPAInicial(hoy: Date): { semana: Date; dia: DiaSemana } {
  if (isWeekend(hoy)) return { semana: inicioDeSemana(nextMonday(hoy)), dia: 'lunes' };
  const semana = inicioDeSemana(hoy);
  const indiceHoy = (hoy.getDay() + 6) % 7; // lunes = 0
  const dia = DIAS_TPA.find((d) => d.offset >= indiceHoy) ?? DIAS_TPA[0];
  return { semana, dia: dia.id };
}

// ---------------------------------------------------------------------
// Armado de la semana: única fuente para la grilla (compu) y la lista (celular)
// ---------------------------------------------------------------------

export interface DatosSemanaTPA {
  /** Todos los horarios (activos e inactivos): hace falta para semanas pasadas. */
  horarios: HorarioTPA[];
  clases: ClaseTPA[];
  asistencias: AsistenciaTPA[];
}

/**
 * ¿Era fijo de este horario en la fecha `fecha` ('yyyy-MM-dd')? Desde
 * `fecha_alta` (inclusive) hasta `fecha_baja` (exclusive; el día de la baja
 * ya no es fijo).
 */
export function eraFijoEn(horario: Pick<HorarioTPA, 'activo' | 'fecha_alta' | 'fecha_baja'>, fecha: string): boolean {
  if (horario.fecha_alta > fecha) return false;
  if (horario.activo) return true;
  return Boolean(horario.fecha_baja && horario.fecha_baja > fecha);
}

/**
 * Lugares de una clase (diseño 3.1): ocupan los fijos que NO avisaron
 * (incluye "Sin marcar" y "No avisó": el lugar estaba reservado) y todos los
 * que vienen a ocupar un lugar, en cualquier estado. Más personas que lugares
 * no se bloquea: se informa en `excedidos`. Una clase cancelada no tiene lugares.
 */
export function contarLugares(
  personas: { tipo: TipoAsistenciaTPA; estado: string }[],
  cupo: number,
  cancelada = false,
): LugaresTPA {
  if (cancelada) return { ocupados: 0, libres: 0, excedidos: 0, cancelada: true };
  const ocupados = personas.filter((p) => p.tipo !== 'fijo' || !esAviso(p.estado)).length;
  return {
    ocupados,
    libres: Math.max(0, cupo - ocupados),
    excedidos: Math.max(0, ocupados - cupo),
    cancelada: false,
  };
}

/** "3/4 · 1 libre", "4/4", "5/4 · 1 de más". null si la clase está cancelada. */
export function textoLugares(lugares: LugaresTPA, cupo: number): string | null {
  if (lugares.cancelada) return null;
  const base = `${lugares.ocupados}/${cupo}`;
  if (lugares.libres > 0) return `${base} · ${lugares.libres} ${lugares.libres === 1 ? 'libre' : 'libres'}`;
  if (lugares.excedidos > 0) return `${base} · ${lugares.excedidos} de más`;
  return base;
}

function compararAlumnos(a: AlumnoCeldaTPA, b: AlumnoCeldaTPA): number {
  if (a.esFijo !== b.esFijo) return a.esFijo ? -1 : 1; // fijos primero
  return a.nombre.localeCompare(b.nombre, 'es');
}

// Fijos por nombre, y quien ocupa el lugar de un fijo justo debajo de él.
// Quien ocupa un lugar libre va al final.
function ordenarPorLugar(alumnos: AlumnoCeldaTPA[]): AlumnoCeldaTPA[] {
  const ordenados = [...alumnos].sort(compararAlumnos);
  const idsEnLaClase = new Set(ordenados.map((a) => a.asistencia?.id).filter(Boolean));
  const enLugarDe = (a: AlumnoCeldaTPA) => a.asistencia?.ocupa_lugar_de ?? null;

  const resultado: AlumnoCeldaTPA[] = [];
  for (const alumno of ordenados) {
    const lugar = enLugarDe(alumno);
    if (lugar && idsEnLaClase.has(lugar)) continue; // va debajo de su fijo
    resultado.push(alumno);
    const idFila = alumno.asistencia?.id;
    if (idFila) resultado.push(...ordenados.filter((o) => enLugarDe(o) === idFila));
  }
  return resultado;
}

function armarCelda(dia: DiaSemana, fecha: string, hora: string, datos: DatosSemanaTPA): CeldaTPA {
  const mismoHorario = (h: HorarioTPA) => h.dia_semana === dia && normalizarHora(h.hora) === hora;
  const clase = datos.clases.find((c) => c.fecha === fecha && normalizarHora(c.hora) === hora) ?? null;
  const asistencias = clase ? datos.asistencias.filter((a) => a.clase_id === clase.id) : [];

  const alumnos = new Map<string, AlumnoCeldaTPA>();
  for (const h of datos.horarios.filter((h) => mismoHorario(h) && eraFijoEn(h, fecha))) {
    alumnos.set(h.paciente_id, {
      pacienteId: h.paciente_id,
      nombre: h.pacientes?.nombre ?? 'Sin nombre',
      estado: 'pendiente',
      asistencia: null,
      esFijo: true,
      tipo: 'fijo',
    });
  }
  for (const a of asistencias) {
    const previo = alumnos.get(a.paciente_id);
    alumnos.set(a.paciente_id, {
      pacienteId: a.paciente_id,
      nombre: previo?.nombre ?? a.pacientes?.nombre ?? 'Sin nombre',
      estado: a.estado,
      asistencia: a,
      esFijo: previo?.esFijo ?? false,
      tipo: a.tipo,
    });
  }
  const lista = ordenarPorLugar([...alumnos.values()]);

  return {
    clave: `${fecha}_${hora}`,
    dia,
    fecha,
    hora,
    enHorarioHabitual: HORARIOS_TPA[dia].includes(hora),
    clase,
    alumnos: lista,
    cupo: CUPO_TPA,
    lugares: contarLugares(lista, CUPO_TPA, Boolean(clase?.motivo_cancelacion)),
    fijosActuales: datos.horarios.filter((h) => mismoHorario(h) && h.activo),
  };
}

/**
 * Qué alumnos hay en cada horario de la semana y con qué estado.
 * Horarios de cada día = los habituales + cualquier otro que tenga fijos de
 * esa fecha o una clase registrada (para no esconder datos).
 */
export function armarSemanaTPA(inicioSemana: Date, datos: DatosSemanaTPA): SemanaTPA {
  const semana = {} as SemanaTPA;
  for (const { id: dia, offset } of DIAS_TPA) {
    const fecha = format(addDays(inicioSemana, offset), 'yyyy-MM-dd');
    const horas = new Set(HORARIOS_TPA[dia]);
    datos.horarios
      .filter((h) => h.dia_semana === dia && eraFijoEn(h, fecha))
      .forEach((h) => horas.add(normalizarHora(h.hora)));
    datos.clases
      .filter((c) => c.fecha === fecha)
      .forEach((c) => horas.add(normalizarHora(c.hora)));

    semana[dia] = [...horas].sort().map((hora) => armarCelda(dia, fecha, hora, datos));
  }
  return semana;
}
