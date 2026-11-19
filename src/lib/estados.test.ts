import { describe, expect, it } from 'vitest';
import {
  ESTADOS_ASISTENCIA, ESTADOS_PAGO, ORDEN_ESTADOS_FIJO, ORDEN_ESTADOS_OCUPANTE, ORDEN_TIPOS_TURNO, TIPOS_TURNO, esDomicilio,
  estadoAsistencia, etiquetaAsistencia, tipoTurno,
} from './estados';

describe('estadoAsistencia', () => {
  it('devuelve la configuración de un estado conocido', () => {
    expect(estadoAsistencia('presente')).toBe(ESTADOS_ASISTENCIA.presente);
  });

  it('sin estado = "Sin marcar"', () => {
    expect(estadoAsistencia(null)).toBe(ESTADOS_ASISTENCIA.pendiente);
    expect(estadoAsistencia(undefined)).toBe(ESTADOS_ASISTENCIA.pendiente);
  });

  it('no se rompe con un estado que no conoce (escrito por otra versión de la app)', () => {
    const config = estadoAsistencia('vino_otra_clase');
    expect(config.label).toBe('Vino otra clase');
    expect(config.icono).toBeDefined();
    expect(config.clases).toContain('border-');
  });

  it('no confunde propiedades de Object con estados', () => {
    expect(estadoAsistencia('toString').label).toBe('ToString');
  });
});

describe('estados de asistencia TPA (palabras de Pau)', () => {
  it('etiquetas', () => {
    expect(ORDEN_ESTADOS_FIJO.map((e) => ESTADOS_ASISTENCIA[e].label)).toEqual([
      'Presente', 'Avisó C.T.', 'Avisó S.T.', 'No avisó', 'Sin marcar',
    ]);
  });

  it('avisos en ámbar y "No avisó" en rojo (DESIGN.md)', () => {
    expect(ESTADOS_ASISTENCIA.aviso_con_tiempo.clases).toContain('amber');
    expect(ESTADOS_ASISTENCIA.aviso_sin_tiempo.clases).toContain('amber');
    expect(ESTADOS_ASISTENCIA.falto_sin_avisar.clases).toContain('red');
  });

  it('quien viene a ocupar un lugar no tiene avisos, y su "No avisó" es "No vino"', () => {
    expect(ORDEN_ESTADOS_OCUPANTE).toEqual(['presente', 'falto_sin_avisar', 'pendiente']);
    expect(etiquetaAsistencia('falto_sin_avisar', 'recupera')).toBe('No vino');
    expect(etiquetaAsistencia('falto_sin_avisar', 'fijo')).toBe('No avisó');
    expect(etiquetaAsistencia('estado_raro', 'suelta')).toBe('Estado raro');
  });
});

describe('pagos (colores del calendario de Pau)', () => {
  it('pagado en verde y pendiente en rosa; el ámbar queda para los avisos', () => {
    expect(ESTADOS_PAGO.pagado.clases).toContain('emerald');
    expect(ESTADOS_PAGO.pendiente.clases).toContain('pink');
    expect(ESTADOS_PAGO.pendiente.punto).toContain('pink');
  });
});

describe('tipoTurno', () => {
  it('sin tipo es RPG', () => {
    expect(tipoTurno(null).label).toBe('RPG');
    expect(tipoTurno('').label).toBe('RPG');
  });

  it('todos los tipos del selector tienen su configuración', () => {
    for (const tipo of ORDEN_TIPOS_TURNO) expect(tipoTurno(tipo)).toBe(TIPOS_TURNO[tipo]);
  });

  it('un tipo que no conoce se muestra con su texto, en gris', () => {
    expect(tipoTurno('Drenaje')).toMatchObject({ label: 'Drenaje', clases: expect.stringContaining('stone') });
    expect(tipoTurno('constructor').label).toBe('constructor');
  });

  it('la clase a domicilio tiene color propio', () => {
    expect(esDomicilio('Clase domicilio')).toBe(true);
    expect(esDomicilio('RPG')).toBe(false);
    expect(esDomicilio(null)).toBe(false);
    const otros = ORDEN_TIPOS_TURNO.filter((t) => t !== 'Clase domicilio').map((t) => TIPOS_TURNO[t].clases);
    expect(otros).not.toContain(TIPOS_TURNO['Clase domicilio'].clases);
  });
});
