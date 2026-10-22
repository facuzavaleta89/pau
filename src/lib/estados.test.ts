import { describe, expect, it } from 'vitest';
import {
  ESTADOS_ASISTENCIA, ORDEN_ESTADOS_FIJO, ORDEN_ESTADOS_OCUPANTE, estadoAsistencia, etiquetaAsistencia,
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
