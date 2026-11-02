import { describe, expect, it } from 'vitest';
import type { EstadoAsistenciaTPA, MotivoCancelacionTPA, TipoAsistenciaTPA } from '@/types';
import { alertasDeFaltas, conMarcasDeLaClase, textoAlertaFaltas, type FilaAlerta } from './alertas';

// Octubre 2026: lunes 5, 12, 19, 26 · miércoles 7, 14, 21, 28 · viernes 9, 16, 23, 30.
const AHORA = new Date('2026-10-23T21:00:00Z'); // viernes 23, 18:00 en Argentina

function fila(
  paciente: string, fecha: string, hora: string, estado: EstadoAsistenciaTPA,
  extra: { tipo?: TipoAsistenciaTPA; motivo?: MotivoCancelacionTPA } = {},
): FilaAlerta {
  return {
    paciente_id: paciente, tipo: extra.tipo ?? 'fijo', estado,
    clases_tpa: { fecha, hora: `${hora}:00`, motivo_cancelacion: extra.motivo ?? null },
  };
}

const alerta = (filas: FilaAlerta[], paciente = 'Ana') => alertasDeFaltas(filas, AHORA).get(paciente) ?? null;

describe('alertasDeFaltas: 2 faltas seguidas sin avisar (diseño 3.3)', () => {
  it('las dos últimas marcadas son "No avisó" → alerta', () => {
    expect(alerta([
      fila('Ana', '2026-10-05', '10:30', 'presente'),
      fila('Ana', '2026-10-12', '10:30', 'falto_sin_avisar'),
      fila('Ana', '2026-10-19', '10:30', 'falto_sin_avisar'),
    ])).toEqual({ seguidas: 2, fechas: ['2026-10-12', '2026-10-19'] });
  });

  it('una sola "No avisó", o una "Presente" al final → sin alerta', () => {
    expect(alerta([fila('Ana', '2026-10-19', '10:30', 'falto_sin_avisar')])).toBeNull();
    expect(alerta([
      fila('Ana', '2026-10-12', '10:30', 'falto_sin_avisar'),
      fila('Ana', '2026-10-14', '10:30', 'falto_sin_avisar'),
      fila('Ana', '2026-10-19', '10:30', 'presente'),
    ])).toBeNull();
  });

  it('un aviso (C.T. o S.T.) corta la racha: es una clase marcada', () => {
    expect(alerta([
      fila('Ana', '2026-10-12', '10:30', 'falto_sin_avisar'),
      fila('Ana', '2026-10-14', '10:30', 'aviso_sin_tiempo'),
      fila('Ana', '2026-10-19', '10:30', 'falto_sin_avisar'),
    ])).toBeNull();
  });

  it('en cualquiera de sus horarios: lunes y miércoles cuentan juntos, en orden de fecha y hora', () => {
    expect(alerta([
      fila('Ana', '2026-10-21', '18:00', 'falto_sin_avisar'), // mié
      fila('Ana', '2026-10-19', '10:30', 'presente'), // lun (llega desordenado)
      fila('Ana', '2026-10-23', '10:30', 'falto_sin_avisar'), // vie
    ])).toEqual({ seguidas: 2, fechas: ['2026-10-21', '2026-10-23'] });
    // Mismo día, dos horarios: el de más tarde es el último.
    expect(alerta([
      fila('Ana', '2026-10-19', '18:00', 'presente'),
      fila('Ana', '2026-10-19', '10:30', 'falto_sin_avisar'),
      fila('Ana', '2026-10-21', '10:30', 'falto_sin_avisar'),
    ])).toBeNull();
  });

  it('las clases sin marcar no cortan la racha (no tienen fila)', () => {
    // Fija lunes y miércoles: faltó sin avisar el lun 12; el mié 14 y el lun 19 nadie la marcó; faltó sin avisar el mié 21.
    expect(alerta([
      fila('Ana', '2026-10-12', '10:30', 'falto_sin_avisar'),
      fila('Ana', '2026-10-21', '10:30', 'falto_sin_avisar'),
    ])?.seguidas).toBe(2);
  });

  it('las clases canceladas no cuentan, aunque tengan filas cargadas', () => {
    expect(alerta([
      fila('Ana', '2026-10-12', '10:30', 'falto_sin_avisar'),
      fila('Ana', '2026-10-14', '10:30', 'presente', { motivo: 'feriado' }),
      fila('Ana', '2026-10-19', '10:30', 'falto_sin_avisar'),
    ])?.seguidas).toBe(2);
    expect(alerta([
      fila('Ana', '2026-10-12', '10:30', 'falto_sin_avisar', { motivo: 'cancelada_por_pau' }),
      fila('Ana', '2026-10-19', '10:30', 'falto_sin_avisar'),
    ])).toBeNull();
  });

  it('las clases que todavía no empezaron no cuentan (un aviso a futuro no borra la alerta)', () => {
    expect(alerta([
      fila('Ana', '2026-10-16', '10:30', 'falto_sin_avisar'),
      fila('Ana', '2026-10-23', '10:30', 'falto_sin_avisar'), // hoy 10:30: ya empezó
      fila('Ana', '2026-10-26', '10:30', 'aviso_con_tiempo'), // lunes que viene
    ])?.seguidas).toBe(2);
    // Hoy a las 19:00 (son las 18:00): todavía no empezó.
    expect(alerta([
      fila('Ana', '2026-10-21', '10:30', 'presente'),
      fila('Ana', '2026-10-23', '19:00', 'falto_sin_avisar'),
    ])).toBeNull();
  });

  it('lo que hace como quien ocupa un lugar no cuenta ni corta la racha', () => {
    expect(alerta([
      fila('Ana', '2026-10-12', '10:30', 'falto_sin_avisar'),
      fila('Ana', '2026-10-16', '17:00', 'presente', { tipo: 'recupera' }),
      fila('Ana', '2026-10-19', '10:30', 'falto_sin_avisar'),
    ])?.seguidas).toBe(2);
    expect(alerta([
      fila('Ana', '2026-10-12', '10:30', 'falto_sin_avisar'),
      fila('Ana', '2026-10-16', '17:00', 'falto_sin_avisar', { tipo: 'suelta' }),
    ])).toBeNull();
  });

  it('tres seguidas → "3 faltas seguidas sin avisar"; cada alumno por separado', () => {
    const alertas = alertasDeFaltas([
      fila('Ana', '2026-10-12', '10:30', 'falto_sin_avisar'),
      fila('Ana', '2026-10-14', '10:30', 'falto_sin_avisar'),
      fila('Ana', '2026-10-19', '10:30', 'falto_sin_avisar'),
      fila('Beto', '2026-10-19', '10:30', 'falto_sin_avisar'),
      fila('Caro', '2026-10-12', '12:30', 'falto_sin_avisar'),
      fila('Caro', '2026-10-19', '12:30', 'falto_sin_avisar'),
    ], AHORA);
    expect([...alertas.keys()].sort()).toEqual(['Ana', 'Caro']);
    expect(textoAlertaFaltas(alertas.get('Ana')!)).toBe('3 faltas seguidas sin avisar');
  });
});

describe('conMarcasDeLaClase: la alerta con las marcas sin guardar del modal', () => {
  const historial = [
    fila('Ana', '2026-10-12', '10:30', 'falto_sin_avisar'),
    fila('Ana', '2026-10-19', '10:30', 'presente'),
  ];
  const clase = { fecha: '2026-10-19', hora: '10:30', motivo_cancelacion: null };

  it('marcar "No avisó" la segunda vez → aparece la alerta antes de guardar', () => {
    const filas = conMarcasDeLaClase(historial, clase, [{ pacienteId: 'Ana', tipo: 'fijo', estado: 'falto_sin_avisar' }]);
    expect(alerta(filas)?.seguidas).toBe(2);
  });

  it('volver a "Sin marcar" saca la fila de esa clase', () => {
    const conFalta = [...historial.slice(0, 1), fila('Ana', '2026-10-19', '10:30', 'falto_sin_avisar'), fila('Ana', '2026-10-05', '10:30', 'falto_sin_avisar')];
    expect(alerta(conFalta)?.seguidas).toBe(3);
    const filas = conMarcasDeLaClase(conFalta, clase, [{ pacienteId: 'Ana', tipo: 'fijo', estado: 'pendiente' }]);
    expect(alerta(filas)?.seguidas).toBe(2); // quedan el 5 y el 12
  });
});
