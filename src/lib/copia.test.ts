import { describe, expect, it } from 'vitest';
import { TABLAS_COPIA, armarCopia, estadoCopia, nombreArchivoCopia, type TablaCopia } from './copia';

const vacias = () => Object.fromEntries(TABLAS_COPIA.map(({ tabla }) => [tabla, [] as unknown[]])) as Record<TablaCopia, unknown[]>;

describe('copia de seguridad', () => {
  it('nombre con la fecha y hora argentina (el 14/11 00:30 UTC todavía es el 13/11)', () => {
    expect(nombreArchivoCopia(new Date('2026-11-14T00:30:00Z'))).toBe('pau-kinesio-copia-2026-11-13-2130.json');
  });

  it('todas las tablas, con la cantidad de filas de cada una', () => {
    const tablas = { ...vacias(), pacientes: [{ id: 'a' }, { id: 'b' }], pagos_tpa: [{ id: 'p' }] };
    const copia = armarCopia(tablas, new Date('2026-11-13T12:00:00Z'));
    expect(copia).toMatchObject({ app: 'PAU Kinesio', formato: 1, creada: '2026-11-13T12:00:00.000Z' });
    expect(copia.filas).toMatchObject({ pacientes: 2, pagos_tpa: 1, clases_tpa: 0 });
    expect(Object.keys(copia.tablas)).toEqual(TABLAS_COPIA.map((t) => t.tabla));
  });

  it('los pacientes van primero (se restauran antes que lo que depende de ellos)', () => {
    expect(TABLAS_COPIA[0].tabla).toBe('pacientes');
    expect(TABLAS_COPIA.map((t) => t.tabla)).not.toContain('pagos');
  });

  it('nunca se hizo: avisa', () => {
    expect(estadoCopia(null, new Date())).toEqual({ texto: 'Todavía no descargaste ninguna copia en esta compu.', avisar: true });
    expect(estadoCopia('cualquier cosa', new Date()).avisar).toBe(true);
  });

  it('hoy, ayer y hace 7 días: no avisa; hace 8 días: avisa', () => {
    const ahora = new Date('2026-11-13T15:00:00Z');
    expect(estadoCopia('2026-11-13T13:00:00Z', ahora)).toEqual({ texto: 'Última copia en esta compu: 13/11/2026 (hoy)', avisar: false });
    expect(estadoCopia('2026-11-12T13:00:00Z', ahora).texto).toContain('(ayer)');
    expect(estadoCopia('2026-11-06T13:00:00Z', ahora)).toMatchObject({ avisar: false });
    expect(estadoCopia('2026-11-05T13:00:00Z', ahora)).toEqual({ texto: 'Última copia en esta compu: 5/11/2026 (hace 8 días)', avisar: true });
  });

  it('cuenta los días en hora argentina', () => {
    // 13/11 23:30 en Argentina = 14/11 02:30 UTC; "ahora" 14/11 10:00 Argentina: fue ayer.
    expect(estadoCopia('2026-11-14T02:30:00Z', new Date('2026-11-14T13:00:00Z')).texto).toContain('13/11/2026 (ayer)');
  });
});
