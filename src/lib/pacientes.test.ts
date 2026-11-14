import { describe, expect, it } from 'vitest';
import { textoBaja } from './pacientes';

describe('textoBaja', () => {
  it('con fecha y sin fecha', () => {
    expect(textoBaja({ fecha_baja: '2026-11-03' })).toBe('Dado de baja el 3/11/2026');
    expect(textoBaja({ fecha_baja: null })).toBe('Dado de baja');
  });
});
