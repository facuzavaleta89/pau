import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type {
  AsistenciaConClase, CeldaTPA, CreditoRecuperacion, HorarioTPA, OrigenRecuperacion, Paciente, SaldoRecuperaciones,
} from '@/types';
import { esAviso, esClaseFutura, sugerirAviso, type EstadoAviso } from './avisos';
import type { TipoOcupante } from './clase-tpa';
import { normalizarHora } from './horas';
import { ORDEN_ORIGENES } from './recuperaciones';
import { eraFijoEn } from './tpa';

// Selector "Ocupar lugar" (diseño 7.3) y "Buscar lugar" (7.4). Funciones puras.

export type GrupoOcupar = OrigenRecuperacion | 'adelantar' | 'cambio' | 'suelta';

/** Orden en que se muestran los grupos (prioridad de Pau). */
export const ORDEN_GRUPOS: GrupoOcupar[] = [...ORDEN_ORIGENES, 'adelantar', 'cambio', 'suelta'];

export const TITULOS_GRUPOS: Record<GrupoOcupar, string> = {
  cancelada_por_pau: 'Clases que cancelaste',
  aviso_con_tiempo: 'Avisaron con tiempo',
  aviso_sin_tiempo: 'Avisaron sin tiempo',
  feriado: 'Por feriado (si hay lugar)',
  adelantar: 'Adelantar (les queda tope este mes)',
  cambio: 'Cambio de horario',
  suelta: 'Otro paciente (clase suelta)',
};

export interface OpcionOcupar {
  /** Único en la lista. */
  clave: string;
  grupo: GrupoOcupar;
  pacienteId: string;
  nombre: string;
  tipo: TipoOcupante;
  /** Por qué aparece: "cancelé el mié 7", "falta el vie 30/10 18:00". */
  motivo: string;
  /** "usó 1 de 2"; null si no aplica (clase suelta sin horarios). */
  saldo: string | null;
  /** Avisos que no bloquean: tope, otro mes. */
  avisos: string[];
  /** Solo en cambio de horario. */
  cambioDe?: {
    fecha: string;
    hora: string;
    /** Ya había avisado en el origen. */
    yaAviso: boolean;
    /** C.T./S.T. sugerido para el aviso del origen; null si esa clase ya empezó (elige Pau). */
    sugerencia: EstadoAviso | null;
  };
}

export interface DatosOcupar {
  /** Clase de destino. */
  celda: CeldaTPA;
  /** Quienes ya están en la clase (con las marcas sin guardar). */
  enLaClase: Set<string>;
  /** Saldos del mes de la clase (calcularRecuperaciones). */
  saldos: SaldoRecuperaciones[];
  pacientes: Pick<Paciente, 'id' | 'nombre'>[];
  horarios: HorarioTPA[];
  /** Clases de 6 días antes a 6 días después (para cambio de horario). */
  ventana: CeldaTPA[];
  /** Filas del historial (para saber qué avisos ya tienen un cambio). */
  historial: AsistenciaConClase[];
  ahora: Date;
}

const nombreMes = (fecha: string) => format(parseISO(fecha), 'MMMM', { locale: es });

/** "vie 30/10 18:00" */
export function claseCorta(fecha: string, hora: string): string {
  return `${format(parseISO(fecha), 'EEE d/M', { locale: es })} ${normalizarHora(hora)}`;
}

const usoTexto = (s: SaldoRecuperaciones) => `usó ${s.topeUsado} de ${s.frecuencia}`;

/**
 * Tope después de usar una recuperación más. Consume primero lo que vence
 * antes: un aviso (cuenta en el tope), un feriado (no cuenta) o una de Pau
 * (no cuenta); sin nada, es un adelanto (cuenta).
 */
function topeDespues(s: SaldoRecuperaciones): number {
  const vence = s.pendientes.find((c) => c.vence !== null);
  if (vence) return s.topeUsado + (vence.origen === 'feriado' ? 0 : 1);
  return s.topeUsado + (s.pendientes.length > 0 ? 0 : 1);
}

function avisoTope(s: SaldoRecuperaciones, tope: number, fecha: string): string[] {
  return tope > s.frecuencia ? [`Ya usó ${s.topeUsado} de ${s.frecuencia} recuperaciones de ${nombreMes(fecha)}.`] : [];
}

/** Opciones del selector, en orden de prioridad. Nadie aparece si ya está en la clase. */
export function opcionesParaOcupar(d: DatosOcupar): OpcionOcupar[] {
  const opciones: OpcionOcupar[] = [];
  const fuera = (pacienteId: string) => !d.enLaClase.has(pacienteId);
  const conPendientes = new Set<string>();

  // 1–4. Pendientes, en el grupo de su recuperación de más prioridad. Quien no avisó no tiene.
  for (const s of d.saldos.filter((x) => x.pendientes.length > 0 && fuera(x.pacienteId))) {
    conPendientes.add(s.pacienteId);
    const primera: CreditoRecuperacion = s.pendientes[0];
    const otras = s.pendientes.length - 1;
    opciones.push({
      clave: `pendiente_${s.pacienteId}`,
      grupo: primera.origen,
      pacienteId: s.pacienteId,
      nombre: s.nombre,
      tipo: 'recupera',
      motivo: otras > 0 ? `${primera.texto} (y ${otras} más)` : primera.texto,
      saldo: usoTexto(s),
      avisos: avisoTope(s, topeDespues(s), d.celda.fecha),
    });
  }

  // 5. Adelantar: fijos (hoy, de cualquier horario) sin pendientes y con tope libre este mes.
  const saldoDe = new Map(d.saldos.map((s) => [s.pacienteId, s]));
  for (const s of d.saldos) {
    if (conPendientes.has(s.pacienteId) || !fuera(s.pacienteId) || s.frecuencia === 0) continue;
    if (!d.horarios.some((h) => h.paciente_id === s.pacienteId && eraFijoEn(h, d.celda.fecha))) continue;
    if (s.topeUsado >= s.frecuencia) continue;
    opciones.push({
      clave: `adelantar_${s.pacienteId}`,
      grupo: 'adelantar',
      pacienteId: s.pacienteId,
      nombre: s.nombre,
      tipo: 'recupera',
      motivo: `adelanta: le ${s.frecuencia - s.topeUsado === 1 ? 'queda 1' : `quedan ${s.frecuencia - s.topeUsado}`} este mes`,
      saldo: usoTexto(s),
      avisos: [],
    });
  }

  // 6. Cambio de horario: un fijo de otra clase cercana (±6 días) que todavía
  //    no vino ni tiene ya un cambio. Se marca el aviso en el origen y el cambio acá.
  const avisosConCambio = new Set(d.historial.map((a) => a.cambio_de).filter(Boolean));
  for (const origen of d.ventana) {
    if (origen.clave === d.celda.clave || origen.lugares.cancelada) continue;
    for (const a of origen.alumnos) {
      if (a.tipo !== 'fijo' || !a.esFijo || !fuera(a.pacienteId)) continue;
      if (a.estado !== 'pendiente' && !esAviso(a.estado)) continue; // ya vino o no avisó
      if (a.asistencia && avisosConCambio.has(a.asistencia.id)) continue;
      const s = saldoDe.get(a.pacienteId);
      const yaAviso = esAviso(a.estado);
      const avisos = s ? avisoTope(s, s.topeUsado + 1, d.celda.fecha) : [];
      if (origen.fecha.slice(0, 7) !== d.celda.fecha.slice(0, 7)) {
        avisos.push(`El aviso es de ${nombreMes(origen.fecha)}: cuenta en ${nombreMes(origen.fecha)}.`);
      }
      opciones.push({
        clave: `cambio_${a.pacienteId}_${origen.clave}`,
        grupo: 'cambio',
        pacienteId: a.pacienteId,
        nombre: a.nombre,
        tipo: 'cambio',
        motivo: `${yaAviso ? 'avisó que falta' : 'falta'} el ${claseCorta(origen.fecha, origen.hora)} y viene acá`,
        saldo: s ? usoTexto(s) : null,
        avisos,
        cambioDe: {
          fecha: origen.fecha,
          hora: origen.hora,
          yaAviso,
          sugerencia: yaAviso ? null : sugerirAviso(origen.fecha, origen.hora, d.ahora)?.estado ?? null,
        },
      });
    }
  }

  // 7. Cualquier paciente activo, como clase suelta (no usa recuperaciones).
  for (const p of d.pacientes) {
    if (!fuera(p.id)) continue;
    const s = saldoDe.get(p.id);
    opciones.push({
      clave: `suelta_${p.id}`,
      grupo: 'suelta',
      pacienteId: p.id,
      nombre: p.nombre,
      tipo: 'suelta',
      motivo: 'clase suelta: no usa recuperaciones',
      saldo: s && s.frecuencia > 0 ? usoTexto(s) : null,
      avisos: [],
    });
  }

  const orden = (o: OpcionOcupar) => ORDEN_GRUPOS.indexOf(o.grupo);
  return opciones.sort((a, b) => orden(a) - orden(b) || a.nombre.localeCompare(b.nombre, 'es') || a.clave.localeCompare(b.clave));
}

/** Filtra por nombre, sin acentos ni mayúsculas. */
export function filtrarOpciones(opciones: OpcionOcupar[], texto: string): OpcionOcupar[] {
  const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const buscado = normalizar(texto);
  return buscado ? opciones.filter((o) => normalizar(o.nombre).includes(buscado)) : opciones;
}

/**
 * "Buscar lugar" para una recuperación pendiente: clases que todavía no
 * empezaron, no canceladas, con lugar libre, donde no está, y dentro de su
 * vencimiento (las de Pau no vencen).
 */
export function lugaresParaRecuperar(
  celdas: CeldaTPA[], pacienteId: string, credito: Pick<CreditoRecuperacion, 'vence'>, ahora: Date,
): CeldaTPA[] {
  return celdas
    .filter((c) =>
      !c.lugares.cancelada
      && c.lugares.libres > 0
      && esClaseFutura(c.fecha, c.hora, ahora)
      && !c.alumnos.some((a) => a.pacienteId === pacienteId)
      && (credito.vence === null || c.fecha <= credito.vence))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora));
}
