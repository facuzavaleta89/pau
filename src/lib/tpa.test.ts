import { describe, expect, it } from 'vitest';
import { parseISO } from 'date-fns';
import type { AsistenciaTPA, ClaseTPA, DiaSemana, HorarioTPA } from '@/types';
import { armarSemanaTPA, diaTPAInicial, HORARIOS_TPA, type DatosSemanaTPA } from './tpa';

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
    fecha_baja: null,
    created_at: '2026-10-01T12:00:00+00:00',
    pacientes: { nombre },
    ...extra,
  };
}

function clase(fecha: string, hora: string): ClaseTPA {
  return { id: id(), fecha, hora, created_at: '2026-10-01T12:00:00+00:00' };
}

function asistencia(c: ClaseTPA, nombre: string, estado: AsistenciaTPA['estado']): AsistenciaTPA {
  return {
    id: id(), clase_id: c.id, paciente_id: `pac-${nombre}`, estado, nota: null,
    created_at: '2026-10-01T12:00:00+00:00', pacientes: { nombre },
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
      { pacienteId: 'pac-Alumna A', nombre: 'Alumna A', estado: 'pendiente', asistencia: null, esFijo: true },
    ]);
    // Solo en su día y hora
    expect(celda(semana, 'miercoles', '10:30').alumnos).toEqual([]);
    expect(celda(semana, 'lunes', '11:30').alumnos).toEqual([]);
  });

  it('no muestra a un fijo en las semanas anteriores a su inscripción', () => {
    const h = horario('Alumna A', 'lunes', '10:30', { created_at: '2026-10-20T15:00:00+00:00' });
    expect(celda(armar({ horarios: [h] }), 'lunes', '10:30').alumnos).toEqual([]);
  });

  it('usa el día de la inscripción en hora de Argentina, no en UTC', () => {
    // 20/10 01:00 UTC = 19/10 22:00 en Argentina: ya era fijo el lunes 19.
    const h = horario('Alumna A', 'lunes', '10:30', { created_at: '2026-10-20T01:00:00+00:00' });
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
      { pacienteId: 'pac-Alumna A', nombre: 'Alumna A', estado: 'presente', asistencia: a, esFijo: true },
    ]);
  });

  it('suma a quien tiene asistencia sin ser fijo, después de los fijos', () => {
    const c = clase('2026-10-19', '10:30');
    const semana = armar({
      horarios: [horario('Zulema', 'lunes', '10:30')],
      clases: [c],
      asistencias: [asistencia(c, 'Ana', 'recupera')],
    });
    const alumnos = celda(semana, 'lunes', '10:30').alumnos;
    expect(alumnos.map((a) => [a.nombre, a.esFijo, a.estado])).toEqual([
      ['Zulema', true, 'pendiente'],
      ['Ana', false, 'recupera'],
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

  it('fijosActuales tiene a los activos de hoy, aunque se hayan inscripto después de esa semana', () => {
    const nuevo = horario('Alumna A', 'lunes', '10:30', { created_at: '2026-10-25T12:00:00+00:00' });
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
