import { addMonths, format, parseISO, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AsistenciaTPA, ClaseTPA, DiaSemana, HorarioTPA, NotaEvolucion, PagoTPA } from '@/types';
import { esAviso } from './avisos';
import { normalizarHora } from './horas';
import { diaYMes, fijosDelMes, nombreMes, type Mes } from './pagos';
import { calcularRecuperaciones, type DatosRecuperaciones } from './recuperaciones';
import { DIAS_TPA, HORARIOS_TPA, diaSemanaDeFecha, eraFijoEn } from './tpa';
import { TIPOS_OCUPANTE } from './estados';

// Corregir horarios fijos de TPA cargados por error (Pau, 19/11/2026):
// - "Lo cargué por error": borrar el horario como si nunca hubiera existido,
//   solo si borrarlo no cambia nada ya registrado (motivosParaNoBorrar).
// - "Deshacer la baja": volver a activarlo, si el lugar sigue libre
//   (conflictoAlReactivar). Lo usa también "Reactivar" de un paciente dado de
//   baja, para sus horarios cerrados con la baja (horariosCerradosConLaBaja).
// - "Cambiar de horario" (Pau, 20/11/2026): cierra el horario con fecha de
//   baja = la fecha elegida y abre el nuevo con fecha de alta = esa fecha
//   (conflictoFechaCambio, destinosParaCambiar).
// La base vuelve a controlar lo mismo al guardar (migraciones 20261120000001
// y 20261120000002).

export interface DatosHorarios {
  /** Todos los horarios de esos días y horas, de todos los alumnos (activos e inactivos). */
  horarios: HorarioTPA[];
  /** Clases de esas horas (de cualquier día de la semana: se filtran acá). */
  clases: ClaseTPA[];
  /** Asistencias de esas clases, de todos. */
  asistencias: AsistenciaTPA[];
  /** Notas del alumno. */
  notas: NotaEvolucion[];
  /** Pagos del alumno (se miran solo las cuotas). */
  pagos: PagoTPA[];
  /** Solo de este alumno (todos sus horarios): para comparar su saldo con y sin el horario. */
  recuperaciones: DatosRecuperaciones;
}

/** "vie 14/11" */
export function diaCorto(fecha: string): string {
  return format(parseISO(fecha), 'EEE d/M', { locale: es });
}

/** "los viernes a las 12:30" */
export function textoHorario(h: Pick<HorarioTPA, 'dia_semana' | 'hora'>): string {
  const dia = DIAS_TPA.find((d) => d.id === h.dia_semana)?.label.toLowerCase() ?? h.dia_semana;
  return `los ${dia} a las ${normalizarHora(h.hora)}`;
}

const mismoHorario = (h: Pick<HorarioTPA, 'dia_semana' | 'hora'>, fecha: string, hora: string) =>
  diaSemanaDeFecha(fecha) === h.dia_semana && normalizarHora(hora) === normalizarHora(h.hora);

/** Clases de ese día y hora en las que era fijo (desde el alta, hasta la baja sin incluirla). */
export function clasesDelHorario(h: HorarioTPA, clases: ClaseTPA[]): ClaseTPA[] {
  return clases
    .filter((c) => mismoHorario(h, c.fecha, c.hora) && eraFijoEn(h, c.fecha))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** "vie 7/11 y vie 14/11"; con más de 3, "vie 7/11, vie 14/11, vie 21/11 y 2 más". */
function listaFechas(fechas: string[]): string {
  const unicas = [...new Set(fechas)].sort().map(diaCorto);
  if (unicas.length <= 3) return unicas.length === 1 ? unicas[0] : `${unicas.slice(0, -1).join(', ')} y ${unicas.at(-1)}`;
  return `${unicas.slice(0, 3).join(', ')} y ${unicas.length - 3} más`;
}

/** Meses ('yyyy-MM') desde `desde` hasta `hasta`, inclusive. */
function mesesEntre(desde: Mes, hasta: Mes): Mes[] {
  const meses: Mes[] = [];
  for (let m = desde; m <= hasta; m = format(addMonths(parseISO(`${m}-01`), 1), 'yyyy-MM')) meses.push(m);
  return meses;
}

/** Lo que importa de un saldo para saber si cambió (no el tope en sí, sino lo que produce). */
function firmaSaldo(datos: DatosRecuperaciones, pacienteId: string, mes: Mes, hoy: string): string {
  // Sin saldo (sin ningún horario ni fila) = nada que recuperar.
  const saldo = calcularRecuperaciones(mes, datos, hoy).find((s) => s.pacienteId === pacienteId);
  return JSON.stringify({
    pendientes: saldo?.pendientes.map((c) => c.id) ?? [],
    usos: saldo?.usos.map((u) => `${u.asistenciaId}:${u.credito?.id ?? ''}`) ?? [],
    sinDerecho: saldo?.sinDerecho.map((s) => `${s.motivo}_${s.fecha}_${s.hora}`) ?? [],
  });
}

/**
 * Por qué NO se puede borrar este horario ("Lo cargué por error"), en
 * palabras de Pau. Vacío = se puede: borrarlo no cambia nada ya registrado.
 * Se revisa, en las clases de ese día y hora en las que era fijo:
 * 1. sus asistencias (incluye avisos: de ellos dependen quien ocupó su lugar
 *    y sus recuperaciones; y las filas de fijo de ese horario de cualquier
 *    fecha desde el alta, como un aviso cargado después de la baja);
 * 2. sus notas de evolución;
 * 3. clases canceladas (le dan recuperaciones);
 * 4. cuotas cobradas que cuentan este horario (pagó más veces por semana de
 *    las que tendría sin él, o sin él no sería fijo ese mes);
 * 5. sus recuperaciones (el horario cambia el tope del mes): se compara el
 *    saldo con y sin el horario en cada mes en que fue fijo.
 */
export function motivosParaNoBorrar(horario: HorarioTPA, datos: DatosHorarios, hoy: string): string[] {
  const motivos: string[] = [];
  const clases = clasesDelHorario(horario, datos.clases);
  const idsVigencia = new Set(clases.map((c) => c.id));
  const claseDe = new Map(datos.clases.map((c) => [c.id, c]));

  const propias = datos.asistencias.filter((a) => {
    if (a.paciente_id !== horario.paciente_id) return false;
    if (idsVigencia.has(a.clase_id)) return true;
    const c = claseDe.get(a.clase_id);
    return Boolean(c && a.tipo === 'fijo' && mismoHorario(horario, c.fecha, c.hora) && c.fecha >= horario.fecha_alta);
  });
  if (propias.length > 0) {
    const fechas = propias.map((a) => claseDe.get(a.clase_id)?.fecha ?? '').filter(Boolean);
    motivos.push(`Ya tiene asistencia cargada en ese horario (${listaFechas(fechas)}).`);
  }

  const notas = datos.notas.filter((n) => n.paciente_id === horario.paciente_id && n.clase_tpa_id && idsVigencia.has(n.clase_tpa_id));
  if (notas.length > 0) {
    motivos.push(`Tiene notas de evolución de clases de ese horario (${listaFechas(notas.map((n) => n.fecha))}).`);
  }

  const canceladas = clases.filter((c) => c.motivo_cancelacion);
  if (canceladas.length > 0) {
    motivos.push(`Se cancelaron clases de ese horario mientras estaba (${listaFechas(canceladas.map((c) => c.fecha))}): le cuentan para recuperar.`);
  }

  const otros = datos.recuperaciones.horarios.filter((h) => h.paciente_id === horario.paciente_id && h.id !== horario.id);
  const cuotas = datos.pagos
    .filter((p) => p.paciente_id === horario.paciente_id && p.concepto === 'cuota')
    .filter((p) => {
      const mes = p.mes.slice(0, 7);
      if (fijosDelMes([horario], mes).length === 0) return false; // no tuvo clases ese mes
      const vecesSin = fijosDelMes(otros, mes)[0]?.vecesPorSemana ?? 0;
      return (p.veces_por_semana ?? 1) > vecesSin;
    });
  if (cuotas.length > 0) {
    const meses = [...new Set(cuotas.map((p) => nombreMes(p.mes.slice(0, 7), false)))].join(' y ');
    motivos.push(`La cuota de ${meses} ya está cobrada contando este horario.`);
  }

  // 5. Recuperaciones: solo si no hay otro motivo (ya no se puede) y solo los
  //    meses en que fue fijo, hasta el mes en curso.
  if (motivos.length === 0) {
    const ultimoDiaFijo = ultimoDiaAMirar(horario, hoy);
    if (ultimoDiaFijo && ultimoDiaFijo >= horario.fecha_alta) {
      const sin: DatosRecuperaciones = { ...datos.recuperaciones, horarios: otros };
      const con: DatosRecuperaciones = { ...datos.recuperaciones, horarios: [...otros, horario] };
      const cambian = mesesEntre(horario.fecha_alta.slice(0, 7), ultimoDiaFijo.slice(0, 7))
        .filter((m) => firmaSaldo(con, horario.paciente_id, m, hoy) !== firmaSaldo(sin, horario.paciente_id, m, hoy));
      if (cambian.length > 0) {
        motivos.push(`Cambiarían sus recuperaciones de ${cambian.map((m) => nombreMes(m, false)).join(' y ')}.`);
      }
    }
  }
  return motivos;
}

/** Último día a mirar: hoy, o el último día en que fue fijo si la baja fue antes. null si nunca fue fijo. */
function ultimoDiaAMirar(h: HorarioTPA, hoy: string): string | null {
  if (h.activo) return hoy;
  if (!h.fecha_baja) return null;
  const ultimo = format(subDays(parseISO(h.fecha_baja), 1), 'yyyy-MM-dd');
  return ultimo < hoy ? ultimo : hoy;
}

/** Lugares ocupados de una clase sin contar a `pacienteId` (como contarLugares, src/lib/tpa.ts). */
function ocupadosSin(clase: ClaseTPA, pacienteId: string, datos: DatosHorarios): number {
  const filas = datos.asistencias.filter((a) => a.clase_id === clase.id && a.paciente_id !== pacienteId);
  const conFila = new Set(filas.map((a) => a.paciente_id));
  const fijosSinFila = new Set(
    datos.horarios
      .filter((o) => o.paciente_id !== pacienteId && !conFila.has(o.paciente_id))
      .filter((o) => mismoHorario(o, clase.fecha, clase.hora) && eraFijoEn(o, clase.fecha))
      .map((o) => o.paciente_id),
  );
  return filas.filter((a) => a.tipo !== 'fijo' || !esAviso(a.estado)).length + fijosSinFila.size;
}

export interface OpcionesReactivar {
  cupo: number;
  hoy: string;
  /** El alumno está activo (o se reactiva en la misma operación). */
  pacienteActivo: boolean;
}

/**
 * Por qué NO se puede deshacer la baja de este horario (vuelve activo y sin
 * fecha de baja, como si la baja no hubiera existido); null = se puede.
 * - el alumno tiene que estar activo;
 * - no puede tener otro horario activo ese día y hora;
 * - el lugar tiene que seguir libre: menos fijos que el cupo desde hoy, y
 *   ninguna clase ya registrada desde la baja completa sin él (alguien ocupó
 *   su lugar) ni con él anotado de otra forma (recupera, suelta).
 */
export function conflictoAlReactivar(horario: HorarioTPA, datos: DatosHorarios, op: OpcionesReactivar): string | null {
  if (horario.activo) return 'Este horario ya está activo.';
  if (!horario.fecha_baja) return 'Se cerró antes de que la app guardara la fecha de baja: inscribilo de nuevo.';
  if (!op.pacienteActivo) return 'Primero hay que reactivar al paciente, desde su historia clínica.';

  const delHorario = datos.horarios.filter((o) => o.id !== horario.id && o.dia_semana === horario.dia_semana
    && normalizarHora(o.hora) === normalizarHora(horario.hora));
  if (delHorario.some((o) => o.paciente_id === horario.paciente_id && o.activo)) {
    return `Ya tiene otro horario activo ${textoHorario(horario)}.`;
  }
  const fijos = new Set(delHorario
    .filter((o) => o.paciente_id !== horario.paciente_id && (o.activo || (o.fecha_baja !== null && o.fecha_baja > op.hoy)))
    .map((o) => o.paciente_id));
  if (fijos.size >= op.cupo) return `El horario ya tiene los ${op.cupo} lugares ocupados por fijos.`;

  return conflictoEnClases(horario.paciente_id, horario, horario.fecha_baja, datos, op.cupo, 'alguien ocupó su lugar');
}

/**
 * Clases ya registradas (no canceladas) de ese día y hora desde `desde`: si
 * el alumno pasa a ser fijo ahí, no puede estar anotado de otra forma
 * (recupera, cambio, suelta) ni encontrar la clase completa sin él.
 */
function conflictoEnClases(
  pacienteId: string, h: Pick<HorarioTPA, 'dia_semana' | 'hora'>, desde: string, datos: DatosHorarios, cupo: number, porque: string,
): string | null {
  const clases = datos.clases
    .filter((c) => mismoHorario(h, c.fecha, c.hora) && c.fecha >= desde && !c.motivo_cancelacion)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  for (const c of clases) {
    const suya = datos.asistencias.find((a) => a.clase_id === c.id && a.paciente_id === pacienteId);
    if (suya && suya.tipo !== 'fijo') {
      return `Ya está anotado en la clase del ${diaCorto(c.fecha)} como ${TIPOS_OCUPANTE[suya.tipo].label}.`;
    }
    if (suya && esAviso(suya.estado)) continue; // avisó: no ocupa lugar
    const ocupados = ocupadosSin(c, pacienteId, datos);
    if (ocupados >= cupo) return `La clase del ${diaCorto(c.fecha)} ya está completa (${ocupados}/${cupo}): ${porque}.`;
  }
  return null;
}

// ---------------------------------------------------------------------
// Cambiar de horario
// ---------------------------------------------------------------------

export interface DestinoCambio {
  dia: DiaSemana;
  hora: string;
}

/**
 * Por qué NO se puede cambiar de horario desde `desde` ('yyyy-MM-dd'), sin
 * mirar el destino; null = la fecha sirve. El horario tiene que estar activo,
 * la fecha no puede ser anterior a su alta, y tiene que ser posterior a su
 * última asistencia ya cargada en este horario (desde esa fecha deja de ser
 * fijo acá: una asistencia de ese día o después quedaría fuera de su horario).
 */
export function conflictoFechaCambio(horario: HorarioTPA, desde: string, datos: DatosHorarios): string | null {
  if (!horario.activo) return 'Este horario ya no está activo.';
  if (!desde) return 'Elegí desde qué fecha.';
  if (desde < horario.fecha_alta) return `Es fijo desde el ${diaYMes(horario.fecha_alta)}: el cambio no puede ser antes.`;
  const claseDe = new Map(datos.clases.map((c) => [c.id, c]));
  const ultima = datos.asistencias
    .filter((a) => a.paciente_id === horario.paciente_id)
    .map((a) => claseDe.get(a.clase_id))
    .filter((c): c is ClaseTPA => Boolean(c && mismoHorario(horario, c.fecha, c.hora) && c.fecha >= horario.fecha_alta))
    .map((c) => c.fecha)
    .sort()
    .at(-1);
  if (ultima && ultima >= desde) {
    return `Ya tiene asistencia cargada el ${diaCorto(ultima)} en este horario: el cambio tiene que ser después de esa fecha.`;
  }
  return null;
}

/**
 * Por qué NO puede pasar a `destino` desde `desde`; null = tiene lugar. Las
 * mismas reglas que "Deshacer la baja" (conflictoAlReactivar): no puede tener
 * ya un horario ahí, tiene que haber menos fijos que el cupo desde esa fecha y
 * ninguna clase ya registrada desde esa fecha puede estar completa sin él ni
 * tenerlo anotado de otra forma.
 */
export function conflictoDestino(
  horario: HorarioTPA, destino: DestinoCambio, desde: string, datos: DatosHorarios, cupo: number,
): string | null {
  if (horario.dia_semana === destino.dia && normalizarHora(horario.hora) === normalizarHora(destino.hora)) return 'Es el mismo horario.';
  const vigenteDesde = (o: HorarioTPA) => o.activo || (o.fecha_baja !== null && o.fecha_baja > desde);
  const enDestino = datos.horarios.filter((o) => o.id !== horario.id && o.dia_semana === destino.dia
    && normalizarHora(o.hora) === normalizarHora(destino.hora) && vigenteDesde(o));
  if (enDestino.some((o) => o.paciente_id === horario.paciente_id)) {
    return `Ya tiene un horario ${textoHorario({ dia_semana: destino.dia, hora: destino.hora })}.`;
  }
  const fijos = new Set(enDestino.map((o) => o.paciente_id));
  if (fijos.size >= cupo) return `Ya tiene los ${cupo} lugares ocupados por fijos.`;
  return conflictoEnClases(horario.paciente_id, { dia_semana: destino.dia, hora: destino.hora }, desde, datos, cupo, 'no queda lugar');
}

export interface OpcionDestino extends DestinoCambio {
  conflicto: string | null;
}

/**
 * Horarios a los que se puede cambiar (menos el actual), por día y hora, cada
 * uno con su conflicto (null = tiene lugar): los habituales de Pau y los de
 * fuera de lo habitual que hoy tienen fijos (como en la grilla de TPA).
 */
export function destinosParaCambiar(horario: HorarioTPA, desde: string, datos: DatosHorarios, cupo: number): OpcionDestino[] {
  return DIAS_TPA.flatMap(({ id: dia }) => {
    const horas = new Set(HORARIOS_TPA[dia]);
    datos.horarios.filter((o) => o.activo && o.dia_semana === dia).forEach((o) => horas.add(normalizarHora(o.hora)));
    return [...horas].sort().map((hora) => ({ dia, hora }));
  })
    .filter((d) => !(d.dia === horario.dia_semana && d.hora === normalizarHora(horario.hora)))
    .map((d) => ({ ...d, conflicto: conflictoDestino(horario, d, desde, datos, cupo) }));
}

/**
 * Horarios que se cerraron con la baja del paciente (dar_de_baja_paciente los
 * cierra en la fecha de baja, o en su fecha de alta si era a futuro): los que
 * "Reactivar" ofrece recuperar.
 */
export function horariosCerradosConLaBaja(fechaBaja: string | null | undefined, horarios: HorarioTPA[]): HorarioTPA[] {
  if (!fechaBaja) return [];
  return horarios
    .filter((h) => !h.activo && h.fecha_baja === (h.fecha_alta > fechaBaja ? h.fecha_alta : fechaBaja))
    .sort((a, b) => (DIAS_TPA.findIndex((d) => d.id === a.dia_semana) - DIAS_TPA.findIndex((d) => d.id === b.dia_semana))
      || normalizarHora(a.hora).localeCompare(normalizarHora(b.hora)));
}

/** Bajas que se muestran en "Dados de baja" de un horario: desde el 1 del mes anterior. */
export function bajasRecientes(horarios: HorarioTPA[], hoy: string): HorarioTPA[] {
  const desde = format(addMonths(parseISO(`${hoy.slice(0, 7)}-01`), -1), 'yyyy-MM-dd');
  return horarios
    .filter((h) => !h.activo && h.fecha_baja && h.fecha_baja >= desde)
    .sort((a, b) => (b.fecha_baja as string).localeCompare(a.fecha_baja as string));
}
