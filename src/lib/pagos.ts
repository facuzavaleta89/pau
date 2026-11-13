import { addMonths, eachDayOfInterval, endOfMonth, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type {
  AsistenciaConClase, DiaSemana, HorarioTPA, MedioPago, PagoTPA, PreciosMes, SesionRPG,
} from '@/types';
import { CUPO_TPA, DIAS_TPA, HORARIOS_TPA, diaSemanaDeFecha, eraFijoEn } from './tpa';
import { normalizarHora } from './horas';

// Pagos (docs/DISENO_PAGOS.md, sección 3, y decisiones de Facu del 13/11/2026).
// Todo se calcula: "pendiente" = no hay pago guardado. Lo que se guarda es
// lo que ya se cobró (pagos_tpa, sesiones_rpg) y los precios de cada mes.

/** Mes como 'yyyy-MM'. */
export type Mes = string;

/** El plan tiene descuento si se paga hasta este día del mes (inclusive) o antes del mes. */
export const DIA_LIMITE_PLAN = 10;
/** La cuota cubre 4 clases por cada vez por semana. */
export const CLASES_POR_VEZ = 4;
export const MAX_VECES_POR_SEMANA = 3;

export const MEDIOS_PAGO: Record<MedioPago, string> = {
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
};
export const ORDEN_MEDIOS_PAGO: MedioPago[] = ['transferencia', 'efectivo'];

// ---------------------------------------------------------------------
// Fechas y formato
// ---------------------------------------------------------------------

export function primerDia(mes: Mes): string {
  return `${mes}-01`;
}

export function ultimoDia(mes: Mes): string {
  return format(endOfMonth(parseISO(primerDia(mes))), 'yyyy-MM-dd');
}

/** Mes anterior o siguiente con addMonths (setMonth saltea meses los días 29 a 31: bug N4). */
export function moverMes(mes: Mes, delta: number): Mes {
  return format(addMonths(parseISO(primerDia(mes)), delta), 'yyyy-MM');
}

/** "noviembre 2026" o "noviembre". */
export function nombreMes(mes: Mes, conAnio = true): string {
  return format(parseISO(primerDia(mes)), conAnio ? 'MMMM yyyy' : 'MMMM', { locale: es });
}

export function conMayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Fecha de hoy en Argentina (UTC−3 todo el año), aunque la compu esté en otra zona. */
export function hoyArgentina(ahora: Date): string {
  return new Date(ahora.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** "$50.000" (pesos enteros, punto de miles), igual en cualquier navegador. */
export function formatoPesos(importe: number): string {
  const signo = importe < 0 ? '-' : '';
  return `${signo}$${String(Math.abs(Math.round(importe))).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** "5/11" */
export function diaYMes(fecha: string): string {
  return `${Number(fecha.slice(8, 10))}/${Number(fecha.slice(5, 7))}`;
}

function fechasDelMes(mes: Mes): string[] {
  return eachDayOfInterval({ start: parseISO(primerDia(mes)), end: parseISO(ultimoDia(mes)) })
    .map((d) => format(d, 'yyyy-MM-dd'));
}

// ---------------------------------------------------------------------
// Precios
// ---------------------------------------------------------------------

export interface PreciosVigentes {
  precios: PreciosMes;
  /** Mes del que se toman ('yyyy-MM') si este mes no tiene precios cargados; null si son de este mes. */
  heredadoDe: Mes | null;
}

/** Los precios del mes o, si no hay, los del último mes anterior (con aviso). null si no hay ninguno anterior. */
export function preciosDelMes(lista: PreciosMes[], mes: Mes): PreciosVigentes | null {
  const inicio = primerDia(mes);
  const vigente = lista
    .filter((p) => p.mes.slice(0, 10) <= inicio)
    .sort((a, b) => b.mes.localeCompare(a.mes))[0];
  if (!vigente) return null;
  return { precios: vigente, heredadoDe: vigente.mes.slice(0, 10) === inicio ? null : vigente.mes.slice(0, 7) };
}

export function precioPlan(precios: PreciosMes, veces: number): number {
  if (veces <= 1) return precios.tpa_1_vez;
  if (veces === 2) return precios.tpa_2_veces;
  return precios.tpa_3_veces;
}

export function textoVeces(veces: number): string {
  return veces === 1 ? '1 vez por semana' : `${veces} veces por semana`;
}

// ---------------------------------------------------------------------
// Fijos del mes (quién debe la cuota y de cuántas veces por semana)
// ---------------------------------------------------------------------

export interface HorarioDelMes {
  horario: HorarioTPA;
  /** Fechas del mes en que le toca esta clase como fijo. */
  clases: string[];
  /** Fecha de alta si es posterior al 1 del mes. */
  desde: string | null;
  /** Fecha de baja si deja de ser fijo dentro del mes (ese día ya no es fijo). */
  baja: string | null;
}

export interface FijoDelMes {
  pacienteId: string;
  nombre: string;
  /** Horarios en los que fue fijo en alguna clase del mes, en orden (lun, mié, vie; hora). */
  horarios: HorarioDelMes[];
  /** Máximo de horarios vigentes a la vez en el mes, con tope 3. */
  vecesPorSemana: number;
  /** Tuvo más de 3 horarios a la vez (error de carga): se cobra el de 3 y se avisa. */
  horariosDeMas: boolean;
  /** Empieza dentro del mes (todas sus altas son posteriores al 1). */
  desde: string | null;
  /** Deja de ser fijo dentro del mes (todos sus horarios terminan antes de fin de mes). */
  baja: string | null;
  /** Clases que le tocan en el mes como fijo (para un alta a mitad de mes). */
  clases: number;
}

function ordenDia(dia: DiaSemana): number {
  return DIAS_TPA.find((d) => d.id === dia)?.offset ?? 9;
}

function horarioDelMes(horario: HorarioTPA, mes: Mes, fechas: string[]): HorarioDelMes {
  const inicio = primerDia(mes);
  const clases = fechas.filter((f) => diaSemanaDeFecha(f) === horario.dia_semana && eraFijoEn(horario, f));
  const baja = !horario.activo && horario.fecha_baja && horario.fecha_baja <= ultimoDia(mes) ? horario.fecha_baja : null;
  return { horario, clases, desde: horario.fecha_alta > inicio ? horario.fecha_alta : null, baja };
}

/** Por alumno: sus horarios fijos del mes, veces por semana y si entra o sale en el mes. */
export function fijosDelMes(horarios: HorarioTPA[], mes: Mes): FijoDelMes[] {
  const fechas = fechasDelMes(mes);
  const porAlumno = new Map<string, HorarioDelMes[]>();
  for (const h of horarios) {
    const delMes = horarioDelMes(h, mes, fechas);
    if (delMes.clases.length === 0) continue;
    porAlumno.set(h.paciente_id, [...(porAlumno.get(h.paciente_id) ?? []), delMes]);
  }

  return [...porAlumno.entries()].map(([pacienteId, lista]) => {
    lista.sort((a, b) => ordenDia(a.horario.dia_semana) - ordenDia(b.horario.dia_semana)
      || normalizarHora(a.horario.hora).localeCompare(normalizarHora(b.horario.hora)));
    const aLaVez = Math.max(...fechas.map((f) => lista.filter((h) => eraFijoEn(h.horario, f)).length));
    const desdes = lista.map((h) => h.desde);
    const bajas = lista.map((h) => h.baja);
    return {
      pacienteId,
      nombre: lista[0].horario.pacientes?.nombre ?? 'Sin nombre',
      horarios: lista,
      vecesPorSemana: Math.min(MAX_VECES_POR_SEMANA, Math.max(1, aLaVez)),
      horariosDeMas: aLaVez > MAX_VECES_POR_SEMANA,
      desde: desdes.every(Boolean) ? (desdes as string[]).sort()[0] : null,
      baja: bajas.every(Boolean) ? (bajas as string[]).sort().at(-1) ?? null : null,
      clases: lista.reduce((n, h) => n + h.clases.length, 0),
    };
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

const DIA_CORTO: Record<DiaSemana, string> = { lunes: 'lun', miercoles: 'mié', viernes: 'vie' };

/** "lun 10:30 · mié 10:30" */
export function textoHorarios(fijo: Pick<FijoDelMes, 'horarios'>): string {
  return fijo.horarios.map((h) => `${DIA_CORTO[h.horario.dia_semana]} ${normalizarHora(h.horario.hora)}`).join(' · ');
}

// ---------------------------------------------------------------------
// Cuotas de TPA
// ---------------------------------------------------------------------

export interface CuotaDelMes {
  pacienteId: string;
  nombre: string;
  /** null: pagó la cuota del mes pero ya no figura como fijo en el mes. */
  fijo: FijoDelMes | null;
  pago: PagoTPA | null;
  /** Plan: el pagado si pagó; si no, el de sus horarios. */
  veces: number;
  /** Lo que falta cobrar (precio del plan); 0 si pagó o si no hay precios. */
  importePendiente: number;
}

/** Una fila por fijo del mes (pagó o no) + quien pagó la cuota sin ser fijo del mes. */
export function cuotasDelMes(horarios: HorarioTPA[], pagos: PagoTPA[], mes: Mes, precios: PreciosMes | null): CuotaDelMes[] {
  const inicio = primerDia(mes);
  const pagosCuota = pagos.filter((p) => p.concepto === 'cuota' && p.mes.slice(0, 10) === inicio);
  const pagoDe = (pacienteId: string) => pagosCuota.find((p) => p.paciente_id === pacienteId) ?? null;
  const fijos = fijosDelMes(horarios, mes);

  const cuotas: CuotaDelMes[] = fijos.map((fijo) => {
    const pago = pagoDe(fijo.pacienteId);
    return {
      pacienteId: fijo.pacienteId,
      nombre: fijo.nombre,
      fijo,
      pago,
      veces: pago?.veces_por_semana ?? fijo.vecesPorSemana,
      importePendiente: pago || !precios ? 0 : precioPlan(precios, fijo.vecesPorSemana),
    };
  });
  for (const pago of pagosCuota.filter((p) => !fijos.some((f) => f.pacienteId === p.paciente_id))) {
    cuotas.push({
      pacienteId: pago.paciente_id,
      nombre: pago.pacientes?.nombre ?? 'Sin nombre',
      fijo: null,
      pago,
      veces: pago.veces_por_semana ?? 1,
      importePendiente: 0,
    });
  }
  return cuotas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** Pagar antes del mes o hasta el 10 inclusive: plan con descuento. */
export function esDelUnoAlDiez(pagadoEl: string, mes: Mes): boolean {
  return pagadoEl <= `${mes}-${String(DIA_LIMITE_PLAN).padStart(2, '0')}`;
}

export interface AvisoPorClase {
  motivo: 'despues_del_10' | 'alta';
  clases: number;
  importe: number;
  /** "Después del 10: por clase serían 4 × $18.000 = $72.000" */
  texto: string;
}

/**
 * El importe sugerido es SIEMPRE el plan (decisión de Facu, 13/11/2026). Este
 * aviso ofrece la alternativa por clase, que se aplica con un clic ("Usar"):
 * - Alta dentro del mes: las clases que le tocan desde su alta, solo si sale
 *   más barato que el plan (supuesto 3 del diseño). No se combina con el de
 *   después del 10: paga cuando empieza.
 * - Si no, pago después del 10: 4 × veces por semana × clase suelta.
 * Se recalcula al cambiar la fecha de pago o el plan.
 */
export function avisoPorClase(args: {
  veces: number;
  precios: PreciosMes;
  pagadoEl: string;
  mes: Mes;
  fijo: Pick<FijoDelMes, 'desde' | 'clases'> | null;
}): AvisoPorClase | null {
  const { veces, precios, pagadoEl, mes, fijo } = args;
  const suelta = precios.tpa_suelta;
  const texto = (inicio: string, clases: number) =>
    `${inicio}: por clase serían ${clases} × ${formatoPesos(suelta)} = ${formatoPesos(clases * suelta)}`;

  if (fijo?.desde) {
    const importe = fijo.clases * suelta;
    if (fijo.clases === 0 || importe >= precioPlan(precios, veces)) return null;
    return { motivo: 'alta', clases: fijo.clases, importe, texto: texto(`Empieza el ${diaYMes(fijo.desde)}`, fijo.clases) };
  }
  if (esDelUnoAlDiez(pagadoEl, mes)) return null;
  const clases = CLASES_POR_VEZ * veces;
  return { motivo: 'despues_del_10', clases, importe: clases * suelta, texto: texto('Después del 10', clases) };
}

// ---------------------------------------------------------------------
// Clases sueltas
// ---------------------------------------------------------------------

export type AsistenciaSuelta = Pick<AsistenciaConClase, 'paciente_id' | 'tipo' | 'estado' | 'pacientes' | 'clases_tpa'>;

export interface SueltasDelMes {
  pacienteId: string;
  nombre: string;
  /** Vino (Presente): son las que se cobran. */
  presentes: number;
  /** Clase ya pasada sin marcar: Pau tiene que marcarla. */
  sinMarcar: number;
  /** Anotada en una clase que todavía no pasó. */
  porVenir: number;
  /** "No vino": no se cobra. */
  noVino: number;
  /** Cada pago es una fila (decisión de Facu, 13/11/2026). */
  pagos: PagoTPA[];
  clasesPagadas: number;
  importePagado: number;
  /** Presentes todavía sin pagar. */
  pendientes: number;
  importePendiente: number;
}

/** Por persona: clases sueltas del mes (sin las canceladas) y lo que pagó de ellas. */
export function sueltasDelMes(
  asistencias: AsistenciaSuelta[], pagos: PagoTPA[], mes: Mes, precios: PreciosMes | null, hoy: string,
): SueltasDelMes[] {
  const inicio = primerDia(mes);
  const porPersona = new Map<string, SueltasDelMes>();
  const de = (pacienteId: string, nombre: string | undefined) => {
    let fila = porPersona.get(pacienteId);
    if (!fila) {
      fila = {
        pacienteId, nombre: nombre ?? 'Sin nombre', presentes: 0, sinMarcar: 0, porVenir: 0, noVino: 0,
        pagos: [], clasesPagadas: 0, importePagado: 0, pendientes: 0, importePendiente: 0,
      };
      porPersona.set(pacienteId, fila);
    }
    return fila;
  };

  for (const a of asistencias) {
    if (a.tipo !== 'suelta' || a.clases_tpa.motivo_cancelacion || a.clases_tpa.fecha.slice(0, 7) !== mes) continue;
    const fila = de(a.paciente_id, a.pacientes?.nombre);
    if (a.estado === 'presente') fila.presentes += 1;
    else if (a.estado === 'falto_sin_avisar') fila.noVino += 1;
    else if (a.clases_tpa.fecha > hoy) fila.porVenir += 1;
    else fila.sinMarcar += 1;
  }
  for (const p of pagos) {
    if (p.concepto !== 'sueltas' || p.mes.slice(0, 10) !== inicio) continue;
    const fila = de(p.paciente_id, p.pacientes?.nombre);
    fila.pagos.push(p);
    fila.clasesPagadas += p.clases ?? 0;
    fila.importePagado += p.importe;
  }
  for (const fila of porPersona.values()) {
    fila.pagos.sort((a, b) => a.pagado_el.localeCompare(b.pagado_el));
    fila.pendientes = Math.max(0, fila.presentes - fila.clasesPagadas);
    fila.importePendiente = precios ? fila.pendientes * precios.tpa_suelta : 0;
  }
  return [...porPersona.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** "vino 3 · pagó 1 · 1 no vino · 1 sin marcar" */
export function textoSueltas(s: SueltasDelMes): string {
  return [
    `vino ${s.presentes}`,
    s.clasesPagadas > 0 && `pagó ${s.clasesPagadas}`,
    s.noVino > 0 && `${s.noVino} no vino`,
    s.sinMarcar > 0 && `${s.sinMarcar} sin marcar`,
    s.porVenir > 0 && `${s.porVenir} por venir`,
  ].filter(Boolean).join(' · ');
}

// ---------------------------------------------------------------------
// RPG
// ---------------------------------------------------------------------

export interface SesionDelMes {
  sesion: SesionRPG;
  nombre: string;
  pagada: boolean;
  /** Lo cobrado (o el precio del mes si se marcó pagada sin importe) o lo que se cobraría. */
  importe: number;
  /** Pagada sin importe guardado: se cuenta con el precio de RPG del mes. */
  importeEstimado: boolean;
  /** Ya pasó (o es hoy) y no está pagada: cuenta en "falta cobrar". */
  aCobrar: boolean;
  /** Todavía no se hizo: no es deuda (supuesto del diseño, 2.4). */
  futura: boolean;
}

/** Sesiones del mes. Las canceladas no se cobran (salvo que figuren pagadas). */
export function sesionesRPGDelMes(sesiones: SesionRPG[], mes: Mes, precios: PreciosMes | null, hoy: string): SesionDelMes[] {
  const precio = precios?.rpg_sesion ?? 0;
  return sesiones
    .filter((s) => s.fecha.slice(0, 7) === mes)
    .filter((s) => s.estado_sesion !== 'cancelada' || s.estado_pago === 'pagado')
    .map((s) => {
      const pagada = s.estado_pago === 'pagado';
      const futura = s.fecha > hoy;
      const guardado = pagada ? s.importe ?? null : null;
      return {
        sesion: s,
        nombre: s.pacientes?.nombre ?? 'Sin nombre',
        pagada,
        importe: guardado ?? precio,
        importeEstimado: pagada && guardado === null,
        aCobrar: !pagada && !futura,
        futura,
      };
    })
    .sort((a, b) => a.sesion.fecha.localeCompare(b.sesion.fecha) || a.sesion.hora.localeCompare(b.sesion.hora));
}

// ---------------------------------------------------------------------
// Resumen del mes
// ---------------------------------------------------------------------

export interface TotalPlan {
  veces: number;
  alumnos: number;
  pagaron: number;
  cobrado: number;
  pendiente: number;
}

export interface ResumenMes {
  /** 1, 2 y 3 veces por semana. */
  planes: TotalPlan[];
  sueltas: { clases: number; cobrado: number; pendiente: number };
  rpg: { sesiones: number; cobrado: number; pendiente: number };
  cobrado: number;
  faltaCobrar: number;
  /** Cobrado + falta cobrar. */
  total: number;
  efectivo: number;
  transferencia: number;
  /** Sesiones de RPG marcadas pagadas sin medio (desde el turno, antes de esta versión). */
  sinMedio: number;
}

export function resumenDelMes(cuotas: CuotaDelMes[], sueltas: SueltasDelMes[], sesiones: SesionDelMes[]): ResumenMes {
  const medios = { efectivo: 0, transferencia: 0, sinMedio: 0 };
  const sumarMedio = (medio: MedioPago | null | undefined, importe: number) => {
    medios[medio ?? 'sinMedio'] += importe;
  };

  const planes = [1, 2, 3].map((veces) => {
    const delPlan = cuotas.filter((c) => Math.min(MAX_VECES_POR_SEMANA, c.veces) === veces);
    return {
      veces,
      alumnos: delPlan.length,
      pagaron: delPlan.filter((c) => c.pago).length,
      cobrado: delPlan.reduce((n, c) => n + (c.pago?.importe ?? 0), 0),
      pendiente: delPlan.reduce((n, c) => n + c.importePendiente, 0),
    };
  });
  cuotas.forEach((c) => c.pago && sumarMedio(c.pago.medio, c.pago.importe));
  sueltas.forEach((s) => s.pagos.forEach((p) => sumarMedio(p.medio, p.importe)));
  sesiones.filter((s) => s.pagada).forEach((s) => sumarMedio(s.sesion.medio_pago, s.importe));

  const sueltasTot = {
    clases: sueltas.reduce((n, s) => n + s.presentes, 0),
    cobrado: sueltas.reduce((n, s) => n + s.importePagado, 0),
    pendiente: sueltas.reduce((n, s) => n + s.importePendiente, 0),
  };
  const rpg = {
    sesiones: sesiones.length,
    cobrado: sesiones.filter((s) => s.pagada).reduce((n, s) => n + s.importe, 0),
    pendiente: sesiones.filter((s) => s.aCobrar).reduce((n, s) => n + s.importe, 0),
  };
  const cobrado = planes.reduce((n, p) => n + p.cobrado, 0) + sueltasTot.cobrado + rpg.cobrado;
  const faltaCobrar = planes.reduce((n, p) => n + p.pendiente, 0) + sueltasTot.pendiente + rpg.pendiente;
  return { planes, sueltas: sueltasTot, rpg, cobrado, faltaCobrar, total: cobrado + faltaCobrar, ...medios };
}

/** Texto para WhatsApp con lo que falta cobrar del mes. */
export function textoPendientes(mes: Mes, cuotas: CuotaDelMes[], sueltas: SueltasDelMes[], sesiones: SesionDelMes[]): string {
  const lineasCuotas = cuotas.filter((c) => !c.pago)
    .map((c) => `• ${c.nombre} (${textoVeces(c.veces)})${c.importePendiente ? `: ${formatoPesos(c.importePendiente)}` : ''}`);
  const lineasSueltas = sueltas.filter((s) => s.pendientes > 0)
    .map((s) => `• ${s.nombre}: ${s.pendientes} ${s.pendientes === 1 ? 'clase' : 'clases'}${s.importePendiente ? ` (${formatoPesos(s.importePendiente)})` : ''}`);
  const rpgPorPersona = new Map<string, SesionDelMes[]>();
  sesiones.filter((s) => s.aCobrar).forEach((s) => rpgPorPersona.set(s.nombre, [...(rpgPorPersona.get(s.nombre) ?? []), s]));
  const lineasRpg = [...rpgPorPersona.entries()].sort(([a], [b]) => a.localeCompare(b, 'es')).map(([nombre, lista]) => {
    const total = lista.reduce((n, s) => n + s.importe, 0);
    const fechas = lista.map((s) => diaYMes(s.sesion.fecha)).join(', ');
    return `• ${nombre}: ${lista.length} ${lista.length === 1 ? 'sesión' : 'sesiones'} (${fechas})${total ? `: ${formatoPesos(total)}` : ''}`;
  });

  const titulo = nombreMes(mes);
  if (lineasCuotas.length + lineasSueltas.length + lineasRpg.length === 0) return `No hay pagos pendientes en ${titulo}.`;
  const total = cuotas.reduce((n, c) => n + c.importePendiente, 0)
    + sueltas.reduce((n, s) => n + s.importePendiente, 0)
    + sesiones.filter((s) => s.aCobrar).reduce((n, s) => n + s.importe, 0);
  const bloques = [
    [`Pagos pendientes de ${titulo}`],
    lineasCuotas.length ? ['Cuotas TPA:', ...lineasCuotas] : [],
    lineasSueltas.length ? ['Clases sueltas TPA:', ...lineasSueltas] : [],
    lineasRpg.length ? ['RPG:', ...lineasRpg] : [],
    [`Total: ${formatoPesos(total)}`],
  ].filter((b) => b.length > 0);
  return bloques.map((b) => b.join('\n')).join('\n\n');
}

// ---------------------------------------------------------------------
// Todo el mes junto (lo usan /pagos y la pestaña Calendario)
// ---------------------------------------------------------------------

/** Lo que carga cargarPagosMes (queries.ts) para un mes. */
export interface DatosPagosMes {
  mes: Mes;
  precios: PreciosMes[];
  /** Todos los horarios (activos e inactivos): quién fue fijo en el mes. */
  horarios: HorarioTPA[];
  /** Pagos de TPA de este mes y de los 3 anteriores (para el medio sugerido). */
  pagos: PagoTPA[];
  /** Clases sueltas del mes, con su clase. */
  sueltas: AsistenciaSuelta[];
  /** Sesiones de RPG del mes. */
  sesiones: SesionRPG[];
}

export interface PagosDelMes {
  vigentes: PreciosVigentes | null;
  cuotas: CuotaDelMes[];
  sueltas: SueltasDelMes[];
  sesiones: SesionDelMes[];
  resumen: ResumenMes;
}

export function calcularPagosDelMes(datos: DatosPagosMes, hoy: string): PagosDelMes {
  const vigentes = preciosDelMes(datos.precios, datos.mes);
  const precios = vigentes?.precios ?? null;
  const cuotas = cuotasDelMes(datos.horarios, datos.pagos, datos.mes, precios);
  const sueltas = sueltasDelMes(datos.sueltas, datos.pagos, datos.mes, precios, hoy);
  const sesiones = sesionesRPGDelMes(datos.sesiones, datos.mes, precios, hoy);
  return { vigentes, cuotas, sueltas, sesiones, resumen: resumenDelMes(cuotas, sueltas, sesiones) };
}

/** Medio sugerido al cobrar: el de su último pago de TPA (supuesto del diseño); si no tiene, transferencia. */
export function medioSugerido(pagos: PagoTPA[], pacienteId: string): MedioPago {
  const ultimo = pagos
    .filter((p) => p.paciente_id === pacienteId)
    .sort((a, b) => b.pagado_el.localeCompare(a.pagado_el) || b.created_at.localeCompare(a.created_at))[0];
  return ultimo?.medio ?? 'transferencia';
}

// ---------------------------------------------------------------------
// Calendario general del mes (pestaña Calendario de TPA)
// ---------------------------------------------------------------------

export type LugarCalendario =
  | { tipo: 'fijo'; pacienteId: string; nombre: string; pagado: boolean; desde: string | null; baja: string | null }
  | { tipo: 'libre' };

export interface CeldaCalendario {
  dia: DiaSemana;
  hora: string;
  /** Fijos del mes (por nombre) y después los lugares libres hasta el cupo. */
  lugares: LugarCalendario[];
  /** Fijos de HOY en este día y hora (para "+ Inscribir fijo"). */
  fijosActuales: HorarioTPA[];
  cupo: number;
  enHorarioHabitual: boolean;
}

export interface FilaCalendario {
  hora: string;
  /** null = ese día no hay clase a esa hora (por ejemplo, viernes 19:00). */
  celdas: Record<DiaSemana, CeldaCalendario | null>;
}

/** Para cada horario × día: sus fijos del mes en verde (pagó) o rosa (no pagó) y los lugares libres. */
export function calendarioDelMes(horarios: HorarioTPA[], cuotas: CuotaDelMes[], mes: Mes): FilaCalendario[] {
  const fechas = fechasDelMes(mes);
  const pagado = new Set(cuotas.filter((c) => c.pago).map((c) => c.pacienteId));
  const delMes = horarios.map((h) => horarioDelMes(h, mes, fechas)).filter((h) => h.clases.length > 0);
  const horas = new Set(DIAS_TPA.flatMap((d) => HORARIOS_TPA[d.id]));
  delMes.forEach((h) => horas.add(normalizarHora(h.horario.hora)));

  return [...horas].sort().map((hora) => {
    const celdas = {} as Record<DiaSemana, CeldaCalendario | null>;
    for (const { id: dia } of DIAS_TPA) {
      const mismo = (h: HorarioTPA) => h.dia_semana === dia && normalizarHora(h.hora) === hora;
      const fijos = delMes.filter((h) => mismo(h.horario));
      const habitual = HORARIOS_TPA[dia].includes(hora);
      if (!habitual && fijos.length === 0) {
        celdas[dia] = null;
        continue;
      }
      const lugares: LugarCalendario[] = fijos
        .map((h): LugarCalendario => ({
          tipo: 'fijo',
          pacienteId: h.horario.paciente_id,
          nombre: h.horario.pacientes?.nombre ?? 'Sin nombre',
          pagado: pagado.has(h.horario.paciente_id),
          desde: h.desde,
          baja: h.baja,
        }))
        .sort((a, b) => (a.tipo === 'fijo' && b.tipo === 'fijo' ? a.nombre.localeCompare(b.nombre, 'es') : 0));
      for (let i = fijos.length; i < CUPO_TPA; i++) lugares.push({ tipo: 'libre' });
      celdas[dia] = {
        dia, hora, lugares, cupo: CUPO_TPA, enHorarioHabitual: habitual,
        fijosActuales: horarios.filter((h) => mismo(h) && h.activo),
      };
    }
    return { hora, celdas };
  }).filter((fila) => DIAS_TPA.some((d) => fila.celdas[d.id] !== null));
}
