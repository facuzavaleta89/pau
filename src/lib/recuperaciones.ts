import { addMonths, eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import type {
  AsistenciaConClase, ClaseTPA, CreditoRecuperacion, HorarioTPA, OrigenRecuperacion,
  SaldoRecuperaciones, SinDerechoRecuperacion, UsoRecuperacion,
} from '@/types';
import { esAviso } from './avisos';
import { normalizarHora } from './horas';
import { diaSemanaDeFecha, eraFijoEn } from './tpa';

// Saldo de recuperaciones de TPA: se CALCULA, no se guarda.
// Reglas de Pau (21/10/2026) y casos borde decididos por Facu (22/10/2026):
// docs/DISENO_ASISTENCIA_TPA.md, secciones 3.2 y 10.2.

/** Feriado: recupera solo si le quedan menos de 4 clases en el mes por cada vez por semana. */
export const CLASES_MINIMAS_POR_VEZ = 4;

/** Prioridad de Pau: a quién se le ofrece primero un lugar. */
export const ORDEN_ORIGENES: OrigenRecuperacion[] = [
  'cancelada_por_pau', 'aviso_con_tiempo', 'aviso_sin_tiempo', 'feriado',
];

export interface DatosRecuperaciones {
  /** Todos los horarios (activos e inactivos). */
  horarios: HorarioTPA[];
  /** Clases con motivo_cancelacion (de cualquier fecha). */
  clasesCanceladas: ClaseTPA[];
  /** Avisos, "No avisó" y filas de quienes ocupan un lugar, con su clase. Las demás se ignoran. */
  asistencias: AsistenciaConClase[];
}

// ---------------------------------------------------------------------
// Fechas y textos
// ---------------------------------------------------------------------

const mesDe = (fecha: string) => fecha.slice(0, 7); // 'yyyy-MM'

/** "lun 12" si es del mes que se mira; "mié 30/9" si es de otro. */
function fechaCorta(fecha: string, mes: string): string {
  const f = parseISO(fecha);
  const dia = `${format(f, 'EEE', { locale: es })} ${format(f, 'd')}`;
  return mesDe(fecha) === mes ? dia : `${dia}/${format(f, 'M')}`;
}

const VERBOS: Record<OrigenRecuperacion, string> = {
  cancelada_por_pau: 'cancelé el',
  aviso_con_tiempo: 'avisó con tiempo el',
  aviso_sin_tiempo: 'avisó sin tiempo el',
  feriado: 'feriado del',
};

/** "cancelé el mié 7", "avisó con tiempo el lun 12", "feriado del lun 12". */
export function textoOrigen(origen: OrigenRecuperacion, fecha: string, mes: string): string {
  return `${VERBOS[origen]} ${fechaCorta(fecha, mes)}`;
}

/** "31/10" */
export function fechaVence(vence: string): string {
  return format(parseISO(vence), 'd/M');
}

const ordenarPorFecha = <T extends { fecha: string; hora: string }>(a: T, b: T) =>
  a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora);

// ---------------------------------------------------------------------
// Un alumno en un mes
// ---------------------------------------------------------------------

interface Contexto {
  datos: DatosRecuperaciones;
  hoy: string;
  /** Filas por id, para encontrar el aviso de origen de un cambio de horario. */
  porId: Map<string, AsistenciaConClase>;
  porPaciente: Map<string, AsistenciaConClase[]>;
}

/** Horario de este alumno de ese día y hora en el que era fijo en esa fecha. */
function eraFijoDeLaClase(horarios: HorarioTPA[], fecha: string, hora: string): boolean {
  const dia = diaSemanaDeFecha(fecha);
  return horarios.some((h) => h.dia_semana === dia && normalizarHora(h.hora) === normalizarHora(hora) && eraFijoEn(h, fecha));
}

/**
 * Veces por semana = horarios fijos vigentes el último día del mes, o hoy si
 * el mes está en curso (el primer día si es futuro). Si ese día no tenía
 * ninguno (se dio de baja en el mes), el máximo que tuvo en el mes.
 */
function frecuencia(horarios: HorarioTPA[], dias: string[], hoy: string): number {
  const referencia = hoy < dias[0] ? dias[0] : hoy > dias[dias.length - 1] ? dias[dias.length - 1] : hoy;
  const vigentes = (fecha: string) => horarios.filter((h) => eraFijoEn(h, fecha)).length;
  return vigentes(referencia) || Math.max(0, ...dias.map(vigentes));
}

/** Mes de imputación de un uso: el de su clase, salvo un cambio cuyo aviso de origen es de otro mes. */
function mesDelUso(a: AsistenciaConClase, ctx: Contexto): { mes: string; deOtroMes: boolean } {
  const propio = mesDe(a.clases_tpa.fecha);
  const origen = a.tipo === 'cambio' && a.cambio_de ? ctx.porId.get(a.cambio_de) : undefined;
  if (!origen) return { mes: propio, deOtroMes: false };
  const mesOrigen = mesDe(origen.clases_tpa.fecha);
  return { mes: mesOrigen, deOtroMes: mesOrigen !== propio };
}

function credito(origen: OrigenRecuperacion, fecha: string, hora: string, mes: string, vence: string | null): CreditoRecuperacion {
  const h = normalizarHora(hora);
  return { id: `${origen}_${fecha}_${h}`, origen, fecha, hora: h, vence, texto: textoOrigen(origen, fecha, mes) };
}

function calcularMes(
  pacienteId: string, nombre: string, mes: string, arrastre: CreditoRecuperacion[], ctx: Contexto,
): SaldoRecuperaciones {
  const inicio = startOfMonth(parseISO(`${mes}-01`));
  const dias = eachDayOfInterval({ start: inicio, end: endOfMonth(inicio) }).map((d) => format(d, 'yyyy-MM-dd'));
  const ultimoDia = dias[dias.length - 1];
  const cerrado = ultimoDia < ctx.hoy;
  const enElMes = (fecha: string) => mesDe(fecha) === mes;

  const horarios = ctx.datos.horarios.filter((h) => h.paciente_id === pacienteId);
  const filas = ctx.porPaciente.get(pacienteId) ?? [];
  // Clase cancelada con filas cargadas: se ignoran (la cancelación genera su propia recuperación).
  const dadas = filas.filter((a) => !a.clases_tpa.motivo_cancelacion);
  const f = frecuencia(horarios, dias, ctx.hoy);
  const sinDerecho: SinDerechoRecuperacion[] = [];

  // 1. Por clase cancelada por Pau: una por cada clase en la que era fijo. No vence.
  const pau = [
    ...arrastre,
    ...ctx.datos.clasesCanceladas
      .filter((c) => c.motivo_cancelacion === 'cancelada_por_pau' && enElMes(c.fecha) && eraFijoDeLaClase(horarios, c.fecha, c.hora))
      .sort(ordenarPorFecha)
      .map((c) => credito('cancelada_por_pau', c.fecha, c.hora, mes, null)),
  ].map((c) => ({ ...c, texto: textoOrigen(c.origen, c.fecha, mes) }));

  // 2. Por aviso: primero C.T., después S.T., el más viejo primero. Derecho: las primeras f (tope).
  const avisos = dadas
    .filter((a) => a.tipo === 'fijo' && esAviso(a.estado) && enElMes(a.clases_tpa.fecha))
    .sort((a, b) => (a.estado === b.estado ? 0 : a.estado === 'aviso_con_tiempo' ? -1 : 1) || ordenarPorFecha(a.clases_tpa, b.clases_tpa));
  const creditoDeAviso = new Map<string, CreditoRecuperacion>(); // id de la fila → crédito
  avisos.forEach((a, i) => {
    const origen = a.estado as OrigenRecuperacion;
    if (i < f) {
      creditoDeAviso.set(a.id, credito(origen, a.clases_tpa.fecha, a.clases_tpa.hora, mes, ultimoDia));
    } else {
      sinDerecho.push({
        motivo: 'tope', fecha: a.clases_tpa.fecha, hora: normalizarHora(a.clases_tpa.hora),
        texto: `${textoOrigen(origen, a.clases_tpa.fecha, mes)}: ya tenía ${f} de ${f} este mes`,
      });
    }
  });
  const conTiempo = [...creditoDeAviso.values()].filter((c) => c.origen === 'aviso_con_tiempo');
  const sinTiempo = [...creditoDeAviso.values()].filter((c) => c.origen === 'aviso_sin_tiempo');

  // 3. Por feriado, en total: min(feriados, max(0, 4 × f − dadas)). Clases del mes =
  //    fechas en que era fijo de alguno de sus horarios (desde su fecha de alta).
  const clasesDelMes = dias.flatMap((fecha) =>
    horarios
      .filter((h) => h.dia_semana === diaSemanaDeFecha(fecha) && eraFijoEn(h, fecha))
      .map((h) => ({ fecha, hora: normalizarHora(h.hora) })),
  );
  const feriados = clasesDelMes.filter(({ fecha, hora }) =>
    ctx.datos.clasesCanceladas.some((c) => c.motivo_cancelacion === 'feriado' && c.fecha === fecha && normalizarHora(c.hora) === hora),
  );
  const cantidadFeriado = Math.min(feriados.length, Math.max(0, CLASES_MINIMAS_POR_VEZ * f - (clasesDelMes.length - feriados.length)));
  const porFeriado = feriados.slice(0, cantidadFeriado).map((c) => credito('feriado', c.fecha, c.hora, mes, ultimoDia));

  // "No avisó": no recupera (solo informativo).
  for (const a of dadas.filter((x) => x.tipo === 'fijo' && x.estado === 'falto_sin_avisar' && enElMes(x.clases_tpa.fecha))) {
    sinDerecho.push({
      motivo: 'no_aviso', fecha: a.clases_tpa.fecha, hora: normalizarHora(a.clases_tpa.hora),
      texto: `no avisó el ${fechaCorta(a.clases_tpa.fecha, mes)}`,
    });
  }

  // 4. Usos (recupera o cambio, en cualquier estado: anotado y no vino = usada). Cada
  //    uso consume primero lo que vence antes (C.T., S.T., feriado) y después lo de Pau.
  //    Un cambio de horario consume primero el aviso de su horario de origen.
  const usosDelMes = dadas
    .filter((a) => (a.tipo === 'recupera' || a.tipo === 'cambio') && mesDelUso(a, ctx).mes === mes)
    .sort((a, b) => ordenarPorFecha(a.clases_tpa, b.clases_tpa));
  const vencen = [...conTiempo, ...sinTiempo, ...porFeriado];
  const noVencen = [...pau];
  const tomar = (lista: CreditoRecuperacion[], c: CreditoRecuperacion | undefined) => {
    const i = c ? lista.indexOf(c) : -1;
    return i >= 0 ? lista.splice(i, 1)[0] : undefined;
  };
  const consumido = new Map<string, CreditoRecuperacion | null>();
  const conOrigen = usosDelMes.filter((a) => a.cambio_de && creditoDeAviso.has(a.cambio_de));
  for (const a of conOrigen) {
    const c = tomar(vencen, creditoDeAviso.get(a.cambio_de as string));
    if (c) consumido.set(a.id, c);
  }
  for (const a of usosDelMes.filter((x) => !consumido.has(x.id))) {
    consumido.set(a.id, vencen.shift() ?? noVencen.shift() ?? null);
  }
  const usos: UsoRecuperacion[] = usosDelMes.map((a) => ({
    asistenciaId: a.id,
    tipo: a.tipo as 'recupera' | 'cambio',
    fecha: a.clases_tpa.fecha,
    hora: normalizarHora(a.clases_tpa.hora),
    estado: a.estado,
    credito: consumido.get(a.id) ?? null,
    deOtroMes: mesDelUso(a, ctx).deOtroMes,
    texto: `${a.tipo === 'cambio' ? 'cambio de horario' : 'recupera'} el ${fechaCorta(a.clases_tpa.fecha, mes)}`,
  }));
  const adelantos = usos.filter((u) => !u.credito);
  const topeUsado = usos.filter((u) => !u.credito || u.credito.origen === 'aviso_con_tiempo' || u.credito.origen === 'aviso_sin_tiempo').length;

  // 5. Al cerrar el mes: lo que vence se pierde; lo de Pau pasa al mes siguiente.
  if (cerrado) {
    for (const c of vencen) {
      sinDerecho.push({ motivo: 'vencio', fecha: c.fecha, hora: c.hora, texto: `${c.texto}: venció el ${fechaVence(ultimoDia)}` });
    }
  }
  const pendientes = [...noVencen, ...(cerrado ? [] : vencen)]
    .sort((a, b) => ORDEN_ORIGENES.indexOf(a.origen) - ORDEN_ORIGENES.indexOf(b.origen) || ordenarPorFecha(a, b));

  return {
    pacienteId,
    nombre,
    frecuencia: f,
    pendientes,
    usos,
    adelantos,
    topeUsado,
    sinDerecho: sinDerecho.sort(ordenarPorFecha),
    adelantoSinFalta: cerrado && adelantos.length > 0,
  };
}

// ---------------------------------------------------------------------
// Todos los alumnos
// ---------------------------------------------------------------------

/**
 * Saldo de recuperaciones de cada alumno en el mes `mes` ('yyyy-MM'), con
 * `hoy` = 'yyyy-MM-dd' (define qué meses ya cerraron). Las recuperaciones por
 * clases canceladas por Pau que no se usaron pasan de un mes al siguiente:
 * por eso se recorren los meses desde la primera cancelación de Pau.
 */
export function calcularRecuperaciones(mes: string, datos: DatosRecuperaciones, hoy: string): SaldoRecuperaciones[] {
  const porPaciente = new Map<string, AsistenciaConClase[]>();
  for (const a of datos.asistencias) porPaciente.set(a.paciente_id, [...(porPaciente.get(a.paciente_id) ?? []), a]);
  const ctx: Contexto = { datos, hoy, porId: new Map(datos.asistencias.map((a) => [a.id, a])), porPaciente };

  const nombres = new Map<string, string>();
  for (const h of datos.horarios) nombres.set(h.paciente_id, h.pacientes?.nombre ?? nombres.get(h.paciente_id) ?? 'Sin nombre');
  for (const a of datos.asistencias) if (!nombres.has(a.paciente_id)) nombres.set(a.paciente_id, a.pacientes?.nombre ?? 'Sin nombre');

  const primerMesPau = datos.clasesCanceladas
    .filter((c) => c.motivo_cancelacion === 'cancelada_por_pau')
    .map((c) => mesDe(c.fecha))
    .sort()[0];
  const meses: string[] = [];
  for (let m = primerMesPau && primerMesPau < mes ? primerMesPau : mes; m <= mes; m = format(addMonths(parseISO(`${m}-01`), 1), 'yyyy-MM')) {
    meses.push(m);
  }

  return [...nombres.entries()]
    .map(([pacienteId, nombre]) => {
      let arrastre: CreditoRecuperacion[] = [];
      let saldo: SaldoRecuperaciones | null = null;
      for (const m of meses) {
        saldo = calcularMes(pacienteId, nombre, m, arrastre, ctx);
        arrastre = saldo.pendientes.filter((c) => c.vence === null);
      }
      return saldo as SaldoRecuperaciones;
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** Créditos pendientes de todos, en orden de prioridad de Pau (para la pestaña y "Copiar lista"). */
export function pendientesPorOrigen(saldos: SaldoRecuperaciones[]): Record<OrigenRecuperacion, { saldo: SaldoRecuperaciones; credito: CreditoRecuperacion }[]> {
  const grupos = Object.fromEntries(ORDEN_ORIGENES.map((o) => [o, []])) as unknown as Record<
    OrigenRecuperacion, { saldo: SaldoRecuperaciones; credito: CreditoRecuperacion }[]
  >;
  for (const saldo of saldos) for (const c of saldo.pendientes) grupos[c.origen].push({ saldo, credito: c });
  for (const o of ORDEN_ORIGENES) grupos[o].sort((a, b) => ordenarPorFecha(a.credito, b.credito) || a.saldo.nombre.localeCompare(b.saldo.nombre, 'es'));
  return grupos;
}

export const TITULOS_ORIGENES: Record<OrigenRecuperacion, string> = {
  cancelada_por_pau: 'Clases que cancelé',
  aviso_con_tiempo: 'Avisaron con tiempo',
  aviso_sin_tiempo: 'Avisaron sin tiempo',
  feriado: 'Por feriado (si hay lugar)',
};

/** "Copiar lista": las pendientes del mes en texto para WhatsApp, en orden de prioridad. */
export function textoListaRecuperaciones(saldos: SaldoRecuperaciones[], mes: string): string {
  const titulo = `Recuperaciones pendientes · ${format(parseISO(`${mes}-01`), 'MMMM yyyy', { locale: es })}`;
  const grupos = pendientesPorOrigen(saldos);
  const bloques = ORDEN_ORIGENES.filter((o) => grupos[o].length > 0).map((o) => [
    `${TITULOS_ORIGENES[o]}:`,
    ...grupos[o].map(({ saldo, credito: c }) => `• ${saldo.nombre}: ${c.texto}${c.vence ? ` (vence el ${fechaVence(c.vence)})` : ''}`),
  ].join('\n'));
  return [titulo, ...(bloques.length ? bloques : ['No hay recuperaciones pendientes.'])].join('\n\n');
}
