import { describe, expect, it } from 'vitest';
import { parseISO } from 'date-fns';
import type { AsistenciaTPA, CeldaTPA, ClaseTPA, DiaSemana, HorarioTPA, SaldoRecuperaciones } from '@/types';
import { armarSemanaTPA } from './tpa';
import { filtrarOpciones, lugaresParaRecuperar, opcionesParaOcupar, type DatosOcupar } from './ocupar';

// Destino: miércoles 28/10/2026 10:30. Semana del lunes 26.
let n = 0;
const id = () => `id-${++n}`;
const AHORA = new Date('2026-10-23T12:00:00Z'); // viernes 23, 9:00 en Argentina

const fijo = (nombre: string, dia: DiaSemana, hora: string): HorarioTPA => ({
  id: id(), paciente_id: nombre, dia_semana: dia, hora, activo: true, fecha_alta: '2026-01-01',
  fecha_baja: null, created_at: '2026-01-01T12:00:00Z', pacientes: { nombre },
});
const clase = (fecha: string, hora: string, motivo: ClaseTPA['motivo_cancelacion'] = null): ClaseTPA =>
  ({ id: `clase-${fecha}-${hora}`, fecha, hora, motivo_cancelacion: motivo, created_at: '2026-10-01T12:00:00Z' });
const fila = (c: ClaseTPA, nombre: string, estado: AsistenciaTPA['estado']): AsistenciaTPA => ({
  id: `fila-${nombre}-${c.fecha}`, clase_id: c.id, paciente_id: nombre, estado, tipo: 'fijo', ocupa_lugar_de: null,
  avisado_at: estado.startsWith('aviso') ? '2026-10-20T12:00:00Z' : null, cambio_de: null, nota: null,
  created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-01T12:00:00Z', pacientes: { nombre },
});
const saldo = (nombre: string, extra: Partial<SaldoRecuperaciones> = {}): SaldoRecuperaciones => ({
  pacienteId: nombre, nombre, frecuencia: 1, pendientes: [], usos: [], adelantos: [], topeUsado: 0,
  sinDerecho: [], adelantoSinFalta: false, ...extra,
});
const credito = (origen: SaldoRecuperaciones['pendientes'][number]['origen'], texto: string, vence: string | null = '2026-10-31') =>
  ({ id: `${origen}-${texto}`, origen, fecha: '2026-10-07', hora: '10:30', vence, texto });

const HORARIOS = [
  fijo('Ana', 'miercoles', '10:30'), fijo('Beto', 'miercoles', '10:30'),
  fijo('Pau1', 'lunes', '10:30'), fijo('CT', 'lunes', '11:30'), fijo('ST', 'viernes', '10:30'),
  fijo('Feri', 'viernes', '11:30'), fijo('Libre', 'lunes', '17:00'), fijo('Tope', 'viernes', '17:00'),
  fijo('Vino', 'lunes', '18:00'), fijo('Aviso', 'viernes', '18:00'),
];

function semana(clases: ClaseTPA[] = [], asistencias: AsistenciaTPA[] = []) {
  return armarSemanaTPA(parseISO('2026-10-26'), { horarios: HORARIOS, clases, asistencias });
}
const todas = (s: ReturnType<typeof semana>): CeldaTPA[] => [...s.lunes, ...s.miercoles, ...s.viernes];

function datos(extra: Partial<DatosOcupar> = {}): DatosOcupar {
  const lun = clase('2026-10-26', '18:00');
  const vie = clase('2026-10-30', '18:00');
  const s = semana([lun, vie], [fila(lun, 'Vino', 'presente'), fila(vie, 'Aviso', 'aviso_con_tiempo')]);
  const destino = s.miercoles.find((c) => c.hora === '10:30') as CeldaTPA;
  return {
    celda: destino,
    enLaClase: new Set(destino.alumnos.map((a) => a.pacienteId)),
    saldos: [
      saldo('Ana', { pendientes: [credito('aviso_con_tiempo', 'avisó con tiempo el mié 7')] }), // está en la clase
      saldo('Pau1', { pendientes: [credito('cancelada_por_pau', 'cancelé el lun 5', null), credito('aviso_sin_tiempo', 'avisó sin tiempo el lun 12')] }),
      saldo('CT', { pendientes: [credito('aviso_con_tiempo', 'avisó con tiempo el lun 12')] }),
      saldo('ST', { pendientes: [credito('aviso_sin_tiempo', 'avisó sin tiempo el vie 16')] }),
      saldo('Feri', { pendientes: [credito('feriado', 'feriado del vie 9')] }),
      saldo('Libre'),
      saldo('Tope', { topeUsado: 1, sinDerecho: [{ motivo: 'no_aviso', fecha: '2026-10-16', hora: '17:00', texto: 'no avisó el vie 16' }] }),
      saldo('Vino'),
      saldo('Aviso'),
    ],
    pacientes: [{ id: 'Ana', nombre: 'Ana' }, { id: 'Suelta', nombre: 'Súsana Suelta' }],
    horarios: HORARIOS,
    ventana: todas(s),
    historial: [],
    ahora: AHORA,
    ...extra,
  };
}

describe('opcionesParaOcupar', () => {
  it('ordena por prioridad de Pau: canceladas por ella, C.T., S.T., feriado, adelantar, cambio, suelta', () => {
    const opciones = opcionesParaOcupar(datos());
    expect(opciones.map((o) => [o.grupo, o.nombre])).toEqual([
      ['cancelada_por_pau', 'Pau1'],
      ['aviso_con_tiempo', 'CT'],
      ['aviso_sin_tiempo', 'ST'],
      ['feriado', 'Feri'],
      ['adelantar', 'Aviso'],
      ['adelantar', 'Libre'],
      ['adelantar', 'Vino'],
      ['cambio', 'Aviso'],
      ['cambio', 'CT'],
      ['cambio', 'Feri'],
      ['cambio', 'Libre'],
      ['cambio', 'Pau1'],
      ['cambio', 'ST'],
      ['cambio', 'Tope'],
      ['suelta', 'Súsana Suelta'],
    ]);
  });

  it('cada opción con su motivo y su saldo; quien ya está en la clase no aparece', () => {
    const opciones = opcionesParaOcupar(datos());
    expect(opciones.find((o) => o.nombre === 'Pau1')).toMatchObject({
      tipo: 'recupera', motivo: 'cancelé el lun 5 (y 1 más)', saldo: 'usó 0 de 1', avisos: [],
    });
    expect(opciones.some((o) => o.pacienteId === 'Ana' || o.pacienteId === 'Beto')).toBe(false);
  });

  it('quien no avisó (sin pendientes) y ya usó su tope no aparece para adelantar', () => {
    expect(opcionesParaOcupar(datos()).filter((o) => o.pacienteId === 'Tope').map((o) => o.grupo)).toEqual(['cambio']);
  });

  it('cambio de horario: el que ya vino no aparece; el que avisó, sí y sin tocar su aviso; avisa si se pasa del tope', () => {
    const cambios = opcionesParaOcupar(datos()).filter((o) => o.grupo === 'cambio');
    expect(cambios.some((o) => o.pacienteId === 'Vino')).toBe(false);
    expect(cambios.find((o) => o.pacienteId === 'Aviso')).toMatchObject({
      tipo: 'cambio', motivo: 'avisó que falta el vie 30/10 18:00 y viene acá',
      cambioDe: { fecha: '2026-10-30', hora: '18:00', yaAviso: true, sugerencia: null },
    });
    // Libre falta el lun 26 17:00 (más de 24 h): sugiere con tiempo.
    expect(cambios.find((o) => o.pacienteId === 'Libre')?.cambioDe).toMatchObject({ yaAviso: false, sugerencia: 'aviso_con_tiempo' });
    expect(cambios.find((o) => o.pacienteId === 'Tope')?.avisos).toEqual(['Ya usó 1 de 1 recuperaciones de octubre.']);
  });

  it('avisa (sin bloquear) si recuperar lo pasa del tope', () => {
    const d = datos({ saldos: [saldo('CT', { topeUsado: 1, pendientes: [credito('feriado', 'feriado del lun 5')] }), saldo('ST', { topeUsado: 1, frecuencia: 1, pendientes: [] })] });
    const opciones = opcionesParaOcupar(d);
    // Feriado no cuenta en el tope: sin aviso.
    expect(opciones.find((o) => o.pacienteId === 'CT' && o.grupo === 'feriado')?.avisos).toEqual([]);
  });

  it('cambio que cruza el mes: avisa que cuenta en el mes del aviso', () => {
    const lun = clase('2026-11-02', '10:30');
    const s = armarSemanaTPA(parseISO('2026-11-02'), { horarios: HORARIOS, clases: [lun], asistencias: [] });
    const destino = s.lunes.find((c) => c.hora === '10:30') as CeldaTPA;
    const ventana = [...todas(semana()), ...todas(s)];
    const opcion = opcionesParaOcupar(datos({ celda: destino, enLaClase: new Set(['Pau1']), ventana, saldos: [saldo('Aviso')] }))
      .find((o) => o.pacienteId === 'Aviso' && o.grupo === 'cambio');
    expect(opcion?.avisos).toContain('El aviso es de octubre: cuenta en octubre.');
  });

  it('filtra por nombre sin acentos ni mayúsculas', () => {
    expect(filtrarOpciones(opcionesParaOcupar(datos()), 'SUSANA').map((o) => o.nombre)).toEqual(['Súsana Suelta']);
  });
});

describe('lugaresParaRecuperar', () => {
  const celdas = () => {
    const s1 = semana([clase('2026-10-30', '10:30', 'feriado')]);
    const s2 = armarSemanaTPA(parseISO('2026-11-02'), { horarios: HORARIOS, clases: [], asistencias: [] });
    return [...todas(s1), ...todas(s2)];
  };

  it('solo clases futuras, no canceladas, con lugar, donde no está, y dentro del vencimiento', () => {
    const lugares = lugaresParaRecuperar(celdas(), 'CT', { vence: '2026-10-31' }, AHORA);
    expect(lugares.every((c) => c.fecha <= '2026-10-31' && !c.lugares.cancelada && c.lugares.libres > 0)).toBe(true);
    expect(lugares.some((c) => c.fecha === '2026-10-26' && c.hora === '11:30')).toBe(false); // es su clase
    expect(lugares.some((c) => c.fecha === '2026-10-30' && c.hora === '10:30')).toBe(false); // feriado
    expect(lugares[0]).toMatchObject({ fecha: '2026-10-26', hora: '10:30' });
  });

  it('las de Pau no vencen: también ofrece la semana siguiente en el mes que viene', () => {
    const lugares = lugaresParaRecuperar(celdas(), 'Pau1', { vence: null }, AHORA);
    expect(lugares.some((c) => c.fecha === '2026-11-02')).toBe(true);
  });

  it('no ofrece clases que ya empezaron', () => {
    const tarde = new Date('2026-10-26T14:00:00Z'); // lunes 26, 11:00 en Argentina
    const lugares = lugaresParaRecuperar(celdas(), 'CT', { vence: '2026-10-31' }, tarde);
    expect(lugares.some((c) => c.fecha === '2026-10-26' && c.hora === '10:30')).toBe(false);
    expect(lugares.some((c) => c.fecha === '2026-10-26' && c.hora === '12:30')).toBe(true);
  });
});
