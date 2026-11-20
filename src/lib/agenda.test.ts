import { describe, expect, it } from 'vitest';
import { parseISO } from 'date-fns';
import type { AsistenciaTPA, ClaseTPA, DiaSemana, HorarioTPA, SesionRPG } from '@/types';
import {
  armarMesAgenda, armarSemanaAgenda, bloqueDeHora, eventosEntre, horasDelDia, rangoVista, turnosEntre,
  type DatosAgenda,
} from './agenda';
import { HORARIOS_TPA } from './tpa';

// Semana del lunes 16/11/2026 (mié 18, vie 20). Noviembre 2026 empieza en domingo.
let contador = 0;
const id = () => `id-${++contador}`;

function turno(fecha: string, hora: string, nombre: string, tipo_sesion = 'RPG'): SesionRPG {
  return {
    id: id(), paciente_id: `pac-${nombre}`, fecha, hora, tipo_sesion, estado_pago: 'pendiente', estado_sesion: 'pendiente',
    nota: null, created_at: '2026-11-01T12:00:00+00:00', pacientes: { nombre, telefono: null },
  };
}

function horario(nombre: string, dia: DiaSemana, hora: string): HorarioTPA {
  return {
    id: id(), paciente_id: `pac-${nombre}`, dia_semana: dia, hora, activo: true, fecha_alta: '2026-10-01', fecha_baja: null,
    created_at: '2026-10-01T12:00:00+00:00', pacientes: { nombre },
  };
}

function datos(extra: { sesiones?: SesionRPG[]; horarios?: HorarioTPA[]; clases?: ClaseTPA[]; asistencias?: AsistenciaTPA[] } = {}): DatosAgenda {
  return {
    sesiones: extra.sesiones ?? [],
    tpa: { horarios: extra.horarios ?? [], clases: extra.clases ?? [], asistencias: extra.asistencias ?? [], notas: [] },
  };
}

describe('eventosEntre', () => {
  it('ordena por fecha y hora, con el turno antes que la clase a la misma hora', () => {
    const eventos = eventosEntre('2026-11-16', '2026-11-16', datos({
      sesiones: [turno('2026-11-16', '17:00', 'Zoe'), turno('2026-11-16', '09:00', 'Ana'), turno('2026-11-16', '10:30', 'Bea')],
    }));
    expect(eventos.slice(0, 3).map((e) => `${e.hora} ${e.tipo}`)).toEqual(['09:00 turno', '10:30 turno', '10:30 clase']);
    expect(eventos.filter((e) => e.tipo === 'clase')).toHaveLength(HORARIOS_TPA.lunes.length);
  });

  it('deja afuera los turnos de otras fechas', () => {
    const eventos = eventosEntre('2026-11-17', '2026-11-17', datos({ sesiones: [turno('2026-11-16', '09:00', 'Ana')] }));
    expect(eventos).toEqual([]); // martes: sin turnos y sin TPA
  });

  it('marca como vacía la clase sin alumnos y no la que tiene un fijo', () => {
    const eventos = eventosEntre('2026-11-16', '2026-11-16', datos({ horarios: [horario('Ana', 'lunes', '17:00')] }));
    const clases = eventos.flatMap((e) => (e.tipo === 'clase' ? [e] : []));
    expect(clases.find((c) => c.hora === '17:00')?.vacia).toBe(false);
    expect(clases.find((c) => c.hora === '10:30')?.vacia).toBe(true);
  });
});

describe('armarSemanaAgenda (solo turnos individuales)', () => {
  it('arma los 7 días de lunes a domingo aunque se pida un día del medio', () => {
    const semana = armarSemanaAgenda(parseISO('2026-11-19'), []);
    expect(semana.map((d) => d.fecha)).toEqual([
      '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22',
    ]);
  });

  it('pone cada turno en su día, incluidos martes, jueves y fin de semana, en orden de hora', () => {
    const semana = armarSemanaAgenda(parseISO('2026-11-16'), [
      turno('2026-11-17', '11:00', 'Bea'), turno('2026-11-17', '09:00', 'Ana'),
      turno('2026-11-22', '11:00', 'Ceci', 'Clase domicilio'), turno('2026-11-23', '09:00', 'Otra semana'),
    ]);
    expect(semana[1].turnos.map((t) => t.hora)).toEqual(['09:00', '11:00']);
    expect(semana[6].turnos.map((t) => t.tipo_sesion)).toEqual(['Clase domicilio']);
    expect(semana.flatMap((d) => d.turnos)).toHaveLength(3);
  });

  it('no trae clases de TPA: un lunes con fijos y sin turnos queda vacío', () => {
    const semana = armarSemanaAgenda(parseISO('2026-11-16'), []);
    expect(semana[0]).toEqual({ fecha: '2026-11-16', turnos: [] });
  });
});

describe('turnosEntre', () => {
  it('ordena por fecha, hora y nombre y deja afuera lo que está fuera del rango', () => {
    const t = turnosEntre('2026-11-16', '2026-11-17', [
      turno('2026-11-17', '09:00', 'Zoe'), turno('2026-11-17', '09:00', 'Ana'), turno('2026-11-16', '18:00', 'Bea'),
      turno('2026-11-18', '08:00', 'Fuera'),
    ]);
    expect(t.map((x) => `${x.fecha} ${x.hora} ${x.pacientes?.nombre}`)).toEqual([
      '2026-11-16 18:00 Bea', '2026-11-17 09:00 Ana', '2026-11-17 09:00 Zoe',
    ]);
  });
});

describe('horasDelDia', () => {
  it('muestra de 8 a 20 y agrega las horas fuera de ese rango', () => {
    expect(horasDelDia([])).toHaveLength(13);
    const eventos = eventosEntre('2026-11-17', '2026-11-17', datos({ sesiones: [turno('2026-11-17', '07:30', 'Ana')] }));
    expect(horasDelDia(eventos)[0]).toBe('07');
    expect(bloqueDeHora('21:45')).toBe('21');
  });
});

describe('armarMesAgenda (solo turnos individuales)', () => {
  const NOV = parseISO('2026-11-10');

  it('arma semanas completas de lunes a domingo con los días de relleno', () => {
    const mes = armarMesAgenda(NOV, []);
    expect(mes.every((s) => s.length === 7)).toBe(true);
    expect(mes[0][0]).toMatchObject({ fecha: '2026-10-26', delMes: false });
    expect(mes[0][6]).toMatchObject({ fecha: '2026-11-01', delMes: true });
    expect(mes.at(-1)?.at(-1)?.fecha).toBe('2026-12-06');
  });

  it('muestra 3 turnos por día y cuenta el resto en "+N más"', () => {
    const seis = ['15:00', '09:00', '10:00', '11:00', '12:00', '13:00'].map((h, i) => turno('2026-11-17', h, `P${i}`));
    const dia = armarMesAgenda(NOV, seis).flat().find((d) => d.fecha === '2026-11-17');
    expect(dia?.turnos.map((t) => t.hora)).toEqual(['09:00', '10:00', '11:00']);
    expect(dia?.masTurnos).toBe(3);
  });

  it('con 3 turnos o menos no hay "+N más"', () => {
    const tres = ['09:00', '10:00', '11:00'].map((h, i) => turno('2026-11-17', h, `P${i}`));
    const dia = armarMesAgenda(NOV, tres).flat().find((d) => d.fecha === '2026-11-17');
    expect(dia?.turnos).toHaveLength(3);
    expect(dia?.masTurnos).toBe(0);
  });

  it('un día sin turnos queda vacío (sin resumen de TPA, aunque sea lunes)', () => {
    const mes = armarMesAgenda(NOV, []).flat();
    expect(mes.find((d) => d.fecha === '2026-11-19')).toEqual({ fecha: '2026-11-19', delMes: true, turnos: [], masTurnos: 0 });
    expect(mes.find((d) => d.fecha === '2026-11-16')).toEqual({ fecha: '2026-11-16', delMes: true, turnos: [], masTurnos: 0 });
  });
});

describe('rangoVista', () => {
  const JUEVES = parseISO('2026-11-19');
  it('carga solo lo que se ve', () => {
    expect(rangoVista('dia', JUEVES)).toEqual({ desde: '2026-11-19', hasta: '2026-11-19' });
    expect(rangoVista('semana', JUEVES)).toEqual({ desde: '2026-11-16', hasta: '2026-11-22' });
    expect(rangoVista('mes', JUEVES)).toEqual({ desde: '2026-10-26', hasta: '2026-12-06' });
  });
});
