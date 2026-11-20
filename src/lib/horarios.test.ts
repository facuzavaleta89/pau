import { describe, expect, it } from 'vitest';
import type { AsistenciaTPA, ClaseTPA, DiaSemana, EstadoAsistenciaTPA, HorarioTPA, MotivoCancelacionTPA, NotaEvolucion, PagoTPA, TipoAsistenciaTPA } from '@/types';
import {
  bajasRecientes, conflictoAlReactivar, horariosCerradosConLaBaja, motivosParaNoBorrar, textoHorario, type DatosHorarios,
} from './horarios';

// Noviembre 2026: lunes 2, 9, 16, 23, 30 · viernes 6, 13, 20, 27. Hoy: vie 20/11.
const HOY = '2026-11-20';

let contador = 0;
const id = () => `id-${++contador}`;

function horario(nombre: string, dia: DiaSemana, hora: string, extra: Partial<HorarioTPA> = {}): HorarioTPA {
  return {
    id: id(), paciente_id: `pac-${nombre}`, dia_semana: dia, hora, activo: true,
    fecha_alta: '2026-11-01', fecha_baja: null, created_at: '2026-11-01T12:00:00Z', pacientes: { nombre },
    ...extra,
  };
}
const dadoDeBaja = (nombre: string, dia: DiaSemana, hora: string, alta: string, baja: string) =>
  horario(nombre, dia, hora, { activo: false, fecha_alta: alta, fecha_baja: baja });

function clase(fecha: string, hora: string, motivo: MotivoCancelacionTPA | null = null): ClaseTPA {
  return { id: `clase-${fecha}-${hora}`, fecha, hora: `${hora}:00`, motivo_cancelacion: motivo, created_at: '2026-11-01T12:00:00Z' };
}

function fila(nombre: string, c: ClaseTPA, estado: EstadoAsistenciaTPA, tipo: TipoAsistenciaTPA = 'fijo'): AsistenciaTPA {
  return {
    id: id(), clase_id: c.id, paciente_id: `pac-${nombre}`, estado, tipo, ocupa_lugar_de: null, cambio_de: null,
    avisado_at: estado.startsWith('aviso') ? '2026-11-01T12:00:00Z' : null,
    created_at: '2026-11-01T12:00:00Z', updated_at: '2026-11-01T12:00:00Z',
  };
}

function cuota(nombre: string, mes: string, veces: number): PagoTPA {
  return {
    id: id(), paciente_id: `pac-${nombre}`, mes: `${mes}-01`, concepto: 'cuota', veces_por_semana: veces, modalidad: 'plan',
    clases: null, importe: 1000, pagado_el: `${mes}-05`, medio: 'efectivo', nota: null,
    created_at: '2026-11-05T12:00:00Z', updated_at: '2026-11-05T12:00:00Z',
  };
}

function nota(nombre: string, c: ClaseTPA): NotaEvolucion {
  return {
    id: id(), paciente_id: `pac-${nombre}`, fecha: c.fecha, texto: 'texto', clase_tpa_id: c.id,
    created_at: '2026-11-01T12:00:00Z', updated_at: '2026-11-01T12:00:00Z',
  };
}

/** Datos para revisar un horario de Ana: `propios` = todos sus horarios; `otros` = los de los demás. */
function datos(propios: HorarioTPA[], extra: Partial<Omit<DatosHorarios, 'recuperaciones'>> & { otros?: HorarioTPA[] } = {}): DatosHorarios {
  const clases = extra.clases ?? [];
  const asistencias = extra.asistencias ?? [];
  const claseDe = new Map(clases.map((c) => [c.id, c]));
  return {
    horarios: [...propios, ...(extra.otros ?? [])],
    clases,
    asistencias,
    notas: extra.notas ?? [],
    pagos: extra.pagos ?? [],
    recuperaciones: {
      horarios: propios,
      clasesCanceladas: clases.filter((c) => c.motivo_cancelacion),
      asistencias: asistencias
        .filter((a) => a.paciente_id === 'pac-Ana')
        .map((a) => ({ ...a, clases_tpa: claseDe.get(a.clase_id) as ClaseTPA })),
    },
  };
}

describe('motivosParaNoBorrar ("Lo cargué por error")', () => {
  it('caso de Pau: viernes 12:30 dado de baja sin nada registrado → se puede borrar', () => {
    const error = dadoDeBaja('Ana', 'viernes', '12:30', '2026-11-17', '2026-11-19');
    const bueno = dadoDeBaja('Ana', 'viernes', '16:00', '2026-11-17', '2026-11-19');
    expect(motivosParaNoBorrar(error, datos([error, bueno]), HOY)).toEqual([]);
  });

  it('activo y sin nada registrado → se puede borrar; también un alta a futuro que nunca empezó', () => {
    const h = horario('Ana', 'viernes', '12:30');
    expect(motivosParaNoBorrar(h, datos([h]), HOY)).toEqual([]);
    const nunca = dadoDeBaja('Ana', 'lunes', '10:30', '2026-12-07', '2026-12-07');
    expect(motivosParaNoBorrar(nunca, datos([nunca]), HOY)).toEqual([]);
  });

  it('con asistencia cargada en ese horario mientras era fijo → no', () => {
    const h = horario('Ana', 'viernes', '12:30');
    const c13 = clase('2026-11-13', '12:30');
    const motivos = motivosParaNoBorrar(h, datos([h], { clases: [c13], asistencias: [fila('Ana', c13, 'presente')] }), HOY);
    expect(motivos).toEqual(['Ya tiene asistencia cargada en ese horario (vie 13/11).']);
  });

  it('un aviso de fijo cargado después de la baja también cuenta', () => {
    const h = dadoDeBaja('Ana', 'viernes', '12:30', '2026-11-01', '2026-11-19');
    const c27 = clase('2026-11-27', '12:30');
    expect(motivosParaNoBorrar(h, datos([h], { clases: [c27], asistencias: [fila('Ana', c27, 'aviso_con_tiempo')] }), HOY)).toHaveLength(1);
  });

  it('una clase suelta en ese horario antes de ser fijo no cuenta', () => {
    const h = horario('Ana', 'viernes', '12:30', { fecha_alta: '2026-11-15' });
    const c6 = clase('2026-11-06', '12:30');
    expect(motivosParaNoBorrar(h, datos([h], { clases: [c6], asistencias: [fila('Ana', c6, 'presente', 'suelta')] }), HOY)).toEqual([]);
  });

  it('asistencias de otros alumnos en esas clases no la frenan', () => {
    const h = horario('Ana', 'viernes', '12:30');
    const c13 = clase('2026-11-13', '12:30');
    expect(motivosParaNoBorrar(h, datos([h], { clases: [c13], asistencias: [fila('Beto', c13, 'presente')] }), HOY)).toEqual([]);
  });

  it('con una nota de evolución de una clase de ese horario → no', () => {
    const h = horario('Ana', 'viernes', '12:30');
    const c13 = clase('2026-11-13', '12:30');
    expect(motivosParaNoBorrar(h, datos([h], { clases: [c13], notas: [nota('Ana', c13)] }), HOY))
      .toEqual(['Tiene notas de evolución de clases de ese horario (vie 13/11).']);
  });

  it('con una clase cancelada mientras era fijo → no; cancelada antes del alta, sí se puede', () => {
    const h = horario('Ana', 'lunes', '10:30', { fecha_alta: '2026-11-10' });
    const feriado = clase('2026-11-23', '10:30', 'feriado');
    expect(motivosParaNoBorrar(h, datos([h], { clases: [feriado] }), HOY)).toEqual([
      'Se cancelaron clases de ese horario mientras estaba (lun 23/11): le cuentan para recuperar.',
    ]);
    const antes = clase('2026-11-02', '10:30', 'cancelada_por_pau');
    expect(motivosParaNoBorrar(h, datos([h], { clases: [antes] }), HOY)).toEqual([]);
  });

  it('cuota cobrada: sin este horario no sería fija ese mes → no', () => {
    const h = horario('Ana', 'viernes', '12:30');
    expect(motivosParaNoBorrar(h, datos([h], { pagos: [cuota('Ana', '2026-11', 1)] }), HOY))
      .toEqual(['La cuota de noviembre ya está cobrada contando este horario.']);
  });

  it('cuota de 1 vez con otro horario ese mes → se puede; cuota de 2 veces con un solo horario más → no', () => {
    const error = horario('Ana', 'viernes', '12:30');
    const bueno = horario('Ana', 'viernes', '16:00', { fecha_alta: '2026-11-19' });
    expect(motivosParaNoBorrar(error, datos([error, bueno], { pagos: [cuota('Ana', '2026-11', 1)] }), HOY)).toEqual([]);
    expect(motivosParaNoBorrar(error, datos([error, bueno], { pagos: [cuota('Ana', '2026-11', 2)] }), HOY)).toHaveLength(1);
  });

  it('cuota de un mes en que el horario no tuvo clases → no la frena', () => {
    const h = horario('Ana', 'viernes', '12:30', { fecha_alta: '2026-12-01' });
    expect(motivosParaNoBorrar(h, datos([h], { pagos: [cuota('Ana', '2026-11', 1)] }), HOY)).toEqual([]);
  });

  it('el horario sube el tope de recuperaciones del mes → no (cambiarían sus recuperaciones)', () => {
    // 2 avisos C.T. en el lunes: con 2 horarios recupera los 2; sin el del viernes, 1 (tope).
    const lunes = horario('Ana', 'lunes', '10:30');
    const error = horario('Ana', 'viernes', '12:30');
    const c2 = clase('2026-11-02', '10:30');
    const c9 = clase('2026-11-09', '10:30');
    const d = datos([lunes, error], { clases: [c2, c9], asistencias: [fila('Ana', c2, 'aviso_con_tiempo'), fila('Ana', c9, 'aviso_con_tiempo')] });
    expect(motivosParaNoBorrar(error, d, HOY)).toEqual(['Cambiarían sus recuperaciones de noviembre.']);
    // Con un solo aviso, el tope no cambia nada.
    const d1 = datos([lunes, error], { clases: [c2], asistencias: [fila('Ana', c2, 'aviso_con_tiempo')] });
    expect(motivosParaNoBorrar(error, d1, HOY)).toEqual([]);
  });
});

describe('conflictoAlReactivar ("Deshacer la baja")', () => {
  const op = { cupo: 4, hoy: HOY, pacienteActivo: true };
  const baja = () => dadoDeBaja('Ana', 'viernes', '16:00', '2026-11-01', '2026-11-19');

  it('lugar libre y sin otro horario → se puede', () => {
    const h = baja();
    expect(conflictoAlReactivar(h, datos([h], { otros: [horario('Beto', 'viernes', '16:00')] }), op)).toBeNull();
  });

  it('ya activo, sin fecha de baja o con el paciente dado de baja → no', () => {
    const activo = horario('Ana', 'viernes', '16:00');
    expect(conflictoAlReactivar(activo, datos([activo]), op)).toBe('Este horario ya está activo.');
    const viejo = horario('Ana', 'viernes', '16:00', { activo: false, fecha_baja: null });
    expect(conflictoAlReactivar(viejo, datos([viejo]), op)).toMatch(/inscribilo de nuevo/);
    const h = baja();
    expect(conflictoAlReactivar(h, datos([h]), { ...op, pacienteActivo: false })).toMatch(/reactivar al paciente/);
  });

  it('ya tiene otro horario activo ese día y hora → no', () => {
    const h = baja();
    const otro = horario('Ana', 'viernes', '16:00', { fecha_alta: '2026-11-19' });
    expect(conflictoAlReactivar(h, datos([h, otro]), op)).toBe('Ya tiene otro horario activo los viernes a las 16:00.');
  });

  it('el horario ya tiene 4 fijos → no; con 3, o con un 4.º que ya se fue, sí', () => {
    const h = baja();
    const tres = ['Beto', 'Caro', 'Dani'].map((n) => horario(n, 'viernes', '16:00'));
    expect(conflictoAlReactivar(h, datos([h], { otros: [...tres, horario('Eli', 'viernes', '16:00', { fecha_alta: '2026-12-04' })] }), op))
      .toBe('El horario ya tiene los 4 lugares ocupados por fijos.');
    expect(conflictoAlReactivar(h, datos([h], { otros: tres }), op)).toBeNull();
    const seFue = dadoDeBaja('Eli', 'viernes', '16:00', '2026-11-01', '2026-11-20');
    expect(conflictoAlReactivar(h, datos([h], { otros: [...tres, seFue] }), op)).toBeNull();
    const seVa = dadoDeBaja('Eli', 'viernes', '16:00', '2026-11-01', '2026-12-01');
    expect(conflictoAlReactivar(h, datos([h], { otros: [...tres, seVa] }), op)).toMatch(/4 lugares/);
  });

  it('una clase ya registrada después de la baja quedó completa (alguien ocupó su lugar) → no', () => {
    const h = baja();
    const tres = ['Beto', 'Caro', 'Dani'].map((n) => horario(n, 'viernes', '16:00'));
    const c27 = clase('2026-11-27', '16:00');
    const recupera = fila('Eli', c27, 'pendiente', 'recupera');
    expect(conflictoAlReactivar(h, datos([h], { otros: tres, clases: [c27], asistencias: [recupera] }), op))
      .toBe('La clase del vie 27/11 ya está completa (4/4): alguien ocupó su lugar.');
    // Si un fijo avisó, hay lugar.
    const aviso = fila('Beto', c27, 'aviso_con_tiempo');
    expect(conflictoAlReactivar(h, datos([h], { otros: tres, clases: [c27], asistencias: [recupera, aviso] }), op)).toBeNull();
    // Si ella misma avisó para esa clase, no ocupa lugar.
    const suyo = fila('Ana', c27, 'aviso_sin_tiempo');
    expect(conflictoAlReactivar(h, datos([h], { otros: tres, clases: [c27], asistencias: [recupera, suyo] }), op)).toBeNull();
    // Una clase cancelada no cuenta.
    const cancelada = clase('2026-11-27', '16:00', 'feriado');
    expect(conflictoAlReactivar(h, datos([h], { otros: tres, clases: [cancelada], asistencias: [] }), op)).toBeNull();
  });

  it('ya está anotada en una clase de ese horario como clase suelta → no', () => {
    const h = baja();
    const c27 = clase('2026-11-27', '16:00');
    expect(conflictoAlReactivar(h, datos([h], { clases: [c27], asistencias: [fila('Ana', c27, 'pendiente', 'suelta')] }), op))
      .toBe('Ya está anotado en la clase del vie 27/11 como Clase suelta.');
  });

  it('una clase de antes de la baja no importa aunque haya estado completa', () => {
    const h = baja();
    const tres = ['Beto', 'Caro', 'Dani'].map((n) => horario(n, 'viernes', '16:00'));
    const c13 = clase('2026-11-13', '16:00');
    expect(conflictoAlReactivar(h, datos([h], { otros: tres, clases: [c13], asistencias: [fila('Ana', c13, 'presente'), fila('Eli', c13, 'presente', 'suelta')] }), op)).toBeNull();
  });
});

describe('horariosCerradosConLaBaja y bajasRecientes', () => {
  it('ofrece los cerrados en la fecha de baja del paciente (o en su alta si era a futuro)', () => {
    const lunes = dadoDeBaja('Ana', 'lunes', '10:30', '2026-10-01', '2026-11-19');
    const viernes = dadoDeBaja('Ana', 'viernes', '16:00', '2026-10-01', '2026-11-19');
    const futuro = dadoDeBaja('Ana', 'miercoles', '10:30', '2026-12-02', '2026-12-02');
    const antes = dadoDeBaja('Ana', 'miercoles', '12:30', '2026-10-01', '2026-11-04');
    const activo = horario('Ana', 'lunes', '18:00');
    expect(horariosCerradosConLaBaja('2026-11-19', [viernes, antes, futuro, activo, lunes]).map((h) => h.id))
      .toEqual([lunes.id, futuro.id, viernes.id]);
    expect(horariosCerradosConLaBaja(null, [lunes])).toEqual([]);
  });

  it('bajas recientes: desde el 1 del mes anterior, la más nueva primero', () => {
    const a = dadoDeBaja('Ana', 'viernes', '16:00', '2026-09-01', '2026-10-01');
    const b = dadoDeBaja('Beto', 'viernes', '16:00', '2026-09-01', '2026-11-19');
    const vieja = dadoDeBaja('Caro', 'viernes', '16:00', '2026-09-01', '2026-09-30');
    expect(bajasRecientes([a, vieja, b, horario('Dani', 'viernes', '16:00')], HOY).map((h) => h.id)).toEqual([b.id, a.id]);
  });

  it('textoHorario', () => {
    expect(textoHorario({ dia_semana: 'miercoles', hora: '10:30:00' })).toBe('los miércoles a las 10:30');
  });
});
