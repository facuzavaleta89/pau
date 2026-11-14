import { describe, expect, it } from 'vitest';
import type { AsistenciaConClase, DiaSemana, HorarioTPA, PagoTPA, PreciosMes, SesionRPG } from '@/types';
import {
  avisoPorClase, calendarioDelMes, medioSugerido, cuotasDelMes, esDelUnoAlDiez, fijosDelMes, formatoPesos, hoyArgentina, moverMes,
  preciosDelMes, resumenDelMes, sesionesRPGDelMes, sueltasDelMes, textoHorarios, textoPendientes, textoSueltas,
  type AsistenciaSuelta,
} from './pagos';

// Precios de Pau (REQUISITOS.md, sección 4).
const SEPTIEMBRE: PreciosMes = { mes: '2026-09-01', tpa_1_vez: 46000, tpa_2_veces: 74000, tpa_3_veces: 100000, tpa_suelta: 16000, rpg_sesion: 46000 };
const OCTUBRE: PreciosMes = { mes: '2026-10-01', tpa_1_vez: 50000, tpa_2_veces: 80000, tpa_3_veces: 110000, tpa_suelta: 18000, rpg_sesion: 46000 };
const PRECIOS = [OCTUBRE, SEPTIEMBRE];

let n = 0;
function horario(paciente: string, dia: DiaSemana, hora: string, alta = '2026-09-01', baja: string | null = null): HorarioTPA {
  n += 1;
  return {
    id: `h${n}`, paciente_id: paciente, dia_semana: dia, hora, activo: baja === null,
    fecha_alta: alta, fecha_baja: baja, created_at: '', pacientes: { nombre: paciente },
  };
}

function pago(paciente: string, cambios: Partial<PagoTPA> = {}): PagoTPA {
  n += 1;
  return {
    id: `p${n}`, paciente_id: paciente, mes: '2026-10-01', concepto: 'cuota', veces_por_semana: 1, modalidad: 'plan',
    clases: null, importe: 50000, pagado_el: '2026-10-05', medio: 'transferencia', nota: null, created_at: '', updated_at: '',
    pacientes: { nombre: paciente }, ...cambios,
  };
}

function suelta(paciente: string, fecha: string, estado: AsistenciaConClase['estado'], cancelada = false): AsistenciaSuelta {
  return {
    paciente_id: paciente, tipo: 'suelta', estado, pacientes: { nombre: paciente },
    clases_tpa: { fecha, hora: '10:30', motivo_cancelacion: cancelada ? 'cancelada_por_pau' : null },
  };
}

function sesion(paciente: string, fecha: string, cambios: Partial<SesionRPG> = {}): SesionRPG {
  n += 1;
  return {
    id: `s${n}`, paciente_id: paciente, fecha, hora: '09:00', tipo_sesion: 'RPG', estado_pago: 'pendiente',
    estado_sesion: 'realizada', nota: null, created_at: '', pacientes: { nombre: paciente, telefono: null }, ...cambios,
  };
}

describe('formato y fechas', () => {
  it('pesos con punto de miles', () => {
    expect(formatoPesos(50000)).toBe('$50.000');
    expect(formatoPesos(110000)).toBe('$110.000');
    expect(formatoPesos(1234567)).toBe('$1.234.567');
    expect(formatoPesos(0)).toBe('$0');
  });

  it('mueve meses sin saltear (bug N4)', () => {
    expect(moverMes('2026-10', 1)).toBe('2026-11');
    expect(moverMes('2027-01', -1)).toBe('2026-12');
  });

  it('hoy en hora argentina aunque en UTC ya sea otro día', () => {
    expect(hoyArgentina(new Date('2026-11-01T02:00:00Z'))).toBe('2026-10-31');
    expect(hoyArgentina(new Date('2026-11-01T03:00:00Z'))).toBe('2026-11-01');
  });
});

describe('preciosDelMes', () => {
  it('hay octubre y se pide octubre: los de octubre, sin aviso', () => {
    expect(preciosDelMes(PRECIOS, '2026-10')).toEqual({ precios: OCTUBRE, heredadoDe: null });
  });

  it('se pide noviembre: los de octubre, con aviso', () => {
    expect(preciosDelMes(PRECIOS, '2026-11')).toEqual({ precios: OCTUBRE, heredadoDe: '2026-10' });
  });

  it('se pide agosto: no hay ninguno anterior', () => {
    expect(preciosDelMes(PRECIOS, '2026-08')).toBeNull();
  });
});

describe('fijosDelMes', () => {
  it('Alumna A, fija los lunes todo octubre: 1 vez, 4 clases', () => {
    const [a] = fijosDelMes([horario('A', 'lunes', '10:30')], '2026-10');
    expect(a).toMatchObject({ pacienteId: 'A', vecesPorSemana: 1, desde: null, baja: null, clases: 4, horariosDeMas: false });
  });

  it('Alumno B, lunes y miércoles: 2 veces, horarios en orden', () => {
    const [b] = fijosDelMes([horario('B', 'miercoles', '16:00'), horario('B', 'lunes', '10:30')], '2026-10');
    expect(b.vecesPorSemana).toBe(2);
    expect(textoHorarios(b)).toBe('lun 10:30 · mié 16:00');
  });

  it('Alumna C con 4 horarios (error de carga): 3 veces y aviso', () => {
    const [c] = fijosDelMes([
      horario('C', 'lunes', '10:30'), horario('C', 'lunes', '11:30'), horario('C', 'miercoles', '10:30'), horario('C', 'viernes', '10:30'),
    ], '2026-10');
    expect(c).toMatchObject({ vecesPorSemana: 3, horariosDeMas: true });
  });

  it('alta el 15/10 los lunes: empieza el 15, le tocan 2 clases (19 y 26)', () => {
    const [a] = fijosDelMes([horario('A', 'lunes', '10:30', '2026-10-15')], '2026-10');
    expect(a).toMatchObject({ desde: '2026-10-15', clases: 2 });
  });

  it('alta el 15/10 lunes, miércoles y viernes: 2 + 2 + 3 = 7 clases', () => {
    const [a] = fijosDelMes([
      horario('A', 'lunes', '10:30', '2026-10-15'), horario('A', 'miercoles', '10:30', '2026-10-15'), horario('A', 'viernes', '10:30', '2026-10-15'),
    ], '2026-10');
    expect(a).toMatchObject({ vecesPorSemana: 3, clases: 7 });
  });

  it('baja el 20/10: figura en octubre con "baja"', () => {
    const [a] = fijosDelMes([horario('A', 'lunes', '10:30', '2026-09-01', '2026-10-20')], '2026-10');
    expect(a).toMatchObject({ baja: '2026-10-20', clases: 3 });
  });

  it('baja el 30/9: no figura en octubre; alta el 1/11: tampoco, sí en noviembre', () => {
    const horarios = [horario('A', 'lunes', '10:30', '2026-09-01', '2026-09-30'), horario('B', 'lunes', '11:30', '2026-11-01')];
    expect(fijosDelMes(horarios, '2026-10')).toEqual([]);
    expect(fijosDelMes(horarios, '2026-11').map((f) => f.pacienteId)).toEqual(['B']);
  });

  it('cambia de 1 a 2 veces el 15/10: 2 veces, sin "desde"', () => {
    const [a] = fijosDelMes([horario('A', 'lunes', '10:30'), horario('A', 'miercoles', '10:30', '2026-10-15')], '2026-10');
    expect(a).toMatchObject({ vecesPorSemana: 2, desde: null });
  });

  it('cambia de horario a mitad de mes (baja uno, alta otro): sigue siendo 1 vez', () => {
    const [a] = fijosDelMes([
      horario('A', 'lunes', '10:30', '2026-09-01', '2026-10-15'), horario('A', 'miercoles', '10:30', '2026-10-15'),
    ], '2026-10');
    expect(a).toMatchObject({ vecesPorSemana: 1, desde: null, baja: null });
  });
});

describe('cuotasDelMes', () => {
  it('pendiente = precio del plan; pagado = 0 pendiente', () => {
    const cuotas = cuotasDelMes(
      [horario('A', 'lunes', '10:30'), horario('B', 'lunes', '11:30'), horario('B', 'miercoles', '11:30')],
      [pago('A')], '2026-10', OCTUBRE,
    );
    expect(cuotas.map((c) => [c.nombre, c.importePendiente, Boolean(c.pago)])).toEqual([['A', 0, true], ['B', 80000, false]]);
  });

  it('baja el 20/10: debe la cuota completa (supuesto 4)', () => {
    const [a] = cuotasDelMes([horario('A', 'lunes', '10:30', '2026-09-01', '2026-10-20')], [], '2026-10', OCTUBRE);
    expect(a.importePendiente).toBe(50000);
  });

  it('pagó pero ya no es fijo del mes: figura igual (sin fijo)', () => {
    const [a] = cuotasDelMes([], [pago('A', { veces_por_semana: 2, importe: 80000 })], '2026-10', OCTUBRE);
    expect(a).toMatchObject({ fijo: null, veces: 2, importePendiente: 0 });
  });

  it('el plan del grupo es el pagado, no el de los horarios', () => {
    const [a] = cuotasDelMes([horario('A', 'lunes', '10:30'), horario('A', 'miercoles', '10:30')], [pago('A')], '2026-10', OCTUBRE);
    expect(a.veces).toBe(1);
  });

  it('sin precios: el pendiente queda en 0 (la pantalla pide cargarlos)', () => {
    const [a] = cuotasDelMes([horario('A', 'lunes', '10:30', '2026-07-01')], [], '2026-08', null);
    expect(a.importePendiente).toBe(0);
  });
});

describe('avisoPorClase (el importe sugerido siempre es el plan)', () => {
  const base = { veces: 1, precios: OCTUBRE, mes: '2026-10', fijo: null };

  it('paga el 10/10: sin aviso', () => {
    expect(avisoPorClase({ ...base, pagadoEl: '2026-10-10' })).toBeNull();
    expect(esDelUnoAlDiez('2026-10-10', '2026-10')).toBe(true);
  });

  it('paga el 11/10: aviso por clase 4 × $18.000 = $72.000', () => {
    expect(avisoPorClase({ ...base, pagadoEl: '2026-10-11' })).toEqual({
      motivo: 'despues_del_10', clases: 4, importe: 72000, texto: 'Después del 10: por clase serían 4 × $18.000 = $72.000',
    });
  });

  it('2 veces después del 10: 8 clases', () => {
    expect(avisoPorClase({ ...base, veces: 2, pagadoEl: '2026-10-20' })?.importe).toBe(144000);
  });

  it('paga el 30/9 la cuota de octubre: cuenta como del 1 al 10', () => {
    expect(avisoPorClase({ ...base, pagadoEl: '2026-09-30' })).toBeNull();
  });

  it('alta el 15/10 los lunes: 2 × $18.000 = $36.000, aunque pague después del 10', () => {
    expect(avisoPorClase({ ...base, pagadoEl: '2026-10-20', fijo: { desde: '2026-10-15', clases: 2 } })).toEqual({
      motivo: 'alta', clases: 2, importe: 36000, texto: 'Empieza el 15/10: por clase serían 2 × $18.000 = $36.000',
    });
  });

  it('alta el 15/10 LMV: 7 × $18.000 = $126.000 > plan de 3 veces: sin aviso (queda el plan)', () => {
    expect(avisoPorClase({ ...base, veces: 3, pagadoEl: '2026-10-15', fijo: { desde: '2026-10-15', clases: 7 } })).toBeNull();
  });
});

describe('sueltasDelMes', () => {
  const hoy = '2026-10-31';

  it('3 sueltas (2 Presente, 1 No vino): se cobran 2 × $18.000', () => {
    const [d] = sueltasDelMes([
      suelta('D', '2026-10-05', 'presente'), suelta('D', '2026-10-12', 'presente'), suelta('D', '2026-10-19', 'falto_sin_avisar'),
    ], [], '2026-10', OCTUBRE, hoy);
    expect(d).toMatchObject({ presentes: 2, noVino: 1, pendientes: 2, importePendiente: 36000 });
    expect(textoSueltas(d)).toBe('vino 2 · 1 no vino');
  });

  it('pagó 1 el 5/10 y vuelve el 20/10: le falta 1; con un segundo pago (otra fila), ninguna', () => {
    const asistencias = [suelta('D', '2026-10-05', 'presente'), suelta('D', '2026-10-20', 'presente')];
    const primero = pago('D', { concepto: 'sueltas', veces_por_semana: null, modalidad: null, clases: 1, importe: 18000, pagado_el: '2026-10-05' });
    expect(sueltasDelMes(asistencias, [primero], '2026-10', OCTUBRE, hoy)[0]).toMatchObject({ pendientes: 1, importePendiente: 18000 });

    const segundo = { ...primero, id: 'otro', pagado_el: '2026-10-20', medio: 'efectivo' as const };
    expect(sueltasDelMes(asistencias, [segundo, primero], '2026-10', OCTUBRE, hoy)[0])
      .toMatchObject({ pendientes: 0, clasesPagadas: 2, importePagado: 36000 });
  });

  it('una suelta en una clase cancelada no cuenta', () => {
    expect(sueltasDelMes([suelta('D', '2026-10-05', 'presente', true)], [], '2026-10', OCTUBRE, hoy)).toEqual([]);
  });

  it('sin marcar en una clase pasada vs anotada en una que viene', () => {
    const [d] = sueltasDelMes([suelta('D', '2026-10-05', 'pendiente'), suelta('D', '2026-10-30', 'pendiente')], [], '2026-10', OCTUBRE, '2026-10-20');
    expect(d).toMatchObject({ sinMarcar: 1, porVenir: 1, pendientes: 0 });
  });

  it('las cuotas no se mezclan con las sueltas', () => {
    expect(sueltasDelMes([], [pago('A')], '2026-10', OCTUBRE, hoy)).toEqual([]);
  });
});

describe('sesionesRPGDelMes', () => {
  it('cancelada sin pagar: no figura', () => {
    expect(sesionesRPGDelMes([sesion('X', '2026-10-06', { estado_sesion: 'cancelada' })], '2026-10', OCTUBRE, '2026-10-20')).toEqual([]);
  });

  it('del 28/10 sin pagar, hoy 20/10: todavía no es deuda', () => {
    const [s] = sesionesRPGDelMes([sesion('X', '2026-10-28', { estado_sesion: 'pendiente' })], '2026-10', OCTUBRE, '2026-10-20');
    expect(s).toMatchObject({ futura: true, aCobrar: false, importe: 46000 });
  });

  it('pagada sin importe (marcada desde el turno): se cuenta con el precio del mes', () => {
    const [s] = sesionesRPGDelMes([sesion('X', '2026-10-06', { estado_pago: 'pagado' })], '2026-10', OCTUBRE, '2026-10-20');
    expect(s).toMatchObject({ pagada: true, importe: 46000, importeEstimado: true });
  });

  it('pagada con importe: el guardado, aunque cambie el precio', () => {
    const [s] = sesionesRPGDelMes([sesion('X', '2026-10-06', { estado_pago: 'pagado', importe: 40000 })], '2026-10', OCTUBRE, '2026-10-20');
    expect(s).toMatchObject({ importe: 40000, importeEstimado: false });
  });
});

describe('resumenDelMes', () => {
  it('ejemplo del diseño: cuotas, sueltas y RPG, por medio', () => {
    const horarios = [
      horario('A', 'lunes', '10:30'), horario('B', 'lunes', '10:30'), horario('C', 'lunes', '10:30'),
      horario('E', 'lunes', '11:30'), horario('E', 'miercoles', '11:30'),
    ];
    const pagos = [
      pago('A', { medio: 'efectivo' }), pago('B'),
      pago('D', { concepto: 'sueltas', veces_por_semana: null, modalidad: null, clases: 2, importe: 36000, medio: 'efectivo' }),
    ];
    const cuotas = cuotasDelMes(horarios, pagos, '2026-10', OCTUBRE);
    const sueltas = sueltasDelMes([suelta('D', '2026-10-05', 'presente'), suelta('D', '2026-10-07', 'presente')], pagos, '2026-10', OCTUBRE, '2026-10-31');
    const sesiones = sesionesRPGDelMes([
      sesion('X', '2026-10-06', { estado_pago: 'pagado', importe: 46000, medio_pago: 'transferencia' }),
      sesion('X', '2026-10-08', { estado_pago: 'pagado', importe: 46000, medio_pago: 'efectivo' }),
      sesion('Y', '2026-10-13', { estado_pago: 'pagado' }),
      sesion('Y', '2026-10-15'),
    ], '2026-10', OCTUBRE, '2026-10-31');

    const r = resumenDelMes(cuotas, sueltas, sesiones);
    expect(r.planes).toEqual([
      { veces: 1, alumnos: 3, pagaron: 2, cobrado: 100000, pendiente: 50000 },
      { veces: 2, alumnos: 1, pagaron: 0, cobrado: 0, pendiente: 80000 },
      { veces: 3, alumnos: 0, pagaron: 0, cobrado: 0, pendiente: 0 },
    ]);
    expect(r.sueltas).toEqual({ clases: 2, cobrado: 36000, pendiente: 0 });
    expect(r.rpg).toEqual({ sesiones: 4, cobrado: 138000, pendiente: 46000 });
    expect(r.cobrado).toBe(2 * 50000 + 36000 + 3 * 46000);
    expect(r.faltaCobrar).toBe(50000 + 80000 + 46000);
    expect(r.total).toBe(r.cobrado + r.faltaCobrar);
    expect(r).toMatchObject({ efectivo: 50000 + 36000 + 46000, transferencia: 50000 + 46000, sinMedio: 46000 });
  });

  it('lo cobrado en octubre no cambia si después suben los precios', () => {
    const noviembre = { ...OCTUBRE, mes: '2026-11-01', tpa_1_vez: 55000 };
    const cuotas = cuotasDelMes([horario('A', 'lunes', '10:30')], [pago('A')], '2026-10', noviembre);
    expect(resumenDelMes(cuotas, [], []).cobrado).toBe(50000);
  });
});

describe('textoPendientes', () => {
  it('lista por sección con el total', () => {
    const cuotas = cuotasDelMes([horario('Ana', 'lunes', '10:30'), horario('Beto', 'lunes', '11:30')], [pago('Beto')], '2026-10', OCTUBRE);
    const sueltas = sueltasDelMes([suelta('Dora', '2026-10-05', 'presente')], [], '2026-10', OCTUBRE, '2026-10-31');
    const sesiones = sesionesRPGDelMes([sesion('Xime', '2026-10-06'), sesion('Xime', '2026-10-08')], '2026-10', OCTUBRE, '2026-10-31');
    expect(textoPendientes('2026-10', cuotas, sueltas, sesiones)).toBe([
      'Pagos pendientes de octubre 2026',
      '',
      'Cuotas TPA:',
      '• Ana (1 vez por semana): $50.000',
      '',
      'Clases sueltas TPA:',
      '• Dora: 1 clase ($18.000)',
      '',
      'RPG:',
      '• Xime: 2 sesiones (6/10, 8/10): $92.000',
      '',
      'Total: $160.000',
    ].join('\n'));
  });

  it('sin pendientes', () => {
    expect(textoPendientes('2026-10', [], [], [])).toBe('No hay pagos pendientes en octubre 2026.');
  });
});

describe('calendarioDelMes', () => {
  it('lunes 10:30 con 3 fijos (1 pagó): verde, rosa, rosa, Libre', () => {
    const horarios = [horario('Ana', 'lunes', '10:30'), horario('Beto', 'lunes', '10:30'), horario('Caro', 'lunes', '10:30')];
    const filas = calendarioDelMes(horarios, cuotasDelMes(horarios, [pago('Beto')], '2026-10', OCTUBRE), '2026-10');
    const celda = filas.find((f) => f.hora === '10:30')?.celdas.lunes;
    expect(celda?.lugares).toEqual([
      { tipo: 'fijo', pacienteId: 'Ana', nombre: 'Ana', pagado: false, desde: null, baja: null },
      { tipo: 'fijo', pacienteId: 'Beto', nombre: 'Beto', pagado: true, desde: null, baja: null },
      { tipo: 'fijo', pacienteId: 'Caro', nombre: 'Caro', pagado: false, desde: null, baja: null },
      { tipo: 'libre' },
    ]);
    expect(celda?.fijosActuales).toHaveLength(3);
  });

  it('fijo con alta el 15: "desde"; viernes 19:00 no tiene clase; horario vacío: 4 libres', () => {
    const horarios = [horario('Ana', 'miercoles', '12:30', '2026-10-15')];
    const filas = calendarioDelMes(horarios, [], '2026-10');
    expect(filas.find((f) => f.hora === '12:30')?.celdas.miercoles?.lugares[0]).toMatchObject({ desde: '2026-10-15', pagado: false });
    expect(filas.find((f) => f.hora === '19:00')?.celdas.viernes).toBeNull();
    expect(filas.find((f) => f.hora === '16:00')?.celdas.viernes?.lugares).toEqual(Array(4).fill({ tipo: 'libre' }));
  });

  it('un horario fuera de los habituales con fijos aparece', () => {
    const filas = calendarioDelMes([horario('Ana', 'lunes', '08:00')], [], '2026-10');
    expect(filas[0].hora).toBe('08:00');
    expect(filas[0].celdas.lunes?.enHorarioHabitual).toBe(false);
    expect(filas[0].celdas.miercoles).toBeNull();
  });
});

describe('medioSugerido', () => {
  it('el de su último pago; si no tiene, transferencia', () => {
    const pagos = [pago('A', { pagado_el: '2026-09-05', medio: 'transferencia' }), pago('A', { mes: '2026-10-01', pagado_el: '2026-10-03', medio: 'efectivo' })];
    expect(medioSugerido(pagos, 'A')).toBe('efectivo');
    expect(medioSugerido(pagos, 'B')).toBe('transferencia');
  });
});
