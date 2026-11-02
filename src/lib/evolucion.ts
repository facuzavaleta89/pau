import type { AsistenciaConClase, NotaEvolucion, SesionRPG } from '@/types';
import { normalizarHora } from './horas';

// Línea de tiempo de la pestaña "Evolución" de la historia clínica (diseño
// 7.5): clases de TPA (asistencia + nota de esa clase, juntas), notas libres y
// sesiones de RPG (con su nota, que sigue en sesiones_rpg.nota). Función pura.

export type ItemEvolucion =
  | {
      tipo: 'tpa';
      clave: string;
      fecha: string;
      hora: string;
      /** null = la clase tiene nota pero no asistencia (por ejemplo, quedó en "Sin marcar"). */
      asistencia: AsistenciaConClase | null;
      nota: NotaEvolucion | null;
    }
  | { tipo: 'nota_libre'; clave: string; fecha: string; hora: null; nota: NotaEvolucion }
  | { tipo: 'rpg'; clave: string; fecha: string; hora: string; sesion: SesionRPG };

interface DatosEvolucion {
  asistencias: AsistenciaConClase[];
  notas: NotaEvolucion[];
  sesiones: SesionRPG[];
}

// Lo más nuevo arriba. En un mismo día, las notas libres primero (no tienen
// hora) y después por hora, de la más tarde a la más temprana.
function comparar(a: ItemEvolucion, b: ItemEvolucion): number {
  if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha);
  const horaA = a.hora ?? '99:99';
  const horaB = b.hora ?? '99:99';
  if (horaA !== horaB) return horaB.localeCompare(horaA);
  if (a.tipo === 'nota_libre' && b.tipo === 'nota_libre') return b.nota.created_at.localeCompare(a.nota.created_at);
  return a.clave.localeCompare(b.clave);
}

export function lineaDeTiempo({ asistencias, notas, sesiones }: DatosEvolucion): ItemEvolucion[] {
  const clases = new Map<string, Extract<ItemEvolucion, { tipo: 'tpa' }>>();
  for (const a of asistencias) {
    clases.set(a.clase_id, {
      tipo: 'tpa', clave: `tpa_${a.clase_id}`, fecha: a.clases_tpa.fecha, hora: normalizarHora(a.clases_tpa.hora),
      asistencia: a, nota: null,
    });
  }

  const libres: ItemEvolucion[] = [];
  for (const n of notas) {
    const clase = n.clase_tpa_id ? clases.get(n.clase_tpa_id) : undefined;
    if (clase) {
      clase.nota = n;
    } else if (n.clase_tpa_id && n.clases_tpa) {
      clases.set(n.clase_tpa_id, {
        tipo: 'tpa', clave: `tpa_${n.clase_tpa_id}`, fecha: n.clases_tpa.fecha, hora: normalizarHora(n.clases_tpa.hora),
        asistencia: null, nota: n,
      });
    } else {
      libres.push({ tipo: 'nota_libre', clave: `nota_${n.id}`, fecha: n.fecha, hora: null, nota: n });
    }
  }

  const rpg: ItemEvolucion[] = sesiones.map((s) => ({
    tipo: 'rpg', clave: `rpg_${s.id}`, fecha: s.fecha, hora: normalizarHora(s.hora), sesion: s,
  }));

  return [...clases.values(), ...libres, ...rpg].sort(comparar);
}
