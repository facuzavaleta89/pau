import { describe, expect, it } from 'vitest';
import { parseISO } from 'date-fns';
import type { AsistenciaTPA, ClaseTPA, DiaSemana, HorarioTPA, SesionRPG } from '@/types';
import {
  armarMesAgenda, armarSemanaAgenda, bloqueDeHora, eventosEntre, horasDelDia, rangoVista, resumenTPA, textoResumenTPA,
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

function clase(fecha: string, hora: string, motivo: ClaseTPA['motivo_cancelacion'] = null): ClaseTPA {
  return { id: id(), fecha, hora, motivo_cancelacion: motivo, created_at: '2026-10-01T12:00:00+00:00' };
}

function datos(extra: { sesiones?: SesionRPG[]; horarios?: HorarioTPA[]; clases?: ClaseTPA[]; asistencias?: AsistenciaTPA[] } = {}): DatosAgenda {
  return {
    sesiones: extra.sesiones ?? [],
    tpa: { horarios: extra.horarios ?? [], clases: extra.clases ?? [], asistencias: extra.asistencias ?? [], notas: [] },
  };
}

const TODAS_LAS_CLASES_DE_LA_SEMANA = HORARIOS_TPA.lunes.length + HORARIOS_TPA.miercoles.length + HORARIOS_TPA.viernes.length;

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

describe('armarSemanaAgenda', () => {
  it('arma los 7 días de lunes a domingo aunque se pida un día del medio', () => {
    const semana = armarSemanaAgenda(parseISO('2026-11-19'), datos());
    expect(semana.dias.map((d) => d.fecha)).toEqual([
      '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22',
    ]);
  });

  it('pone cada turno en su día, incluidos martes, jueves y fin de semana', () => {
    const semana = armarSemanaAgenda(parseISO('2026-11-16'), datos({
      sesiones: [turno('2026-11-17', '09:00', 'Ana'), turno('2026-11-22', '11:00', 'Bea', 'Clase domicilio')],
    }));
    const martes = semana.dias[1].eventos;
    const domingo = semana.dias[6].eventos;
    expect(martes).toHaveLength(1);
    expect(domingo.map((e) => e.tipo === 'turno' && e.turno.tipo_sesion)).toEqual(['Clase domicilio']);
  });

  it('un día sin nada queda con la lista vacía', () => {
    const semana = armarSemanaAgenda(parseISO('2026-11-16'), datos());
    expect(semana.dias[3].eventos).toEqual([]); // jueves
    expect(semana.dias.flatMap((d) => d.eventos)).toHaveLength(TODAS_LAS_CLASES_DE_LA_SEMANA);
  });

  it('las filas de la grilla son las horas con algo, sin repetir y ordenadas', () => {
    const semana = armarSemanaAgenda(parseISO('2026-11-16'), datos({
      sesiones: [turno('2026-11-17', '08:15', 'Ana'), turno('2026-11-19', '10:00', 'Bea')],
    }));
    expect(semana.horas).toEqual(['08', '10', '11', '12', '16', '17', '18', '19']);
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

describe('armarMesAgenda', () => {
  const NOV = parseISO('2026-11-10');

  it('arma semanas completas de lunes a domingo con los días de relleno', () => {
    const mes = armarMesAgenda(NOV, datos());
    expect(mes.every((s) => s.length === 7)).toBe(true);
    expect(mes[0][0]).toMatchObject({ fecha: '2026-10-26', delMes: false });
    expect(mes[0][6]).toMatchObject({ fecha: '2026-11-01', delMes: true });
    expect(mes.at(-1)?.at(-1)?.fecha).toBe('2026-12-06');
  });

  it('muestra 3 turnos por día y cuenta el resto en "+N más"', () => {
    const seis = ['15:00', '09:00', '10:00', '11:00', '12:00', '13:00'].map((h, i) => turno('2026-11-17', h, `P${i}`));
    const dia = armarMesAgenda(NOV, datos({ sesiones: seis })).flat().find((d) => d.fecha === '2026-11-17');
    expect(dia?.turnos.map((t) => t.hora)).toEqual(['09:00', '10:00', '11:00']);
    expect(dia?.masTurnos).toBe(3);
  });

  it('con 3 turnos o menos no hay "+N más"', () => {
    const tres = ['09:00', '10:00', '11:00'].map((h, i) => turno('2026-11-17', h, `P${i}`));
    const dia = armarMesAgenda(NOV, datos({ sesiones: tres })).flat().find((d) => d.fecha === '2026-11-17');
    expect(dia?.turnos).toHaveLength(3);
    expect(dia?.masTurnos).toBe(0);
  });

  it('un día sin nada no tiene turnos ni resumen de TPA', () => {
    const mes = armarMesAgenda(NOV, datos()).flat();
    expect(mes.find((d) => d.fecha === '2026-11-19')).toEqual({ fecha: '2026-11-19', delMes: true, turnos: [], masTurnos: 0, tpa: null });
    // Un lunes con todas las clases vacías tampoco muestra la línea de TPA.
    expect(mes.find((d) => d.fecha === '2026-11-16')?.tpa).toBeNull();
  });

  it('resume las clases con alumnos del día y sus lugares libres', () => {
    const horarios = [
      horario('Ana', 'lunes', '10:30'), horario('Bea', 'lunes', '10:30'),
      horario('Ceci', 'lunes', '17:00'), horario('Dani', 'lunes', '17:00'), horario('Eli', 'lunes', '17:00'), horario('Flor', 'lunes', '17:00'),
    ];
    const dia = armarMesAgenda(NOV, datos({ horarios })).flat().find((d) => d.fecha === '2026-11-16');
    expect(dia?.tpa).toEqual({ clases: 2, libres: 2, canceladas: 0 });
    expect(textoResumenTPA(dia!.tpa!)).toBe('TPA: 2 clases · 2 libres');
  });

  it('cuenta aparte las clases canceladas', () => {
    const dia = armarMesAgenda(NOV, datos({
      horarios: [horario('Ana', 'viernes', '10:30')],
      clases: [clase('2026-11-20', '10:30', 'feriado')],
    })).flat().find((d) => d.fecha === '2026-11-20');
    expect(dia?.tpa).toEqual({ clases: 0, libres: 0, canceladas: 1 });
    expect(textoResumenTPA(dia!.tpa!)).toBe('TPA: 1 cancelada');
  });
});

describe('resumenTPA y textoResumenTPA', () => {
  it('sin clases con alumnos devuelve null', () => {
    expect(resumenTPA([])).toBeNull();
  });

  it('dice "completa" cuando no queda ningún lugar', () => {
    expect(textoResumenTPA({ clases: 1, libres: 0, canceladas: 0 })).toBe('TPA: 1 clase · completa');
    expect(textoResumenTPA({ clases: 5, libres: 3, canceladas: 2 })).toBe('TPA: 5 clases · 3 libres · 2 canceladas');
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
