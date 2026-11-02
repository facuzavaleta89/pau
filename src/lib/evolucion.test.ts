import { describe, expect, it } from 'vitest';
import type { AsistenciaConClase, NotaEvolucion, SesionRPG } from '@/types';
import { lineaDeTiempo } from './evolucion';

const asistencia = (claseId: string, fecha: string, hora: string, estado: AsistenciaConClase['estado'] = 'presente'): AsistenciaConClase => ({
  id: `a-${claseId}`, clase_id: claseId, paciente_id: 'Ana', estado, tipo: 'fijo', ocupa_lugar_de: null, avisado_at: null,
  cambio_de: null, created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-01T12:00:00Z',
  clases_tpa: { fecha, hora: `${hora}:00`, motivo_cancelacion: null },
});
const nota = (id: string, fecha: string, extra: Partial<NotaEvolucion> = {}): NotaEvolucion => ({
  id, paciente_id: 'Ana', fecha, texto: `texto ${id}`, clase_tpa_id: null,
  created_at: `${fecha}T15:00:00Z`, updated_at: `${fecha}T15:00:00Z`, clases_tpa: null, ...extra,
});
const sesion = (id: string, fecha: string, hora: string, notaRpg: string | null = null): SesionRPG => ({
  id, paciente_id: 'Ana', fecha, hora, tipo_sesion: 'RPG', estado_pago: 'pagado', estado_sesion: 'realizada',
  nota: notaRpg, created_at: '2026-10-01T12:00:00Z',
});

describe('lineaDeTiempo (pestaña Evolución)', () => {
  it('junta la asistencia y la nota de la misma clase; lo más nuevo arriba', () => {
    const items = lineaDeTiempo({
      asistencias: [asistencia('c1', '2026-10-19', '10:30'), asistencia('c2', '2026-10-21', '10:30', 'falto_sin_avisar')],
      notas: [nota('n1', '2026-10-19', { clase_tpa_id: 'c1', clases_tpa: { fecha: '2026-10-19', hora: '10:30:00' } })],
      sesiones: [sesion('s1', '2026-10-20', '09:00', 'contractura cervical')],
    });
    expect(items.map((i) => [i.tipo, i.fecha])).toEqual([['tpa', '2026-10-21'], ['rpg', '2026-10-20'], ['tpa', '2026-10-19']]);
    const lunes = items[2];
    expect(lunes.tipo === 'tpa' && lunes.nota?.id).toBe('n1');
    expect(lunes.tipo === 'tpa' && lunes.asistencia?.id).toBe('a-c1');
  });

  it('una nota de una clase sin asistencia (quedó en "Sin marcar") igual aparece, con su clase', () => {
    const [item] = lineaDeTiempo({
      asistencias: [],
      notas: [nota('n1', '2026-10-19', { clase_tpa_id: 'c1', clases_tpa: { fecha: '2026-10-19', hora: '10:30:00' } })],
      sesiones: [],
    });
    expect(item).toMatchObject({ tipo: 'tpa', fecha: '2026-10-19', hora: '10:30', asistencia: null, nota: { id: 'n1' } });
  });

  it('notas libres: arriba de las clases del mismo día, la más nueva primero', () => {
    const items = lineaDeTiempo({
      asistencias: [asistencia('c1', '2026-10-19', '18:00')],
      notas: [
        nota('vieja', '2026-10-19', { created_at: '2026-10-19T10:00:00Z' }),
        nota('nueva', '2026-10-19', { created_at: '2026-10-19T20:00:00Z' }),
      ],
      sesiones: [],
    });
    expect(items.map((i) => i.clave)).toEqual(['nota_nueva', 'nota_vieja', 'tpa_c1']);
  });

  it('una nota cuya clase se borró (clase_tpa_id null) queda como nota libre de su fecha', () => {
    const [item] = lineaDeTiempo({ asistencias: [], notas: [nota('n1', '2026-10-19')], sesiones: [] });
    expect(item).toMatchObject({ tipo: 'nota_libre', fecha: '2026-10-19', hora: null });
  });

  it('las sesiones de RPG aparecen todas, tengan o no nota; mismo día ordenado por hora', () => {
    const items = lineaDeTiempo({
      asistencias: [asistencia('c1', '2026-10-20', '10:30')],
      notas: [],
      sesiones: [sesion('s1', '2026-10-20', '09:00'), sesion('s2', '2026-10-20', '17:00', 'mejor')],
    });
    expect(items.map((i) => i.clave)).toEqual(['rpg_s2', 'tpa_c1', 'rpg_s1']);
  });
});
