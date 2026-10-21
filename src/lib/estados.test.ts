import { describe, expect, it } from 'vitest';
import { ESTADOS_ASISTENCIA, estadoAsistencia } from './estados';

describe('estadoAsistencia', () => {
  it('devuelve la configuración de un estado conocido', () => {
    expect(estadoAsistencia('presente')).toBe(ESTADOS_ASISTENCIA.presente);
  });

  it('sin estado = "Sin marcar"', () => {
    expect(estadoAsistencia(null)).toBe(ESTADOS_ASISTENCIA.pendiente);
    expect(estadoAsistencia(undefined)).toBe(ESTADOS_ASISTENCIA.pendiente);
  });

  it('no se rompe con un estado que no conoce (escrito por una versión más nueva)', () => {
    const config = estadoAsistencia('aviso_con_tiempo');
    expect(config.label).toBe('Aviso con tiempo');
    expect(config.icono).toBeDefined();
    expect(config.clases).toContain('border-');
  });

  it('no confunde propiedades de Object con estados', () => {
    expect(estadoAsistencia('toString').label).toBe('ToString');
  });
});
