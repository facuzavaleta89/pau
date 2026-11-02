import { describe, expect, it } from 'vitest';
import { parseISO } from 'date-fns';
import type { AsistenciaConClase, AsistenciaTPA, ClaseTPA, HorarioTPA, NotaEvolucion } from '@/types';
import { armarSemanaTPA } from './tpa';
import {
  BORRADOR_VACIO, cambiosParaGuardar, enlacesCambio, filasDeLaClase, lugarParaOcupar, marcarRestoPresente,
  notaDe, notaSinGuardar, notasSinFila, ocupanteDe, type BorradorClase,
} from './clase-tpa';

// Lunes 26/10/2026 10:30.
let n = 0;
const id = () => `id-${++n}`;
const AHORA = new Date('2026-10-23T12:00:00Z');

const fijo = (nombre: string): HorarioTPA => ({
  id: id(), paciente_id: nombre, dia_semana: 'lunes', hora: '10:30', activo: true, fecha_alta: '2026-01-01',
  fecha_baja: null, created_at: '2026-01-01T12:00:00Z', pacientes: { nombre },
});
const CLASE: ClaseTPA = { id: 'clase-1', fecha: '2026-10-26', hora: '10:30', motivo_cancelacion: null, created_at: '2026-10-01T12:00:00Z' };
const fila = (nombre: string, estado: AsistenciaTPA['estado'], extra: Partial<AsistenciaTPA> = {}): AsistenciaTPA => ({
  id: `fila-${nombre}`, clase_id: CLASE.id, paciente_id: nombre, estado, tipo: 'fijo', ocupa_lugar_de: null,
  avisado_at: estado.startsWith('aviso') ? '2026-10-20T12:00:00Z' : null, cambio_de: null,
  created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-01T12:00:00Z', pacientes: { nombre }, ...extra,
});

const nota = (nombre: string, texto: string): NotaEvolucion => ({
  id: `nota-${nombre}`, paciente_id: nombre, fecha: CLASE.fecha, texto, clase_tpa_id: CLASE.id,
  created_at: '2026-10-26T15:00:00Z', updated_at: '2026-10-26T15:00:00Z', pacientes: { nombre },
});

function celda(asistencias: AsistenciaTPA[] = [], fijos = ['Ana', 'Beto', 'Carla'], notas: NotaEvolucion[] = []) {
  const semana = armarSemanaTPA(parseISO('2026-10-26'), {
    horarios: fijos.map(fijo), clases: asistencias.length || notas.length ? [CLASE] : [], asistencias, notas,
  });
  const c = semana.lunes.find((x) => x.hora === '10:30');
  if (!c) throw new Error('sin celda');
  return c;
}
const borrador = (b: Partial<BorradorClase>): BorradorClase => ({ ...BORRADOR_VACIO, ...b });

describe('filasDeLaClase', () => {
  it('aplica los estados sin guardar y pone al nuevo debajo del fijo cuyo lugar ocupa', () => {
    const c = celda();
    const filas = filasDeLaClase(c, borrador({
      estados: { Beto: 'aviso_con_tiempo' },
      nuevos: [{ pacienteId: 'Zoe', nombre: 'Zoe', tipo: 'recupera', ocupaLugarDe: 'Beto', cambioDe: null }],
    }));
    expect(filas.map((f) => [f.nombre, f.estado, f.sinGuardar])).toEqual([
      ['Ana', 'pendiente', false],
      ['Beto', 'aviso_con_tiempo', true],
      ['Zoe', 'pendiente', true],
      ['Carla', 'pendiente', false],
    ]);
    expect(ocupanteDe(filas, 'Beto')?.nombre).toBe('Zoe');
  });

  it('traduce ocupa_lugar_de (id de fila) a paciente; "liberar" lo deja en un lugar libre; "quitar" lo saca', () => {
    const c = celda([fila('Beto', 'aviso_sin_tiempo'), fila('Zoe', 'pendiente', { tipo: 'recupera', ocupa_lugar_de: 'fila-Beto' })]);
    expect(ocupanteDe(filasDeLaClase(c, BORRADOR_VACIO), 'Beto')?.nombre).toBe('Zoe');
    const liberado = filasDeLaClase(c, borrador({ liberar: ['Zoe'] }));
    expect(liberado.find((f) => f.nombre === 'Zoe')).toMatchObject({ ocupaLugarDe: null, sinGuardar: true });
    expect(liberado.map((f) => f.nombre)).toEqual(['Ana', 'Beto', 'Carla', 'Zoe']);
    expect(filasDeLaClase(c, borrador({ quitar: ['Zoe'] })).map((f) => f.nombre)).toEqual(['Ana', 'Beto', 'Carla']);
  });
});

describe('lugarParaOcupar', () => {
  it('el lugar de un fijo que avisó y que nadie ocupa; si no hay, uno libre', () => {
    const c = celda([fila('Ana', 'aviso_con_tiempo'), fila('Beto', 'aviso_sin_tiempo'), fila('Zoe', 'pendiente', { tipo: 'recupera', ocupa_lugar_de: 'fila-Ana' })]);
    expect(lugarParaOcupar(filasDeLaClase(c, BORRADOR_VACIO))).toBe('Beto');
    expect(lugarParaOcupar(filasDeLaClase(celda(), BORRADOR_VACIO))).toBeNull();
  });
});

describe('cambiosParaGuardar', () => {
  it('sin cambios → nada', () => {
    expect(cambiosParaGuardar(celda(), BORRADOR_VACIO, AHORA)).toEqual([]);
  });

  it('aviso de un fijo + recupera en su lugar, en una sola clase', () => {
    const [clase, ...otras] = cambiosParaGuardar(celda(), borrador({
      estados: { Beto: 'aviso_con_tiempo' },
      nuevos: [{ pacienteId: 'Zoe', nombre: 'Zoe', tipo: 'recupera', ocupaLugarDe: 'Beto', cambioDe: null }],
    }), AHORA);
    expect(otras).toEqual([]);
    expect(clase).toEqual({
      fecha: '2026-10-26', hora: '10:30',
      cambios: [
        { paciente_id: 'Beto', tipo: 'fijo', estado: 'aviso_con_tiempo', avisado_at: '2026-10-23T12:00:00.000Z' },
        { paciente_id: 'Zoe', tipo: 'recupera', estado: 'pendiente', ocupa_lugar_de_paciente: 'Beto', cambio_de: null },
      ],
    });
  });

  it('fijo a "Sin marcar" = estado null; quien ocupa a "Sin marcar" sigue en la clase como pendiente', () => {
    const c = celda([fila('Ana', 'presente'), fila('Zoe', 'presente', { tipo: 'suelta' })]);
    const [clase] = cambiosParaGuardar(c, borrador({ estados: { Ana: 'pendiente', Zoe: 'pendiente' } }), AHORA);
    expect(clase.cambios).toEqual([
      { paciente_id: 'Ana', tipo: 'fijo', estado: null, avisado_at: null },
      { paciente_id: 'Zoe', tipo: 'suelta', estado: 'pendiente' },
    ]);
  });

  it('quitar de la clase y dejar en lugar libre', () => {
    const c = celda([
      fila('Ana', 'aviso_con_tiempo'), fila('Beto', 'aviso_con_tiempo'),
      fila('Zoe', 'pendiente', { tipo: 'recupera', ocupa_lugar_de: 'fila-Ana' }),
      fila('Yago', 'pendiente', { tipo: 'recupera', ocupa_lugar_de: 'fila-Beto' }),
    ]);
    const [clase] = cambiosParaGuardar(c, borrador({
      estados: { Ana: 'presente', Beto: 'presente' }, quitar: ['Zoe'], liberar: ['Yago'],
    }), AHORA);
    expect(clase.cambios).toEqual([
      { paciente_id: 'Ana', tipo: 'fijo', estado: 'presente', avisado_at: null },
      { paciente_id: 'Zoe', tipo: 'recupera', estado: null },
      { paciente_id: 'Beto', tipo: 'fijo', estado: 'presente', avisado_at: null },
      { paciente_id: 'Yago', tipo: 'recupera', estado: 'pendiente', ocupa_lugar_de_paciente: null },
    ]);
  });

  it('cambio de horario: el aviso del origen va en la otra clase, junto con el cambio', () => {
    const r = cambiosParaGuardar(celda(), borrador({
      nuevos: [{
        pacienteId: 'Dani', nombre: 'Dani', tipo: 'cambio', ocupaLugarDe: null,
        cambioDe: { fecha: '2026-10-23', hora: '18:00', aviso: 'aviso_sin_tiempo' },
      }],
    }), AHORA);
    expect(r).toEqual([
      { fecha: '2026-10-26', hora: '10:30', cambios: [
        { paciente_id: 'Dani', tipo: 'cambio', estado: 'pendiente', ocupa_lugar_de_paciente: null, cambio_de: { fecha: '2026-10-23', hora: '18:00' } },
      ] },
      { fecha: '2026-10-23', hora: '18:00', cambios: [
        { paciente_id: 'Dani', tipo: 'fijo', estado: 'aviso_sin_tiempo', avisado_at: '2026-10-23T12:00:00.000Z' },
      ] },
    ]);
  });

  it('cambio de horario de alguien que ya había avisado: no toca el origen', () => {
    const r = cambiosParaGuardar(celda(), borrador({
      nuevos: [{ pacienteId: 'Dani', nombre: 'Dani', tipo: 'cambio', ocupaLugarDe: null, cambioDe: { fecha: '2026-10-23', hora: '18:00', aviso: null } }],
    }), AHORA);
    expect(r).toHaveLength(1);
  });

  it('el fijo que era origen de un cambio deja de avisar: se quita el cambio en la otra clase', () => {
    const c = celda([fila('Ana', 'aviso_con_tiempo')]);
    const r = cambiosParaGuardar(c, borrador({
      estados: { Ana: 'presente' }, quitarCambios: [{ pacienteId: 'Ana', fecha: '2026-10-28', hora: '18:00' }],
    }), AHORA);
    expect(r[1]).toEqual({ fecha: '2026-10-28', hora: '18:00', cambios: [{ paciente_id: 'Ana', tipo: 'cambio', estado: null }] });
  });
});

describe('enlacesCambio', () => {
  it('encuentra el origen de un cambio y el destino de un aviso con el historial', () => {
    const avisoAna = fila('Ana', 'aviso_con_tiempo');
    const c = celda([avisoAna, fila('Dani', 'pendiente', { tipo: 'cambio', cambio_de: 'origen-Dani' })]);
    const historial = [
      { ...fila('Dani', 'aviso_sin_tiempo'), id: 'origen-Dani', clases_tpa: { fecha: '2026-10-23', hora: '18:00:00', motivo_cancelacion: null } },
      { ...fila('Ana', 'pendiente', { tipo: 'cambio', cambio_de: avisoAna.id }), id: 'destino-Ana', clases_tpa: { fecha: '2026-10-28', hora: '18:00:00', motivo_cancelacion: null } },
    ] as AsistenciaConClase[];
    const { origenDe, destinoDe } = enlacesCambio(c, historial);
    expect(origenDe.get('Dani')).toEqual({ fecha: '2026-10-23', hora: '18:00' });
    expect(destinoDe.get('Ana')).toEqual({ fecha: '2026-10-28', hora: '18:00' });
  });
});

describe('marcarRestoPresente', () => {
  it('marca Presente a los "Sin marcar" (fijos y quienes ocupan un lugar); no toca avisos, No avisó ni Presente', () => {
    const c = celda([
      fila('Ana', 'aviso_con_tiempo'), fila('Beto', 'falto_sin_avisar'),
      fila('Zoe', 'pendiente', { tipo: 'recupera', ocupa_lugar_de: 'fila-Ana' }),
      fila('Yago', 'presente', { tipo: 'suelta' }),
    ], ['Ana', 'Beto', 'Carla', 'Dora']);
    const filas = filasDeLaClase(c, borrador({ estados: { Dora: 'aviso_sin_tiempo' } }));
    expect(marcarRestoPresente(filas)).toEqual({ Carla: 'presente', Zoe: 'presente' });
  });

  it('se ve antes de guardar y se guarda como cualquier marca', () => {
    const c = celda();
    const b = borrador({ estados: { Beto: 'falto_sin_avisar' } });
    const estados = { ...b.estados, ...marcarRestoPresente(filasDeLaClase(c, b)) };
    expect(filasDeLaClase(c, { ...b, estados }).map((f) => [f.pacienteId, f.estado, f.sinGuardar])).toEqual([
      ['Ana', 'presente', true], ['Beto', 'falto_sin_avisar', true], ['Carla', 'presente', true],
    ]);
  });

  it('con todos marcados → nada que cambiar', () => {
    expect(marcarRestoPresente(filasDeLaClase(celda([fila('Ana', 'presente')], ['Ana']), BORRADOR_VACIO))).toEqual({});
  });
});

describe('notas de evolución en el modal', () => {
  it('nota nueva: va en la misma llamada que la asistencia, sin espacios de más', () => {
    const [clase] = cambiosParaGuardar(celda(), borrador({ estados: { Ana: 'presente' }, notas: { Ana: '  bajó la presión  ' } }), AHORA);
    expect(clase).toEqual({
      fecha: '2026-10-26', hora: '10:30',
      cambios: [{ paciente_id: 'Ana', tipo: 'fijo', estado: 'presente', avisado_at: null }],
      notas: [{ paciente_id: 'Ana', texto: 'bajó la presión' }],
    });
  });

  it('solo una nota (sin cambios de asistencia): igual se guarda la clase', () => {
    expect(cambiosParaGuardar(celda(), borrador({ notas: { Beto: 'dolor de rodilla' } }), AHORA)).toEqual([
      { fecha: '2026-10-26', hora: '10:30', cambios: [], notas: [{ paciente_id: 'Beto', texto: 'dolor de rodilla' }] },
    ]);
  });

  it('editar y borrar (texto vacío = null); sin cambios reales (solo espacios) → nada', () => {
    const c = celda([fila('Ana', 'presente')], ['Ana', 'Beto'], [nota('Ana', 'bajó la presión'), nota('Beto', 'avanzó')]);
    expect(notaDe(c, BORRADOR_VACIO, 'Ana')).toBe('bajó la presión');
    expect(cambiosParaGuardar(c, borrador({ notas: { Ana: 'bajó la presión ' } }), AHORA)).toEqual([]);
    expect(notaSinGuardar(c, borrador({ notas: { Ana: 'bajó la presión ' } }), 'Ana')).toBe(false);
    const [clase] = cambiosParaGuardar(c, borrador({ notas: { Ana: 'subió la presión', Beto: '   ' } }), AHORA);
    expect(clase.notas).toEqual([{ paciente_id: 'Ana', texto: 'subió la presión' }, { paciente_id: 'Beto', texto: null }]);
  });

  it('sin notas cambiadas, el pedido no lleva la clave "notas" (igual que la entrega 3)', () => {
    const [clase] = cambiosParaGuardar(celda(), borrador({ estados: { Ana: 'presente' } }), AHORA);
    expect('notas' in clase).toBe(false);
  });

  it('notas de quienes ya no están en la clase (quitados): se siguen mostrando', () => {
    const c = celda([fila('Ana', 'presente')], ['Ana'], [nota('Zoe', 'vino con dolor')]);
    expect(notasSinFila(c, filasDeLaClase(c, BORRADOR_VACIO))).toEqual([{ pacienteId: 'Zoe', nombre: 'Zoe' }]);
  });
});
