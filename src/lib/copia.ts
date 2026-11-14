// Copia de seguridad: todas las tablas en un archivo JSON que se descarga en
// la compu de Pau. Tiene datos de salud: nunca a la consola ni al repo.
// Cómo se restaura: supabase/scripts/restaurar_copia.sql (psql).

/** Tablas en el orden en que se restauran (primero las que no dependen de otras). */
export const TABLAS_COPIA = [
  { tabla: 'pacientes', orden: 'id' },
  { tabla: 'precios_mes', orden: 'mes' },
  { tabla: 'horarios_tpa', orden: 'id' },
  { tabla: 'clases_tpa', orden: 'id' },
  { tabla: 'asistencia_tpa', orden: 'id' },
  { tabla: 'notas_evolucion', orden: 'id' },
  { tabla: 'sesiones_rpg', orden: 'id' },
  { tabla: 'pagos_tpa', orden: 'id' },
  { tabla: 'lista_espera', orden: 'id' },
] as const;

export type TablaCopia = (typeof TABLAS_COPIA)[number]['tabla'];

/** Pasada una semana sin copia, se avisa. */
export const DIAS_AVISO_COPIA = 7;

export const CLAVE_ULTIMA_COPIA = 'pau.copia.ultima';

export interface ArchivoCopia {
  app: 'PAU Kinesio';
  formato: 1;
  /** ISO, en UTC. */
  creada: string;
  /** Filas por tabla, para ver de un vistazo que no falte nada. */
  filas: Record<TablaCopia, number>;
  tablas: Record<TablaCopia, unknown[]>;
}

export function armarCopia(tablas: Record<TablaCopia, unknown[]>, ahora: Date): ArchivoCopia {
  const filas = Object.fromEntries(TABLAS_COPIA.map(({ tabla }) => [tabla, tablas[tabla].length])) as Record<TablaCopia, number>;
  return { app: 'PAU Kinesio', formato: 1, creada: ahora.toISOString(), filas, tablas };
}

/** Fecha y hora de Argentina (UTC−3 todo el año) como 'yyyy-MM-dd' y 'HHmm'. */
function partesArgentina(fecha: Date): { dia: string; hora: string } {
  const iso = new Date(fecha.getTime() - 3 * 60 * 60 * 1000).toISOString();
  return { dia: iso.slice(0, 10), hora: iso.slice(11, 16).replace(':', '') };
}

/** "pau-kinesio-copia-2026-11-13-2130.json" (hora argentina). */
export function nombreArchivoCopia(ahora: Date): string {
  const { dia, hora } = partesArgentina(ahora);
  return `pau-kinesio-copia-${dia}-${hora}.json`;
}

export interface EstadoCopia {
  /** "Última copia en esta compu: 13/11/2026 (hoy)" / "… (hace 8 días)" / "Todavía no descargaste…". */
  texto: string;
  /** Nunca se hizo o pasó más de una semana: se muestra en ámbar. */
  avisar: boolean;
}

/** Qué decir sobre la última copia hecha en este navegador (ISO guardado, o null). */
export function estadoCopia(ultima: string | null, ahora: Date): EstadoCopia {
  const fecha = ultima ? new Date(ultima) : null;
  if (!fecha || Number.isNaN(fecha.getTime())) {
    return { texto: 'Todavía no descargaste ninguna copia en esta compu.', avisar: true };
  }
  const hoy = partesArgentina(ahora).dia;
  const dia = partesArgentina(fecha).dia;
  const dias = Math.round((Date.parse(hoy) - Date.parse(dia)) / (24 * 60 * 60 * 1000));
  const cuando = dias <= 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`;
  const [a, m, d] = dia.split('-');
  return {
    texto: `Última copia en esta compu: ${Number(d)}/${Number(m)}/${a} (${cuando})`,
    avisar: dias > DIAS_AVISO_COPIA,
  };
}
