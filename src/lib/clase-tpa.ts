import type {
  AsistenciaConClase, AsistenciaTPA, CeldaTPA, EstadoAsistenciaTPA, TipoAsistenciaTPA,
} from '@/types';
import { avisadoAtAlGuardar, esAviso, type EstadoAviso } from './avisos';
import { normalizarHora } from './horas';

// Lo que Pau cambia en el modal de una clase antes de tocar Guardar, y cómo
// se convierte en el pedido a guardar_clase_tpa. Funciones puras (con tests).

export type TipoOcupante = Exclude<TipoAsistenciaTPA, 'fijo'>;

export interface ClaseHora { fecha: string; hora: string }

export interface OrigenCambio extends ClaseHora {
  /** Aviso que queda en el horario de origen; null = ya había avisado (se deja como está). */
  aviso: EstadoAviso | null;
}

/** Alguien que se suma a la clase para ocupar un lugar (todavía sin guardar). */
export interface OcupanteNuevo {
  pacienteId: string;
  nombre: string;
  tipo: TipoOcupante;
  /** pacienteId del fijo cuyo lugar ocupa; null = lugar libre. */
  ocupaLugarDe: string | null;
  cambioDe: OrigenCambio | null;
}

export interface BorradorClase {
  /** Estado nuevo por paciente (de los que ya están o de los nuevos). */
  estados: Record<string, EstadoAsistenciaTPA>;
  nuevos: OcupanteNuevo[];
  /** Ocupantes guardados que salen de la clase. */
  quitar: string[];
  /** Ocupantes guardados que pasan a un lugar libre (su fijo deja de "avisó"). */
  liberar: string[];
  /** Cambios de horario en OTRA clase cuyo aviso de origen es de esta y se quitan. */
  quitarCambios: (ClaseHora & { pacienteId: string })[];
  /** Texto de la nota de evolución por paciente, como quedó en el modal ('' = sin nota). */
  notas: Record<string, string>;
}

export const BORRADOR_VACIO: BorradorClase = { estados: {}, nuevos: [], quitar: [], liberar: [], quitarCambios: [], notas: {} };

/** Una persona en el modal, con las marcas sin guardar aplicadas. */
export interface FilaClase {
  pacienteId: string;
  nombre: string;
  tipo: TipoAsistenciaTPA;
  /** Era fijo de este horario en esta fecha. */
  esFijo: boolean;
  estado: EstadoAsistenciaTPA;
  /** Estado en la base; null = recién agregado. */
  guardado: EstadoAsistenciaTPA | null;
  ocupaLugarDe: string | null;
  asistencia: AsistenciaTPA | null;
  sinGuardar: boolean;
}

/** Enlaces de cambio de horario de las filas de esta clase (salen del historial). */
export interface EnlacesCambio {
  /** pacienteId (cambio en esta clase) → horario de origen. */
  origenDe: Map<string, ClaseHora>;
  /** pacienteId (fijo que avisó en esta clase) → clase a la que se cambió. */
  destinoDe: Map<string, ClaseHora>;
}

export function enlacesCambio(celda: CeldaTPA, historial: AsistenciaConClase[]): EnlacesCambio {
  const porId = new Map(historial.map((a) => [a.id, a]));
  const origenDe = new Map<string, ClaseHora>();
  const destinoDe = new Map<string, ClaseHora>();
  for (const alumno of celda.alumnos) {
    const fila = alumno.asistencia;
    if (!fila) continue;
    const origen = fila.cambio_de ? porId.get(fila.cambio_de) : undefined;
    if (origen) origenDe.set(alumno.pacienteId, { fecha: origen.clases_tpa.fecha, hora: normalizarHora(origen.clases_tpa.hora) });
    const destino = historial.find((a) => a.cambio_de === fila.id);
    if (destino) destinoDe.set(alumno.pacienteId, { fecha: destino.clases_tpa.fecha, hora: normalizarHora(destino.clases_tpa.hora) });
  }
  return { origenDe, destinoDe };
}

// Fijos en el orden de la celda; debajo de cada uno, quien ocupa su lugar;
// al final, quienes ocupan un lugar libre.
function ordenarFilas(filas: FilaClase[]): FilaClase[] {
  const fijos = filas.filter((f) => f.tipo === 'fijo');
  const resultado: FilaClase[] = [];
  for (const f of fijos) {
    resultado.push(f, ...filas.filter((o) => o.tipo !== 'fijo' && o.ocupaLugarDe === f.pacienteId));
  }
  const ubicados = new Set(resultado.map((f) => f.pacienteId));
  return [...resultado, ...filas.filter((f) => !ubicados.has(f.pacienteId))];
}

export function filasDeLaClase(celda: CeldaTPA, b: BorradorClase): FilaClase[] {
  const pacienteDeFila = new Map(celda.alumnos.filter((a) => a.asistencia).map((a) => [a.asistencia?.id, a.pacienteId]));
  const existentes = celda.alumnos
    .filter((a) => !(a.tipo !== 'fijo' && b.quitar.includes(a.pacienteId)))
    .map((a): FilaClase => {
      const liberado = b.liberar.includes(a.pacienteId);
      const estado = b.estados[a.pacienteId] ?? a.estado;
      const lugar = a.asistencia?.ocupa_lugar_de;
      return {
        pacienteId: a.pacienteId,
        nombre: a.nombre,
        tipo: a.tipo,
        esFijo: a.esFijo,
        estado,
        guardado: a.estado,
        ocupaLugarDe: liberado || !lugar ? null : pacienteDeFila.get(lugar) ?? null,
        asistencia: a.asistencia,
        sinGuardar: estado !== a.estado || liberado,
      };
    });
  const nuevos = b.nuevos.map((n): FilaClase => ({
    pacienteId: n.pacienteId,
    nombre: n.nombre,
    tipo: n.tipo,
    esFijo: false,
    estado: b.estados[n.pacienteId] ?? 'pendiente',
    guardado: null,
    ocupaLugarDe: n.ocupaLugarDe,
    asistencia: null,
    sinGuardar: true,
  }));
  return ordenarFilas([...existentes, ...nuevos]);
}

/**
 * "Marcar el resto como presente" (diseño 7.2): a todos los que siguen en
 * "Sin marcar" (fijos y quienes ocupan un lugar), Presente. No toca avisos ni
 * "No avisó". Devuelve solo los estados que cambian.
 */
export function marcarRestoPresente(filas: FilaClase[]): Record<string, EstadoAsistenciaTPA> {
  return Object.fromEntries(filas.filter((f) => f.estado === 'pendiente').map((f) => [f.pacienteId, 'presente' as const]));
}

// ---------------------------------------------------------------------
// Notas de evolución de la clase
// ---------------------------------------------------------------------

/** Nota guardada de ese paciente en esta clase ('' si no tiene). */
export function notaGuardada(celda: CeldaTPA, pacienteId: string): string {
  return celda.notas.find((n) => n.paciente_id === pacienteId)?.texto ?? '';
}

/** Nota como se ve en el modal (con lo que se escribió sin guardar). */
export function notaDe(celda: CeldaTPA, b: BorradorClase, pacienteId: string): string {
  return b.notas[pacienteId] ?? notaGuardada(celda, pacienteId);
}

export function notaSinGuardar(celda: CeldaTPA, b: BorradorClase, pacienteId: string): boolean {
  return pacienteId in b.notas && b.notas[pacienteId].trim() !== notaGuardada(celda, pacienteId).trim();
}

/** Notas de esta clase de personas que ya no están en ella (por ejemplo, quitadas): se siguen viendo. */
export function notasSinFila(celda: CeldaTPA, filas: FilaClase[]): { pacienteId: string; nombre: string }[] {
  const enLaClase = new Set(filas.map((f) => f.pacienteId));
  return celda.notas
    .filter((n) => !enLaClase.has(n.paciente_id))
    .map((n) => ({ pacienteId: n.paciente_id, nombre: n.pacientes?.nombre ?? 'Sin nombre' }));
}

/** Quien ocupa el lugar de ese fijo (con las marcas sin guardar). */
export function ocupanteDe(filas: FilaClase[], fijoId: string): FilaClase | undefined {
  return filas.find((f) => f.tipo !== 'fijo' && f.ocupaLugarDe === fijoId);
}

/**
 * Lugar que toma alguien que se suma: el de un fijo que avisó y que nadie
 * ocupa (el primero); si no hay, un lugar libre (null).
 */
export function lugarParaOcupar(filas: FilaClase[]): string | null {
  return filas.find((f) => f.tipo === 'fijo' && esAviso(f.estado) && !ocupanteDe(filas, f.pacienteId))?.pacienteId ?? null;
}

// ---------------------------------------------------------------------
// Pedido a guardar_clase_tpa
// ---------------------------------------------------------------------

export interface CambioAsistencia {
  paciente_id: string;
  tipo: TipoAsistenciaTPA;
  /** null = sin marcar (fijo) o quitar de la clase (quien ocupa). */
  estado: EstadoAsistenciaTPA | null;
  avisado_at?: string | null;
  /** Si no está, se conserva lo que había; null = lugar libre. */
  ocupa_lugar_de_paciente?: string | null;
  /** Si no está, se conserva lo que había. */
  cambio_de?: ClaseHora | null;
}

export interface NotaAGuardar {
  paciente_id: string;
  /** null = borrar la nota de ese paciente en esta clase. */
  texto: string | null;
}

export interface ClaseAGuardar extends ClaseHora {
  cambios: CambioAsistencia[];
  /** Solo si cambió alguna nota (sin la clave, la base no toca las notas). */
  notas?: NotaAGuardar[];
}

/**
 * Cambios a guardar (vacío = nada que guardar). La clase de esta celda va
 * primero; después, las otras clases que toca (origen de un cambio de
 * horario). guardar_clase_tpa ordena las operaciones, así que acá no importa.
 */
export function cambiosParaGuardar(celda: CeldaTPA, b: BorradorClase, ahora: Date): ClaseAGuardar[] {
  const cambios: CambioAsistencia[] = [];
  const otras = new Map<string, ClaseAGuardar>();
  const enOtra = (c: ClaseHora, cambio: CambioAsistencia) => {
    const clave = `${c.fecha}_${c.hora}`;
    const clase = otras.get(clave) ?? { fecha: c.fecha, hora: c.hora, cambios: [] };
    clase.cambios.push(cambio);
    otras.set(clave, clase);
  };

  for (const a of celda.alumnos) {
    if (a.tipo !== 'fijo' && b.quitar.includes(a.pacienteId)) {
      cambios.push({ paciente_id: a.pacienteId, tipo: a.tipo, estado: null });
      continue;
    }
    const estado = b.estados[a.pacienteId] ?? a.estado;
    if (a.tipo === 'fijo') {
      if (estado === a.estado) continue;
      cambios.push({
        paciente_id: a.pacienteId,
        tipo: 'fijo',
        estado: estado === 'pendiente' ? null : estado,
        avisado_at: avisadoAtAlGuardar(a.asistencia, estado, ahora),
      });
    } else {
      const liberado = b.liberar.includes(a.pacienteId);
      if (estado === a.estado && !liberado) continue;
      cambios.push({ paciente_id: a.pacienteId, tipo: a.tipo, estado, ...(liberado ? { ocupa_lugar_de_paciente: null } : {}) });
    }
  }

  for (const n of b.nuevos) {
    cambios.push({
      paciente_id: n.pacienteId,
      tipo: n.tipo,
      estado: b.estados[n.pacienteId] ?? 'pendiente',
      ocupa_lugar_de_paciente: n.ocupaLugarDe,
      cambio_de: n.cambioDe ? { fecha: n.cambioDe.fecha, hora: n.cambioDe.hora } : null,
    });
    if (n.cambioDe?.aviso) {
      enOtra(n.cambioDe, {
        paciente_id: n.pacienteId, tipo: 'fijo', estado: n.cambioDe.aviso, avisado_at: ahora.toISOString(),
      });
    }
  }

  for (const q of b.quitarCambios) enOtra(q, { paciente_id: q.pacienteId, tipo: 'cambio', estado: null });

  const notas: NotaAGuardar[] = Object.keys(b.notas)
    .filter((pacienteId) => notaSinGuardar(celda, b, pacienteId))
    .map((pacienteId) => ({ paciente_id: pacienteId, texto: b.notas[pacienteId].trim() || null }));

  const propia: ClaseAGuardar[] = cambios.length > 0 || notas.length > 0
    ? [{ fecha: celda.fecha, hora: celda.hora, cambios, ...(notas.length > 0 ? { notas } : {}) }]
    : [];
  return [...propia, ...otras.values()];
}
