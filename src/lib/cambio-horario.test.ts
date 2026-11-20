import { describe, expect, it } from 'vitest';
import type {
  AsistenciaTPA, ClaseTPA, DiaSemana, EstadoAsistenciaTPA, HorarioTPA, MotivoCancelacionTPA, PreciosMes, TipoAsistenciaTPA,
} from '@/types';
import { conflictoDestino, conflictoFechaCambio, destinosParaCambiar, type DatosHorarios } from './horarios';
import { calendarioDelMes, cuotasDelMes, fijosDelMes } from './pagos';
import { calcularRecuperaciones, type DatosRecuperaciones } from './recuperaciones';
import { HORARIOS_TPA } from './tpa';

// "Cambiar de horario" (Pau, 20/11/2026). Caso real: fija de los lunes 16:00
// que pasa a los lunes 18:00 desde el lunes 16/11. Noviembre 2026: lunes 2,
// 9, 16, 23, 30; miércoles 4, 11, 18, 25. Hoy: vie 20/11.
const HOY = '2026-11-20';
const NOV: PreciosMes = { mes: '2026-11-01', tpa_1_vez: 50000, tpa_2_veces: 80000, tpa_3_veces: 110000, tpa_suelta: 18000, rpg_sesion: 46000 };

let contador = 0;
const id = () => `id-${++contador}`;

function horario(nombre: string, dia: DiaSemana, hora: string, extra: Partial<HorarioTPA> = {}): HorarioTPA {
  return {
    id: id(), paciente_id: `pac-${nombre}`, dia_semana: dia, hora, activo: true,
    fecha_alta: '2026-09-01', fecha_baja: null, created_at: '2026-09-01T12:00:00Z', pacientes: { nombre },
    ...extra,
  };
}

/** El cambio ya hecho: el viejo cerrado en `desde` y el nuevo abierto en `desde`. */
function cambio(nombre: string, de: [DiaSemana, string], a: [DiaSemana, string], desde: string, altaVieja = '2026-09-01') {
  return [
    horario(nombre, de[0], de[1], { activo: false, fecha_alta: altaVieja, fecha_baja: desde }),
    horario(nombre, a[0], a[1], { fecha_alta: desde }),
  ];
}

function clase(fecha: string, hora: string, motivo: MotivoCancelacionTPA | null = null): ClaseTPA {
  return { id: `clase-${fecha}-${hora}`, fecha, hora, motivo_cancelacion: motivo, created_at: '2026-11-01T12:00:00Z' };
}

function fila(nombre: string, c: ClaseTPA, estado: EstadoAsistenciaTPA, tipo: TipoAsistenciaTPA = 'fijo'): AsistenciaTPA {
  return {
    id: id(), clase_id: c.id, paciente_id: `pac-${nombre}`, estado, tipo, ocupa_lugar_de: null, cambio_de: null,
    avisado_at: estado.startsWith('aviso') ? '2026-11-01T12:00:00Z' : null,
    created_at: '2026-11-01T12:00:00Z', updated_at: '2026-11-01T12:00:00Z',
  };
}

function datos(horarios: HorarioTPA[], clases: ClaseTPA[] = [], asistencias: AsistenciaTPA[] = []): DatosHorarios {
  return {
    horarios, clases, asistencias, notas: [], pagos: [],
    recuperaciones: { horarios: horarios.filter((h) => h.paciente_id === 'pac-Ana'), clasesCanceladas: [], asistencias: [] },
  };
}

describe('Cambiar de horario: la cuota del mes del cambio no cambia', () => {
  it('lun 16:00 → lun 18:00 desde el 16/11: 1 vez por semana, no es alta a mitad de mes, cuota del plan', () => {
    const horarios = cambio('Ana', ['lunes', '16:00'], ['lunes', '18:00'], '2026-11-16');
    const [fijo] = fijosDelMes(horarios, '2026-11');
    expect(fijo).toMatchObject({ vecesPorSemana: 1, altaEnElMes: false, desde: null, baja: null, clases: 5 });
    const [c] = cuotasDelMes(horarios, [], '2026-11', NOV);
    expect(c).toMatchObject({ veces: 1, importePendiente: 50000 });
  });

  it('igual si el horario viejo también empezó este mes con todas sus clases (alta lun 2/11)', () => {
    const horarios = cambio('Ana', ['lunes', '16:00'], ['lunes', '18:00'], '2026-11-16', '2026-11-02');
    const [fijo] = fijosDelMes(horarios, '2026-11');
    expect(fijo).toMatchObject({ vecesPorSemana: 1, altaEnElMes: false });
    expect(cuotasDelMes(horarios, [], '2026-11', NOV)[0].importePendiente).toBe(50000);
  });

  it('a otro día (lun 16:00 → mié 18:00 desde el mié 18/11) tampoco cuenta como 2 veces por semana', () => {
    const horarios = cambio('Ana', ['lunes', '16:00'], ['miercoles', '18:00'], '2026-11-18');
    const [fijo] = fijosDelMes(horarios, '2026-11');
    // lun 2, 9, 16 + mié 18, 25
    expect(fijo).toMatchObject({ vecesPorSemana: 1, altaEnElMes: false, baja: null, clases: 5 });
  });

  it('el mes siguiente solo cuenta el horario nuevo, sin alta ni baja', () => {
    const horarios = cambio('Ana', ['lunes', '16:00'], ['lunes', '18:00'], '2026-11-16');
    const [fijo] = fijosDelMes(horarios, '2026-12');
    expect(fijo.horarios.map((h) => h.horario.hora)).toEqual(['18:00']);
    expect(fijo).toMatchObject({ vecesPorSemana: 1, altaEnElMes: false, desde: null, baja: null });
  });

  it('un alta a mitad de mes de verdad (sin horario anterior) sigue cobrándose por clase', () => {
    const nuevo = horario('Ana', 'lunes', '18:00', { fecha_alta: '2026-11-16' });
    expect(fijosDelMes([nuevo], '2026-11')[0].altaEnElMes).toBe(true);
    expect(cuotasDelMes([nuevo], [], '2026-11', NOV)[0].importePendiente).toBe(3 * 18000);
  });
});

describe('Cambiar de horario: calendario del mes', () => {
  it('se ve en los dos horarios: "baja 16/11" en el viejo y "desde 16/11" en el nuevo', () => {
    const horarios = cambio('Ana', ['lunes', '16:00'], ['lunes', '18:00'], '2026-11-16');
    const filas = calendarioDelMes(horarios, [], '2026-11');
    const lugarDe = (hora: string) => filas.find((f) => f.hora === hora)?.celdas.lunes?.lugares[0];
    expect(lugarDe('16:00')).toMatchObject({ tipo: 'fijo', nombre: 'Ana', baja: '2026-11-16', desde: null });
    expect(lugarDe('18:00')).toMatchObject({ tipo: 'fijo', nombre: 'Ana', desde: '2026-11-16', baja: null });
    // Fijos de hoy: solo en el nuevo.
    expect(filas.find((f) => f.hora === '16:00')?.celdas.lunes?.fijosActuales).toEqual([]);
    expect(filas.find((f) => f.hora === '18:00')?.celdas.lunes?.fijosActuales.map((h) => h.paciente_id)).toEqual(['pac-Ana']);
  });
});

describe('Cambiar de horario: recuperaciones', () => {
  const horarios = cambio('Ana', ['lunes', '16:00'], ['lunes', '18:00'], '2026-11-16');
  const aviso = fila('Ana', clase('2026-11-09', '16:00'), 'aviso_con_tiempo');
  const conClase = (a: AsistenciaTPA, c: ClaseTPA) => ({ ...a, clases_tpa: c });
  const base = (extra: Partial<DatosRecuperaciones> = {}): DatosRecuperaciones => ({
    horarios, clasesCanceladas: [], asistencias: [conClase(aviso, clase('2026-11-09', '16:00'))], ...extra,
  });
  const saldo = (d: DatosRecuperaciones) => calcularRecuperaciones('2026-11', d, HOY).find((s) => s.pacienteId === 'pac-Ana');

  it('tope de 1 por mes (no 2) y el aviso de antes del cambio sigue valiendo', () => {
    const s = saldo(base());
    expect(s?.frecuencia).toBe(1);
    expect(s?.pendientes.map((c) => c.id)).toEqual(['aviso_con_tiempo_2026-11-09_16:00']);
  });

  it('una clase cancelada por Pau del horario viejo después del cambio no le cuenta; la del nuevo, sí', () => {
    const s = saldo(base({
      clasesCanceladas: [clase('2026-11-23', '16:00', 'cancelada_por_pau'), clase('2026-11-30', '18:00', 'cancelada_por_pau')],
    }));
    expect(s?.pendientes.map((c) => c.id).sort()).toEqual(['aviso_con_tiempo_2026-11-09_16:00', 'cancelada_por_pau_2026-11-30_18:00']);
  });

  it('feriado: cuenta las clases de los dos horarios (5 en el mes), igual que si no hubiera cambiado', () => {
    const feriado = [clase('2026-11-23', '18:00', 'feriado')];
    const conCambio = saldo(base({ clasesCanceladas: feriado }));
    const sinCambio = saldo({
      horarios: [horario('Ana', 'lunes', '18:00')], clasesCanceladas: feriado,
      asistencias: [conClase({ ...aviso }, clase('2026-11-09', '18:00'))],
    });
    // 5 lunes − 1 feriado = 4 clases: no recupera el feriado, con o sin cambio.
    expect(conCambio?.pendientes.filter((c) => c.origen === 'feriado')).toEqual([]);
    expect(sinCambio?.pendientes.filter((c) => c.origen === 'feriado')).toEqual([]);
    expect(conCambio?.frecuencia).toBe(sinCambio?.frecuencia);
  });
});

describe('conflictoFechaCambio', () => {
  const viejo = horario('Ana', 'lunes', '16:00', { fecha_alta: '2026-11-02' });

  it('una fecha después de su última asistencia sirve', () => {
    const c = clase('2026-11-09', '16:00');
    expect(conflictoFechaCambio(viejo, '2026-11-16', datos([viejo], [c], [fila('Ana', c, 'presente')]))).toBeNull();
  });

  it('no puede ser el día de una asistencia suya ni antes', () => {
    const c = clase('2026-11-16', '16:00');
    const d = datos([viejo], [c], [fila('Ana', c, 'aviso_con_tiempo')]);
    expect(conflictoFechaCambio(viejo, '2026-11-16', d)).toBe(
      'Ya tiene asistencia cargada el lun 16/11 en este horario: el cambio tiene que ser después de esa fecha.');
    expect(conflictoFechaCambio(viejo, '2026-11-10', d)).not.toBeNull();
    expect(conflictoFechaCambio(viejo, '2026-11-17', d)).toBeNull();
  });

  it('las asistencias de otros o de otro horario suyo no cuentan', () => {
    const c = clase('2026-11-16', '16:00');
    const otra = clase('2026-11-16', '17:00');
    const d = datos([viejo], [c, otra], [fila('Beto', c, 'presente'), fila('Ana', otra, 'presente', 'recupera')]);
    expect(conflictoFechaCambio(viejo, '2026-11-16', d)).toBeNull();
  });

  it('no puede ser antes de su alta, y el horario tiene que estar activo', () => {
    expect(conflictoFechaCambio(viejo, '2026-11-01', datos([viejo]))).toBe('Es fijo desde el 2/11: el cambio no puede ser antes.');
    const cerrado = { ...viejo, activo: false, fecha_baja: '2026-11-10' };
    expect(conflictoFechaCambio(cerrado, '2026-11-16', datos([cerrado]))).toBe('Este horario ya no está activo.');
  });
});

describe('conflictoDestino', () => {
  const viejo = horario('Ana', 'lunes', '16:00');
  const DESTINO = { dia: 'lunes' as const, hora: '18:00' };
  const fijos18 = (n: number) => ['Beto', 'Caro', 'Dani', 'Eli'].slice(0, n).map((x) => horario(x, 'lunes', '18:00'));

  it('con 3 fijos hay lugar; con 4, no', () => {
    expect(conflictoDestino(viejo, DESTINO, '2026-11-16', datos([viejo, ...fijos18(3)]), 4)).toBeNull();
    expect(conflictoDestino(viejo, DESTINO, '2026-11-16', datos([viejo, ...fijos18(4)]), 4))
      .toBe('Ya tiene los 4 lugares ocupados por fijos.');
  });

  it('se liberó un lugar: quien se dio de baja antes de la fecha no cuenta; quien se va después, sí', () => {
    const seFue = horario('Eli', 'lunes', '18:00', { activo: false, fecha_baja: '2026-11-16' });
    expect(conflictoDestino(viejo, DESTINO, '2026-11-16', datos([viejo, ...fijos18(3), seFue]), 4)).toBeNull();
    const seVaDespues = { ...seFue, fecha_baja: '2026-11-23' };
    expect(conflictoDestino(viejo, DESTINO, '2026-11-16', datos([viejo, ...fijos18(3), seVaDespues]), 4)).not.toBeNull();
  });

  it('una clase ya registrada desde la fecha y completa (alguien ocupó el lugar libre) no deja', () => {
    const c = clase('2026-11-16', '18:00');
    const d = datos([viejo, ...fijos18(3)], [c], [fila('Zoe', c, 'presente', 'recupera')]);
    expect(conflictoDestino(viejo, DESTINO, '2026-11-16', d, 4)).toBe('La clase del lun 16/11 ya está completa (4/4): no queda lugar.');
    // Desde el 23/11 sí: la clase completa queda antes.
    expect(conflictoDestino(viejo, DESTINO, '2026-11-23', d, 4)).toBeNull();
  });

  it('si ya está anotada en el destino de otra forma (vino a recuperar), avisa', () => {
    const c = clase('2026-11-16', '18:00');
    const d = datos([viejo], [c], [fila('Ana', c, 'presente', 'recupera')]);
    expect(conflictoDestino(viejo, DESTINO, '2026-11-16', d, 4)).toBe('Ya está anotado en la clase del lun 16/11 como Recupera.');
  });

  it('no puede tener ya un horario en el destino, ni elegir el mismo', () => {
    const yaTiene = horario('Ana', 'lunes', '18:00');
    expect(conflictoDestino(viejo, DESTINO, '2026-11-16', datos([viejo, yaTiene]), 4)).toBe('Ya tiene un horario los lunes a las 18:00.');
    expect(conflictoDestino(viejo, { dia: 'lunes', hora: '16:00' }, '2026-11-16', datos([viejo]), 4)).toBe('Es el mismo horario.');
  });

  it('destinosParaCambiar: todos los horarios habituales menos el actual', () => {
    const opciones = destinosParaCambiar(viejo, '2026-11-16', datos([viejo, ...fijos18(4)]), 4);
    const total = HORARIOS_TPA.lunes.length + HORARIOS_TPA.miercoles.length + HORARIOS_TPA.viernes.length;
    expect(opciones).toHaveLength(total - 1);
    expect(opciones.some((o) => o.dia === 'lunes' && o.hora === '16:00')).toBe(false);
    expect(opciones.find((o) => o.dia === 'lunes' && o.hora === '18:00')?.conflicto).not.toBeNull();
    expect(opciones.find((o) => o.dia === 'lunes' && o.hora === '17:00')?.conflicto).toBeNull();
  });

  it('destinosParaCambiar: suma los horarios fuera de lo habitual que tienen fijos activos', () => {
    const fuera = horario('Beto', 'lunes', '20:00');
    const cerrado = horario('Caro', 'miercoles', '20:00', { activo: false, fecha_baja: '2026-11-01' });
    const opciones = destinosParaCambiar(viejo, '2026-11-16', datos([viejo, fuera, cerrado]), 4);
    expect(opciones.find((o) => o.dia === 'lunes' && o.hora === '20:00')?.conflicto).toBeNull();
    expect(opciones.some((o) => o.dia === 'miercoles' && o.hora === '20:00')).toBe(false);
  });
});
