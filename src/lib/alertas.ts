import type { ClaseTPA, EstadoAsistenciaTPA, TipoAsistenciaTPA } from '@/types';
import { esClaseFutura } from './avisos';
import { normalizarHora } from './horas';

// Alerta de 2 faltas seguidas sin avisar (diseño 3.3). Función pura.
// Criterios por defecto (Facu, 21/10/2026; Pau los puede cambiar):
// - cuentan sus asistencias como fijo, en CUALQUIERA de sus horarios;
// - las clases sin marcar (sin fila) no cortan la racha;
// - las clases canceladas no cuentan, y tampoco las que todavía no empezaron
//   (un aviso para la semana que viene no borra la alerta de hoy);
// - lo que hace como quien ocupa un lugar (recupera, cambio, suelta) no cuenta;
// - el lugar no se libera solo (Pau dijo que no): solo se avisa.

export const FALTAS_PARA_ALERTA = 2;

/**
 * La grilla de TPA lee lo marcado de los últimos 120 días (no todo el
 * historial). Solo se perdería una racha cuyas dos faltas estén separadas por
 * más de 4 meses sin ninguna clase marcada. La historia clínica usa todo.
 */
export const DIAS_HACIA_ATRAS_ALERTA = 120;

export interface FilaAlerta {
  paciente_id: string;
  tipo: TipoAsistenciaTPA;
  estado: EstadoAsistenciaTPA;
  clases_tpa: Pick<ClaseTPA, 'fecha' | 'hora' | 'motivo_cancelacion'>;
}

export interface AlertaFaltas {
  /** Cuántas "No avisó" seguidas tiene al final (2 o más). */
  seguidas: number;
  /** Fechas de esas clases ('yyyy-MM-dd'), de la más vieja a la más nueva. */
  fechas: string[];
}

/** Alumnos con 2 o más faltas seguidas sin avisar, por pacienteId (solo los que tienen alerta). */
export function alertasDeFaltas(filas: FilaAlerta[], ahora: Date): Map<string, AlertaFaltas> {
  const porPaciente = new Map<string, FilaAlerta[]>();
  for (const f of filas) {
    if (f.tipo !== 'fijo' || f.clases_tpa.motivo_cancelacion) continue;
    if (esClaseFutura(f.clases_tpa.fecha, normalizarHora(f.clases_tpa.hora), ahora)) continue;
    porPaciente.set(f.paciente_id, [...(porPaciente.get(f.paciente_id) ?? []), f]);
  }

  const alertas = new Map<string, AlertaFaltas>();
  for (const [pacienteId, lista] of porPaciente) {
    lista.sort((a, b) =>
      a.clases_tpa.fecha.localeCompare(b.clases_tpa.fecha)
      || normalizarHora(a.clases_tpa.hora).localeCompare(normalizarHora(b.clases_tpa.hora)));
    const fechas: string[] = [];
    for (let i = lista.length - 1; i >= 0 && lista[i].estado === 'falto_sin_avisar'; i--) {
      fechas.unshift(lista[i].clases_tpa.fecha);
    }
    if (fechas.length >= FALTAS_PARA_ALERTA) alertas.set(pacienteId, { seguidas: fechas.length, fechas });
  }
  return alertas;
}

/**
 * Las filas de siempre con lo que se ve en el modal de una clase (marcas sin
 * guardar): reemplaza las filas de esa clase por `marcas`. Así la alerta
 * aparece apenas Pau marca la segunda "No avisó", antes de guardar.
 */
export function conMarcasDeLaClase(
  filas: FilaAlerta[],
  clase: Pick<ClaseTPA, 'fecha' | 'hora' | 'motivo_cancelacion'>,
  marcas: { pacienteId: string; tipo: TipoAsistenciaTPA; estado: EstadoAsistenciaTPA }[],
): FilaAlerta[] {
  const hora = normalizarHora(clase.hora);
  const deOtraClase = filas.filter((f) => !(f.clases_tpa.fecha === clase.fecha && normalizarHora(f.clases_tpa.hora) === hora));
  const marcadas = marcas
    .filter((m) => m.estado !== 'pendiente' || m.tipo !== 'fijo') // fijo "Sin marcar" = sin fila
    .map((m): FilaAlerta => ({ paciente_id: m.pacienteId, tipo: m.tipo, estado: m.estado, clases_tpa: { ...clase, hora } }));
  return [...deOtraClase, ...marcadas];
}

/** "2 faltas seguidas sin avisar" / "3 faltas seguidas sin avisar". */
export function textoAlertaFaltas(alerta: AlertaFaltas): string {
  return `${alerta.seguidas} faltas seguidas sin avisar`;
}
