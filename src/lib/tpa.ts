import { addDays, format, isWeekend, nextMonday, parseISO, startOfWeek } from 'date-fns';
import type {
  AlumnoCeldaTPA, AsistenciaTPA, CeldaTPA, ClaseTPA, DiaSemana, HorarioTPA, SemanaTPA,
} from '@/types';
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

/** ¿Era fijo de este horario en la fecha `fecha` ('yyyy-MM-dd')? */
function eraFijoEn(horario: HorarioTPA, fecha: string): boolean {
  const alta = format(parseISO(horario.created_at), 'yyyy-MM-dd'); // día local de la inscripción
  if (alta > fecha) return false;
  if (horario.activo) return true;
  return Boolean(horario.fecha_baja && horario.fecha_baja > fecha);
}

function compararAlumnos(a: AlumnoCeldaTPA, b: AlumnoCeldaTPA): number {
  if (a.esFijo !== b.esFijo) return a.esFijo ? -1 : 1; // fijos primero
  return a.nombre.localeCompare(b.nombre, 'es');
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
    });
  }
  for (const a of asistencias) {
    const previo = alumnos.get(a.paciente_id);
    alumnos.set(a.paciente_id, {
      pacienteId: a.paciente_id,
      nombre: previo?.nombre ?? a.pacientes?.nombre ?? 'Sin nombre',
      estado: a.estado ?? 'pendiente',
      asistencia: a,
      esFijo: previo?.esFijo ?? false,
    });
  }

  return {
    clave: `${fecha}_${hora}`,
    dia,
    fecha,
    hora,
    enHorarioHabitual: HORARIOS_TPA[dia].includes(hora),
    clase,
    alumnos: [...alumnos.values()].sort(compararAlumnos),
    cupo: CUPO_TPA,
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
