import { describe, expect, it } from 'vitest';
import type { AsistenciaConClase, ClaseTPA, DiaSemana, HorarioTPA, MotivoCancelacionTPA, TipoAsistenciaTPA } from '@/types';
import { calcularRecuperaciones, pendientesPorOrigen, textoListaRecuperaciones, type DatosRecuperaciones } from './recuperaciones';

// Octubre 2026: lunes 5, 12, 19, 26 · miércoles 7, 14, 21, 28 · viernes 2, 9, 16, 23, 30.
// Noviembre 2026: lunes 2, 9, 16, 23, 30 · viernes 6, 13, 20, 27.
// Diciembre 2026: lunes 7, 14, 21, 28.

let contador = 0;
const id = () => `id-${++contador}`;

function fijo(nombre: string, dia: DiaSemana, hora: string, extra: Partial<HorarioTPA> = {}): HorarioTPA {
  return {
    id: id(), paciente_id: `pac-${nombre}`, dia_semana: dia, hora, activo: true,
    fecha_alta: '2026-01-01', fecha_baja: null, created_at: '2026-01-01T12:00:00Z', pacientes: { nombre },
    ...extra,
  };
}

function cancelada(fecha: string, hora: string, motivo: MotivoCancelacionTPA): ClaseTPA {
  return { id: id(), fecha, hora: `${hora}:00`, motivo_cancelacion: motivo, created_at: '2026-01-01T12:00:00Z' };
}

function fila(
  nombre: string, fecha: string, hora: string, estado: AsistenciaConClase['estado'],
  extra: { tipo?: TipoAsistenciaTPA; cambio_de?: string; motivo?: MotivoCancelacionTPA } = {},
): AsistenciaConClase {
  return {
    id: id(), clase_id: `clase-${fecha}-${hora}`, paciente_id: `pac-${nombre}`, estado,
    tipo: extra.tipo ?? 'fijo', ocupa_lugar_de: null, cambio_de: extra.cambio_de ?? null,
    avisado_at: estado.startsWith('aviso') ? '2026-10-01T12:00:00Z' : null,
    nota: null, created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-01T12:00:00Z',
    pacientes: { nombre },
    clases_tpa: { fecha, hora: `${hora}:00`, motivo_cancelacion: extra.motivo ?? null },
  };
}

const recupera = (nombre: string, fecha: string, hora: string, estado: AsistenciaConClase['estado'] = 'pendiente') =>
  fila(nombre, fecha, hora, estado, { tipo: 'recupera' });

function saldo(mes: string, datos: Partial<DatosRecuperaciones>, hoy = '2026-10-22', nombre = 'Ana') {
  const saldos = calcularRecuperaciones(mes, { horarios: [], clasesCanceladas: [], asistencias: [], ...datos }, hoy);
  const s = saldos.find((x) => x.nombre === nombre);
  if (!s) throw new Error(`Sin saldo para ${nombre}`);
  return s;
}

const textos = (lista: { texto: string }[]) => lista.map((x) => x.texto);

describe('calcularRecuperaciones: casos del diseño (3.2)', () => {
  it('f = 2: C.T. lun 5, S.T. mié 14, C.T. lun 19 y usa 1 → consume la C.T. 5, queda la C.T. 19; la S.T. 14 sin derecho (tope)', () => {
    const s = saldo('2026-10', {
      horarios: [fijo('Ana', 'lunes', '10:30'), fijo('Ana', 'miercoles', '10:30')],
      asistencias: [
        fila('Ana', '2026-10-05', '10:30', 'aviso_con_tiempo'),
        fila('Ana', '2026-10-14', '10:30', 'aviso_sin_tiempo'),
        fila('Ana', '2026-10-19', '10:30', 'aviso_con_tiempo'),
        recupera('Ana', '2026-10-23', '17:00'),
      ],
    });
    expect(s.frecuencia).toBe(2);
    expect(textos(s.pendientes)).toEqual(['avisó con tiempo el lun 19']);
    expect(s.pendientes[0].vence).toBe('2026-10-31');
    expect(s.usos[0].credito?.texto).toBe('avisó con tiempo el lun 5');
    expect(s.sinDerecho).toEqual([
      { motivo: 'tope', fecha: '2026-10-14', hora: '10:30', texto: 'avisó sin tiempo el mié 14: ya tenía 2 de 2 este mes' },
    ]);
    expect(s.topeUsado).toBe(1);
  });

  it('f = 1: Pau cancela mié 7, C.T. mié 14, usa 1 → consume la C.T. (vence antes); queda la de Pau, que no vence', () => {
    const s = saldo('2026-10', {
      horarios: [fijo('Ana', 'miercoles', '10:30')],
      clasesCanceladas: [cancelada('2026-10-07', '10:30', 'cancelada_por_pau')],
      asistencias: [fila('Ana', '2026-10-14', '10:30', 'aviso_con_tiempo'), recupera('Ana', '2026-10-16', '10:30')],
    });
    expect(s.usos[0].credito?.texto).toBe('avisó con tiempo el mié 14');
    expect(s.pendientes).toEqual([
      { id: 'cancelada_por_pau_2026-10-07_10:30', origen: 'cancelada_por_pau', fecha: '2026-10-07', hora: '10:30', vence: null, texto: 'cancelé el mié 7' },
    ]);
    expect(s.topeUsado).toBe(1);
  });

  it('f = 1: Pau cancela en octubre y no la usa → en noviembre figura "cancelé el mié 7/10"', () => {
    const datos = {
      horarios: [fijo('Ana', 'miercoles', '10:30')],
      clasesCanceladas: [cancelada('2026-10-07', '10:30', 'cancelada_por_pau')],
    };
    expect(textos(saldo('2026-11', datos, '2026-11-10').pendientes)).toEqual(['cancelé el mié 7/10']);
    // y la puede usar en noviembre, fuera del tope
    const usada = saldo('2026-11', { ...datos, asistencias: [recupera('Ana', '2026-11-13', '10:30')] }, '2026-11-10');
    expect(usada.pendientes).toEqual([]);
    expect(usada.usos[0].credito?.texto).toBe('cancelé el mié 7/10');
    expect(usada.topeUsado).toBe(0);
  });

  it('la de Pau sigue pasando de mes en mes hasta que la usa', () => {
    const s = saldo('2027-01', {
      horarios: [fijo('Ana', 'miercoles', '10:30')],
      clasesCanceladas: [cancelada('2026-10-07', '10:30', 'cancelada_por_pau')],
    }, '2027-01-05');
    expect(textos(s.pendientes)).toEqual(['cancelé el mié 7/10']);
  });

  it('f = 1, fijo los lunes: noviembre 2026 tiene 5 lunes y 1 es feriado → dadas 4, no recupera', () => {
    const s = saldo('2026-11', {
      horarios: [fijo('Ana', 'lunes', '10:30')],
      clasesCanceladas: [cancelada('2026-11-23', '10:30', 'feriado')],
    }, '2026-11-24');
    expect(s.pendientes).toEqual([]);
  });

  it('f = 1, fijo los lunes: diciembre 2026 tiene 4 lunes y 1 es feriado → 1 por feriado, última en prioridad', () => {
    const s = saldo('2026-12', {
      horarios: [fijo('Ana', 'lunes', '10:30')],
      clasesCanceladas: [cancelada('2026-12-07', '10:30', 'feriado')],
      asistencias: [fila('Ana', '2026-12-14', '10:30', 'aviso_sin_tiempo')],
    }, '2026-12-15');
    expect(textos(s.pendientes)).toEqual(['avisó sin tiempo el lun 14', 'feriado del lun 7']);
    expect(s.pendientes[1].vence).toBe('2026-12-31');
  });

  it('anotado para recuperar que queda en "No vino" → cuenta como usada', () => {
    const s = saldo('2026-10', {
      horarios: [fijo('Ana', 'lunes', '10:30')],
      asistencias: [fila('Ana', '2026-10-05', '10:30', 'aviso_con_tiempo'), recupera('Ana', '2026-10-07', '10:30', 'falto_sin_avisar')],
    });
    expect(s.pendientes).toEqual([]);
    expect(s.usos[0].estado).toBe('falto_sin_avisar');
    expect(s.usos[0].credito?.origen).toBe('aviso_con_tiempo');
  });

  it('cambio de horario (C.T. en el origen + cambio en el destino, mismo mes) → consume su C.T. y usa 1 del tope', () => {
    const origen = fila('Ana', '2026-10-12', '18:00', 'aviso_con_tiempo');
    const s = saldo('2026-10', {
      horarios: [fijo('Ana', 'lunes', '18:00'), fijo('Ana', 'viernes', '18:00')],
      asistencias: [
        fila('Ana', '2026-10-05', '18:00', 'aviso_con_tiempo'),
        origen,
        fila('Ana', '2026-10-14', '18:00', 'pendiente', { tipo: 'cambio', cambio_de: origen.id }),
      ],
    });
    // Consume el aviso de su horario de origen (lun 12), no el más viejo (lun 5).
    expect(s.usos[0].credito?.texto).toBe('avisó con tiempo el lun 12');
    expect(s.usos[0].texto).toBe('cambio de horario el mié 14');
    expect(textos(s.pendientes)).toEqual(['avisó con tiempo el lun 5']);
    expect(s.topeUsado).toBe(1);
  });

  it('f = 1, sin faltas, recupera (adelanta) el 7 y avisa C.T. el 19 → al final del mes: 0 pendientes, 0 adelantos, tope 1 de 1', () => {
    const s = saldo('2026-10', {
      horarios: [fijo('Ana', 'lunes', '10:30')],
      asistencias: [recupera('Ana', '2026-10-07', '10:30', 'presente'), fila('Ana', '2026-10-19', '10:30', 'aviso_con_tiempo')],
    }, '2026-11-02');
    expect(s.pendientes).toEqual([]);
    expect(s.adelantos).toEqual([]);
    expect(s.topeUsado).toBe(1);
    expect(s.adelantoSinFalta).toBe(false);
  });

  it('avisa sin tiempo y nadie ocupa su lugar → igual tiene derecho', () => {
    const s = saldo('2026-10', {
      horarios: [fijo('Ana', 'lunes', '10:30')],
      asistencias: [fila('Ana', '2026-10-19', '10:30', 'aviso_sin_tiempo')],
    });
    expect(textos(s.pendientes)).toEqual(['avisó sin tiempo el lun 19']);
  });

  it('no avisó → sin crédito, figura en "sin derecho"', () => {
    const s = saldo('2026-10', {
      horarios: [fijo('Ana', 'lunes', '10:30')],
      asistencias: [fila('Ana', '2026-10-12', '10:30', 'falto_sin_avisar')],
    });
    expect(s.pendientes).toEqual([]);
    expect(s.sinDerecho).toEqual([{ motivo: 'no_aviso', fecha: '2026-10-12', hora: '10:30', texto: 'no avisó el lun 12' }]);
  });
});

describe('calcularRecuperaciones: casos borde decididos (10.2)', () => {
  it('10.2.1 feriado en total: lunes y viernes, 5 lunes sin feriado y 4 viernes con 1 feriado → 8 = 4 × 2, no recupera', () => {
    const datos = {
      horarios: [fijo('Ana', 'lunes', '10:30'), fijo('Ana', 'viernes', '10:30')],
      clasesCanceladas: [cancelada('2026-11-20', '10:30', 'feriado')],
    };
    expect(saldo('2026-11', datos, '2026-11-24').pendientes).toEqual([]);
  });

  it('10.2.2 consume primero lo que vence antes: con una de Pau y una avisada, usa la avisada', () => {
    const s = saldo('2026-10', {
      horarios: [fijo('Ana', 'lunes', '10:30')],
      clasesCanceladas: [cancelada('2026-10-05', '10:30', 'cancelada_por_pau')],
      asistencias: [fila('Ana', '2026-10-12', '10:30', 'aviso_sin_tiempo'), recupera('Ana', '2026-10-14', '10:30')],
    });
    expect(s.usos[0].credito?.origen).toBe('aviso_sin_tiempo');
    expect(textos(s.pendientes)).toEqual(['cancelé el lun 5']);
  });

  it('10.2.2 la prioridad de Pau ordena los pendientes: Pau, C.T., S.T., feriado', () => {
    const s = saldo('2026-12', {
      horarios: [fijo('Ana', 'lunes', '10:30'), fijo('Ana', 'viernes', '10:30')],
      clasesCanceladas: [cancelada('2026-12-07', '10:30', 'feriado'), cancelada('2026-12-21', '10:30', 'cancelada_por_pau')],
      asistencias: [fila('Ana', '2026-12-04', '10:30', 'aviso_sin_tiempo'), fila('Ana', '2026-12-14', '10:30', 'aviso_con_tiempo')],
    }, '2026-12-01');
    expect(s.pendientes.map((c) => c.origen)).toEqual(['cancelada_por_pau', 'aviso_con_tiempo', 'aviso_sin_tiempo', 'feriado']);
  });

  it('10.2.3 adelantó y no faltó en todo el mes → la app lo muestra (decide Pau)', () => {
    const datos = { horarios: [fijo('Ana', 'lunes', '10:30')], asistencias: [recupera('Ana', '2026-10-07', '10:30', 'presente')] };
    const enCurso = saldo('2026-10', datos, '2026-10-22');
    expect(textos(enCurso.adelantos)).toEqual(['recupera el mié 7']);
    expect(enCurso.adelantoSinFalta).toBe(false); // todavía puede faltar
    const cerrado = saldo('2026-10', datos, '2026-11-02');
    expect(cerrado.adelantoSinFalta).toBe(true);
    expect(cerrado.topeUsado).toBe(1);
  });

  it('10.2.5 cambio de horario que cruza el mes (C.T. vie 30/10 → viene lun 2/11): consume la C.T. de octubre', () => {
    const origen = fila('Ana', '2026-10-30', '18:00', 'aviso_con_tiempo');
    const datos = {
      horarios: [fijo('Ana', 'viernes', '18:00')],
      asistencias: [origen, fila('Ana', '2026-11-02', '18:00', 'pendiente', { tipo: 'cambio', cambio_de: origen.id })],
    };
    const octubre = saldo('2026-10', datos, '2026-10-30');
    expect(octubre.pendientes).toEqual([]);
    expect(octubre.usos).toHaveLength(1);
    expect(octubre.usos[0]).toMatchObject({ deOtroMes: true, texto: 'cambio de horario el lun 2/11' });
    expect(octubre.usos[0].credito?.texto).toBe('avisó con tiempo el vie 30');
    // En noviembre no cuenta (ni gasta tope de noviembre).
    const noviembre = saldo('2026-11', datos, '2026-11-03');
    expect(noviembre.usos).toEqual([]);
    expect(noviembre.topeUsado).toBe(0);
  });

  it('10.2.6 alta a mitad de mes: por feriado recupera como máximo los feriados que le tocaron', () => {
    const alta = fijo('Ana', 'lunes', '10:30', { fecha_alta: '2026-11-15' });
    // Lunes desde el 15: 16, 23, 30 (3 clases). Sin feriados: nada, aunque tenga menos de 4.
    expect(saldo('2026-11', { horarios: [alta] }, '2026-11-24').pendientes).toEqual([]);
    // Con el feriado del 23: dadas 2, faltan 2 para 4, pero le tocó 1 feriado → 1.
    const conFeriado = saldo('2026-11', { horarios: [alta], clasesCanceladas: [cancelada('2026-11-23', '10:30', 'feriado')] }, '2026-11-24');
    expect(textos(conFeriado.pendientes)).toEqual(['feriado del lun 23']);
    // Un feriado antes del alta no le toca.
    const antes = saldo('2026-11', { horarios: [alta], clasesCanceladas: [cancelada('2026-11-09', '10:30', 'feriado')] }, '2026-11-24');
    expect(antes.pendientes).toEqual([]);
  });
});

describe('calcularRecuperaciones: otras reglas', () => {
  it('clase cancelada con filas cargadas: el aviso no genera crédito (lo genera la cancelación) y quien venía no gasta', () => {
    const s = saldo('2026-10', {
      horarios: [fijo('Ana', 'lunes', '10:30')],
      clasesCanceladas: [cancelada('2026-10-12', '10:30', 'cancelada_por_pau'), cancelada('2026-10-14', '10:30', 'feriado')],
      asistencias: [
        fila('Ana', '2026-10-12', '10:30', 'aviso_con_tiempo', { motivo: 'cancelada_por_pau' }),
        fila('Ana', '2026-10-14', '10:30', 'pendiente', { tipo: 'recupera', motivo: 'feriado' }),
      ],
    });
    expect(textos(s.pendientes)).toEqual(['cancelé el lun 12']);
    expect(s.usos).toEqual([]);
  });

  it('cancelada por Pau antes del alta o en otro horario → no le toca', () => {
    const s = saldo('2026-10', {
      horarios: [fijo('Ana', 'lunes', '10:30', { fecha_alta: '2026-10-10' })],
      clasesCanceladas: [cancelada('2026-10-05', '10:30', 'cancelada_por_pau'), cancelada('2026-10-12', '11:30', 'cancelada_por_pau')],
    });
    expect(s.pendientes).toEqual([]);
  });

  it('mes cerrado: lo que vencía se pierde ("venció el 31/10"), lo de Pau queda', () => {
    const s = saldo('2026-10', {
      horarios: [fijo('Ana', 'lunes', '10:30')],
      clasesCanceladas: [cancelada('2026-10-26', '10:30', 'cancelada_por_pau')],
      asistencias: [fila('Ana', '2026-10-12', '10:30', 'aviso_con_tiempo')],
    }, '2026-11-02');
    expect(textos(s.pendientes)).toEqual(['cancelé el lun 26']);
    expect(s.sinDerecho).toEqual([
      { motivo: 'vencio', fecha: '2026-10-12', hora: '10:30', texto: 'avisó con tiempo el lun 12: venció el 31/10' },
    ]);
  });

  it('pasarse del tope: f = 1, una C.T. y dos recuperaciones → la segunda es un adelanto y el tope queda 2 de 1', () => {
    const s = saldo('2026-10', {
      horarios: [fijo('Ana', 'lunes', '10:30')],
      asistencias: [
        fila('Ana', '2026-10-05', '10:30', 'aviso_con_tiempo'),
        recupera('Ana', '2026-10-07', '10:30'),
        recupera('Ana', '2026-10-09', '10:30'),
      ],
    });
    expect(s.topeUsado).toBe(2);
    expect(textos(s.adelantos)).toEqual(['recupera el vie 9']);
  });

  it('usar solo una de Pau no gasta tope', () => {
    const s = saldo('2026-10', {
      horarios: [fijo('Ana', 'lunes', '10:30')],
      clasesCanceladas: [cancelada('2026-10-05', '10:30', 'cancelada_por_pau')],
      asistencias: [recupera('Ana', '2026-10-07', '10:30')],
    });
    expect(s.pendientes).toEqual([]);
    expect(s.topeUsado).toBe(0);
  });

  it('las clases sueltas no cuentan', () => {
    const s = saldo('2026-10', {
      horarios: [fijo('Ana', 'lunes', '10:30')],
      asistencias: [fila('Ana', '2026-10-05', '10:30', 'aviso_con_tiempo'), fila('Ana', '2026-10-07', '10:30', 'presente', { tipo: 'suelta' })],
    });
    expect(s.usos).toEqual([]);
    expect(textos(s.pendientes)).toEqual(['avisó con tiempo el lun 5']);
  });

  it('frecuencia: se dio de baja a mitad de mes → la que tuvo en el mes; sin horarios (solo sueltas) → 0', () => {
    const baja = fijo('Ana', 'lunes', '10:30', { activo: false, fecha_baja: '2026-10-15' });
    expect(saldo('2026-10', { horarios: [baja] }, '2026-10-22').frecuencia).toBe(1);
    const suelta = saldo('2026-10', { asistencias: [fila('Bea', '2026-10-05', '10:30', 'presente', { tipo: 'suelta' })] }, '2026-10-22', 'Bea');
    expect(suelta.frecuencia).toBe(0);
  });

  it('pendientesPorOrigen agrupa a todos en orden de prioridad', () => {
    const saldos = calcularRecuperaciones('2026-10', {
      horarios: [fijo('Ana', 'lunes', '10:30'), fijo('Beto', 'miercoles', '10:30')],
      clasesCanceladas: [cancelada('2026-10-07', '10:30', 'cancelada_por_pau')],
      asistencias: [fila('Ana', '2026-10-12', '10:30', 'aviso_con_tiempo')],
    }, '2026-10-22');
    const grupos = pendientesPorOrigen(saldos);
    expect(grupos.cancelada_por_pau.map((g) => [g.saldo.nombre, g.credito.texto])).toEqual([['Beto', 'cancelé el mié 7']]);
    expect(grupos.aviso_con_tiempo.map((g) => g.saldo.nombre)).toEqual(['Ana']);
    expect(grupos.aviso_sin_tiempo).toEqual([]);
    expect(grupos.feriado).toEqual([]);
  });
});

describe('textoListaRecuperaciones', () => {
  it('arma el texto para WhatsApp en orden de prioridad, con el vencimiento', () => {
    const saldos = calcularRecuperaciones('2026-10', {
      horarios: [fijo('Ana', 'lunes', '10:30'), fijo('Beto', 'miercoles', '10:30'), fijo('Caro', 'viernes', '10:30')],
      clasesCanceladas: [cancelada('2026-10-07', '10:30', 'cancelada_por_pau')],
      asistencias: [fila('Ana', '2026-10-12', '10:30', 'aviso_con_tiempo'), fila('Caro', '2026-10-16', '10:30', 'falto_sin_avisar')],
    }, '2026-10-22');
    expect(textoListaRecuperaciones(saldos, '2026-10')).toBe([
      'Recuperaciones pendientes · octubre 2026',
      'Clases que cancelé:\n• Beto: cancelé el mié 7',
      'Avisaron con tiempo:\n• Ana: avisó con tiempo el lun 12 (vence el 31/10)',
    ].join('\n\n'));
  });

  it('sin pendientes lo dice', () => {
    expect(textoListaRecuperaciones([], '2026-10')).toBe('Recuperaciones pendientes · octubre 2026\n\nNo hay recuperaciones pendientes.');
  });
});
