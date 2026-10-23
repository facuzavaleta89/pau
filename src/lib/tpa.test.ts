import { describe, expect, it } from 'vitest';
import { parseISO } from 'date-fns';
import type { AsistenciaTPA, ClaseTPA, DiaSemana, HorarioTPA, MotivoCancelacionTPA } from '@/types';
import {
  armarSemanaTPA, celdasEntre, contarLugares, diaSemanaDeFecha, diaTPAInicial, eraFijoEn, HORARIOS_TPA, textoLugares,
  type DatosSemanaTPA,
} from './tpa';

// Semana del lunes 19/10/2026 (miércoles 21, viernes 23).
const LUNES = parseISO('2026-10-19');

let contador = 0;
const id = () => `id-${++contador}`;

function horario(
  nombre: string, dia: DiaSemana, hora: string,
  extra: Partial<HorarioTPA> = {},
): HorarioTPA {
  return {
    id: id(),
    paciente_id: `pac-${nombre}`,
    dia_semana: dia,
    hora,
    activo: true,
    fecha_alta: '2026-10-01',
    fecha_baja: null,
    created_at: '2026-10-01T12:00:00+00:00',
    pacientes: { nombre },
    ...extra,
  };
}

function clase(fecha: string, hora: string, motivo_cancelacion: MotivoCancelacionTPA | null = null): ClaseTPA {
  return { id: id(), fecha, hora, motivo_cancelacion, created_at: '2026-10-01T12:00:00+00:00' };
}

function asistencia(
  c: ClaseTPA, nombre: string, estado: AsistenciaTPA['estado'],
  extra: Partial<AsistenciaTPA> = {},
): AsistenciaTPA {
  return {
    id: id(), clase_id: c.id, paciente_id: `pac-${nombre}`, estado, tipo: 'fijo',
    ocupa_lugar_de: null, avisado_at: null, cambio_de: null, nota: null,
    created_at: '2026-10-01T12:00:00+00:00', updated_at: '2026-10-01T12:00:00+00:00',
    pacientes: { nombre },
    ...extra,
  };
}

function armar(datos: Partial<DatosSemanaTPA>) {
  return armarSemanaTPA(LUNES, { horarios: [], clases: [], asistencias: [], ...datos });
}

function celda(semana: ReturnType<typeof armar>, dia: DiaSemana, hora: string) {
  const encontrada = semana[dia].find((c) => c.hora === hora);
  if (!encontrada) throw new Error(`No hay celda ${dia} ${hora}`);
  return encontrada;
}

describe('armarSemanaTPA', () => {
  it('corre en hora de Argentina (vitest.config.ts)', () => {
    expect(new Date('2026-10-19T12:00:00Z').getTimezoneOffset()).toBe(180);
  });

  it('arma lunes, miércoles y viernes con sus fechas y los horarios habituales', () => {
    const semana = armar({});
    expect(semana.lunes[0].fecha).toBe('2026-10-19');
    expect(semana.miercoles[0].fecha).toBe('2026-10-21');
    expect(semana.viernes[0].fecha).toBe('2026-10-23');
    expect(semana.lunes.map((c) => c.hora)).toEqual(HORARIOS_TPA.lunes);
    expect(semana.viernes.map((c) => c.hora)).not.toContain('19:00');
    expect(semana.lunes.every((c) => c.enHorarioHabitual && c.cupo === 4 && c.clase === null)).toBe(true);
    expect(celda(semana, 'lunes', '10:30').clave).toBe('2026-10-19_10:30');
  });

  it('muestra al fijo sin asistencia como "sin marcar"', () => {
    const semana = armar({ horarios: [horario('Alumna A', 'lunes', '10:30')] });
    expect(celda(semana, 'lunes', '10:30').alumnos).toEqual([
      { pacienteId: 'pac-Alumna A', nombre: 'Alumna A', estado: 'pendiente', asistencia: null, esFijo: true, tipo: 'fijo' },
    ]);
    // Solo en su día y hora
    expect(celda(semana, 'miercoles', '10:30').alumnos).toEqual([]);
    expect(celda(semana, 'lunes', '11:30').alumnos).toEqual([]);
  });

  it('no muestra a un fijo antes de su fecha de alta', () => {
    const h = horario('Alumna A', 'lunes', '10:30', { fecha_alta: '2026-10-20' });
    expect(celda(armar({ horarios: [h] }), 'lunes', '10:30').alumnos).toEqual([]);
  });

  it('usa fecha_alta y no created_at: un alta cargada después puede ser de antes', () => {
    // Inscripto el 25/10 con "fijo desde" el 19/10: ya aparece el lunes 19.
    const h = horario('Alumna A', 'lunes', '10:30', { fecha_alta: '2026-10-19', created_at: '2026-10-25T12:00:00+00:00' });
    expect(celda(armar({ horarios: [h] }), 'lunes', '10:30').alumnos).toHaveLength(1);
  });

  it('muestra al ex fijo en las fechas anteriores a la baja, pero no desde la baja', () => {
    const h = horario('Alumna A', 'lunes', '10:30', { activo: false, fecha_baja: '2026-10-20' });
    const semana = armar({ horarios: [h] });
    expect(celda(semana, 'lunes', '10:30').alumnos.map((a) => a.nombre)).toEqual(['Alumna A']);
    expect(celda(semana, 'lunes', '10:30').fijosActuales).toEqual([]);

    const delMismoDia = horario('Alumno B', 'lunes', '10:30', { activo: false, fecha_baja: '2026-10-19' });
    expect(celda(armar({ horarios: [delMismoDia] }), 'lunes', '10:30').alumnos).toEqual([]);
  });

  it('no muestra a un inactivo sin fecha de baja (salvo que tenga asistencia)', () => {
    const h = horario('Alumna A', 'lunes', '10:30', { activo: false, fecha_baja: null });
    expect(celda(armar({ horarios: [h] }), 'lunes', '10:30').alumnos).toEqual([]);
  });

  it('usa la asistencia registrada del fijo', () => {
    const c = clase('2026-10-19', '10:30:00');
    const a = asistencia(c, 'Alumna A', 'presente');
    const semana = armar({ horarios: [horario('Alumna A', 'lunes', '10:30:00')], clases: [c], asistencias: [a] });
    const celdaLunes = celda(semana, 'lunes', '10:30');
    expect(celdaLunes.clase).toBe(c);
    expect(celdaLunes.alumnos).toEqual([
      { pacienteId: 'pac-Alumna A', nombre: 'Alumna A', estado: 'presente', asistencia: a, esFijo: true, tipo: 'fijo' },
    ]);
  });

  it('suma a quien tiene asistencia sin ser fijo, después de los fijos', () => {
    const c = clase('2026-10-19', '10:30');
    const semana = armar({
      horarios: [horario('Zulema', 'lunes', '10:30')],
      clases: [c],
      asistencias: [asistencia(c, 'Ana', 'pendiente', { tipo: 'recupera' })],
    });
    const alumnos = celda(semana, 'lunes', '10:30').alumnos;
    expect(alumnos.map((a) => [a.nombre, a.esFijo, a.tipo, a.estado])).toEqual([
      ['Zulema', true, 'fijo', 'pendiente'],
      ['Ana', false, 'recupera', 'pendiente'],
    ]);
  });

  it('ordena a los fijos por nombre', () => {
    const semana = armar({
      horarios: [horario('Carla', 'lunes', '10:30'), horario('Ana', 'lunes', '10:30'), horario('Beto', 'lunes', '10:30')],
    });
    expect(celda(semana, 'lunes', '10:30').alumnos.map((a) => a.nombre)).toEqual(['Ana', 'Beto', 'Carla']);
  });

  it('no duplica la fila del horario cuando la base devuelve "HH:mm:ss"', () => {
    const c = clase('2026-10-19', '10:30:00');
    const semana = armar({ horarios: [horario('Alumna A', 'lunes', '10:30:00')], clases: [c] });
    expect(semana.lunes.filter((x) => x.hora.startsWith('10:30'))).toHaveLength(1);
  });

  it('agrega un horario fuera de los habituales solo si tiene fijos de esa fecha o una clase', () => {
    const conFijo = armar({ horarios: [horario('Alumna A', 'lunes', '08:00:00')] });
    expect(celda(conFijo, 'lunes', '08:00').enHorarioHabitual).toBe(false);
    expect(conFijo.lunes[0].hora).toBe('08:00'); // ordenado antes de las 10:30

    const conClase = armar({ clases: [clase('2026-10-21', '09:00:00')] });
    expect(celda(conClase, 'miercoles', '09:00').enHorarioHabitual).toBe(false);

    const exFijo = horario('Alumna A', 'lunes', '08:00', { activo: false, fecha_baja: '2026-10-10' });
    expect(armar({ horarios: [exFijo] }).lunes.some((c) => c.hora === '08:00')).toBe(false);
  });

  it('fijosActuales tiene a los activos de hoy, aunque su alta sea posterior a esa semana', () => {
    const nuevo = horario('Alumna A', 'lunes', '10:30', { fecha_alta: '2026-10-26' });
    const celdaLunes = celda(armar({ horarios: [nuevo] }), 'lunes', '10:30');
    expect(celdaLunes.alumnos).toEqual([]);
    expect(celdaLunes.fijosActuales).toEqual([nuevo]);
  });

  it('no mezcla clases de otra fecha', () => {
    const otraSemana = clase('2026-10-26', '10:30');
    const semana = armar({
      clases: [otraSemana],
      asistencias: [asistencia(otraSemana, 'Alumna A', 'presente')],
    });
    expect(celda(semana, 'lunes', '10:30').clase).toBeNull();
    expect(celda(semana, 'lunes', '10:30').alumnos).toEqual([]);
  });
});

describe('armarSemanaTPA: lugares', () => {
  const fijos = (...nombres: string[]) => nombres.map((n) => horario(n, 'lunes', '10:30'));

  it('cuenta los fijos que no avisaron y muestra los libres', () => {
    const c = clase('2026-10-19', '10:30');
    const semana = armar({
      horarios: fijos('A', 'B', 'C', 'D'),
      clases: [c],
      asistencias: [asistencia(c, 'B', 'aviso_con_tiempo', { avisado_at: '2026-10-17T12:00:00Z' })],
    });
    expect(celda(semana, 'lunes', '10:30').lugares).toEqual({ ocupados: 3, libres: 1, excedidos: 0, cancelada: false });
  });

  it('un horario sin fijos tiene todos los lugares libres', () => {
    expect(celda(armar({}), 'lunes', '10:30').lugares).toEqual({ ocupados: 0, libres: 4, excedidos: 0, cancelada: false });
  });

  it('pone a quien ocupa el lugar de un fijo justo debajo de él', () => {
    const c = clase('2026-10-19', '10:30');
    const avisoB = asistencia(c, 'Beto', 'aviso_sin_tiempo', { avisado_at: '2026-10-19T10:00:00Z' });
    const semana = armar({
      horarios: fijos('Ana', 'Beto', 'Carla'),
      clases: [c],
      asistencias: [
        avisoB,
        asistencia(c, 'Zoe', 'pendiente', { tipo: 'suelta' }),
        asistencia(c, 'Abril', 'pendiente', { tipo: 'recupera', ocupa_lugar_de: avisoB.id }),
      ],
    });
    const lunes = celda(semana, 'lunes', '10:30');
    expect(lunes.alumnos.map((a) => a.nombre)).toEqual(['Ana', 'Beto', 'Abril', 'Carla', 'Zoe']);
    // Ana, Abril (en el lugar de Beto), Carla y Zoe (lugar libre) = 4/4
    expect(lunes.lugares).toEqual({ ocupados: 4, libres: 0, excedidos: 0, cancelada: false });
  });

  it('una clase cancelada no tiene lugares', () => {
    const c = clase('2026-10-19', '10:30', 'feriado');
    const lunes = celda(armar({ horarios: fijos('A', 'B'), clases: [c] }), 'lunes', '10:30');
    expect(lunes.lugares).toEqual({ ocupados: 0, libres: 0, excedidos: 0, cancelada: true });
    expect(lunes.alumnos).toHaveLength(2);
  });
});

describe('contarLugares', () => {
  const fijo = (estado: string) => ({ tipo: 'fijo' as const, estado });
  const ocupa = (estado: string) => ({ tipo: 'recupera' as const, estado });

  it('4 fijos, 1 avisó, nadie en su lugar → 3/4 · 1 libre', () => {
    const lugares = contarLugares([fijo('presente'), fijo('aviso_con_tiempo'), fijo('pendiente'), fijo('presente')], 4);
    expect(lugares).toEqual({ ocupados: 3, libres: 1, excedidos: 0, cancelada: false });
    expect(textoLugares(lugares, 4)).toBe('3/4 · 1 libre');
  });

  it('4 fijos, 1 avisó y alguien recupera → 4/4', () => {
    const lugares = contarLugares(
      [fijo('presente'), fijo('aviso_sin_tiempo'), fijo('presente'), fijo('presente'), ocupa('pendiente')], 4,
    );
    expect(lugares).toEqual({ ocupados: 4, libres: 0, excedidos: 0, cancelada: false });
    expect(textoLugares(lugares, 4)).toBe('4/4');
  });

  it('"No avisó" y "Sin marcar" ocupan: el lugar estaba reservado', () => {
    expect(contarLugares([fijo('falto_sin_avisar'), fijo('pendiente')], 4).ocupados).toBe(2);
  });

  it('quien viene a ocupar cuenta en cualquier estado, también si no vino', () => {
    expect(contarLugares([ocupa('pendiente'), ocupa('presente'), ocupa('falto_sin_avisar')], 4).ocupados).toBe(3);
  });

  it('un estado desconocido de un fijo cuenta como ocupado', () => {
    expect(contarLugares([fijo('estado_futuro')], 4).ocupados).toBe(1);
  });

  it('más personas que lugares → 5/4 y 1 de más, sin bloquear', () => {
    const lugares = contarLugares([fijo('presente'), fijo('presente'), fijo('presente'), fijo('presente'), ocupa('pendiente')], 4);
    expect(lugares).toEqual({ ocupados: 5, libres: 0, excedidos: 1, cancelada: false });
    expect(textoLugares(lugares, 4)).toBe('5/4 · 1 de más');
  });

  it('plural de libres', () => {
    expect(textoLugares(contarLugares([fijo('presente')], 4), 4)).toBe('1/4 · 3 libres');
  });

  it('clase cancelada: sin lugares ni texto', () => {
    const lugares = contarLugares([fijo('presente')], 4, true);
    expect(lugares).toEqual({ ocupados: 0, libres: 0, excedidos: 0, cancelada: true });
    expect(textoLugares(lugares, 4)).toBeNull();
  });
});

describe('eraFijoEn', () => {
  const h = (extra: Partial<HorarioTPA>) => ({ activo: true, fecha_alta: '2026-10-12', fecha_baja: null, ...extra });

  it('desde la fecha de alta inclusive', () => {
    expect(eraFijoEn(h({}), '2026-10-11')).toBe(false);
    expect(eraFijoEn(h({}), '2026-10-12')).toBe(true);
    expect(eraFijoEn(h({}), '2027-01-04')).toBe(true);
  });

  it('alta a futuro: todavía no es fijo', () => {
    expect(eraFijoEn(h({ fecha_alta: '2026-11-02' }), '2026-10-26')).toBe(false);
    expect(eraFijoEn(h({ fecha_alta: '2026-11-02' }), '2026-11-02')).toBe(true);
  });

  it('dado de baja: hasta el día anterior a la baja', () => {
    const baja = h({ activo: false, fecha_baja: '2026-10-21' });
    expect(eraFijoEn(baja, '2026-10-19')).toBe(true);
    expect(eraFijoEn(baja, '2026-10-21')).toBe(false);
  });

  it('alta a futuro desinscripta antes de empezar (baja = alta): nunca fue fijo', () => {
    const nunca = h({ activo: false, fecha_alta: '2026-11-02', fecha_baja: '2026-11-02' });
    expect(['2026-10-26', '2026-11-02', '2026-11-09'].some((f) => eraFijoEn(nunca, f))).toBe(false);
  });

  it('inactivo sin fecha de baja (datos viejos): no es fijo', () => {
    expect(eraFijoEn(h({ activo: false }), '2026-10-19')).toBe(false);
  });
});

describe('diaTPAInicial', () => {
  const caso = (fecha: string) => {
    const { semana, dia } = diaTPAInicial(parseISO(fecha));
    return [semana.toDateString(), dia];
  };

  it('abre en el día de hoy si hay TPA', () => {
    expect(caso('2026-10-21')).toEqual([parseISO('2026-10-19').toDateString(), 'miercoles']);
  });

  it('un martes o jueves abre en el próximo día de TPA de la misma semana', () => {
    expect(caso('2026-10-20')[1]).toBe('miercoles');
    expect(caso('2026-10-22')[1]).toBe('viernes');
  });

  it('el fin de semana abre en el lunes siguiente', () => {
    expect(caso('2026-10-24')).toEqual([parseISO('2026-10-26').toDateString(), 'lunes']);
    expect(caso('2026-10-25')).toEqual([parseISO('2026-10-26').toDateString(), 'lunes']);
  });
});

describe('diaSemanaDeFecha y celdasEntre', () => {
  it('día de TPA de una fecha', () => {
    expect(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-23', '2026-10-25'].map(diaSemanaDeFecha))
      .toEqual(['lunes', null, 'miercoles', 'viernes', null]);
  });

  it('arma las celdas de un rango que cruza semanas y meses', () => {
    const celdas = celdasEntre('2026-10-30', '2026-11-02', { horarios: [], clases: [], asistencias: [] });
    expect([...new Set(celdas.map((c) => c.fecha))]).toEqual(['2026-10-30', '2026-11-02']);
    expect(celdas.filter((c) => c.fecha === '2026-10-30')).toHaveLength(HORARIOS_TPA.viernes.length);
  });
});
