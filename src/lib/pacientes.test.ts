import { describe, expect, it } from 'vitest';
import {
  actividadesDe, cumpleaniosProximos, edadDe, edadEn, fechaNacimientoValida, textoActividades, textoBaja, textoEdad,
  textoFechaNacimiento,
} from './pacientes';

describe('textoBaja', () => {
  it('con fecha y sin fecha', () => {
    expect(textoBaja({ fecha_baja: '2026-11-03' })).toBe('Dado de baja el 3/11/2026');
    expect(textoBaja({ fecha_baja: null })).toBe('Dado de baja');
  });
});

describe('actividadesDe', () => {
  it('"ambos" (columna vieja) es RPG + TPA', () => {
    expect(actividadesDe({ tipo_clase: 'ambos', actividades: null })).toEqual(['RPG', 'TPA']);
    expect(actividadesDe({ tipo_clase: 'ambos' })).toEqual(['RPG', 'TPA']);
  });

  it('sin la columna nueva, usa tipo_clase', () => {
    expect(actividadesDe({ tipo_clase: 'TPA', actividades: [] })).toEqual(['TPA']);
    expect(actividadesDe({ tipo_clase: null, actividades: [] })).toEqual([]);
  });

  it('la columna nueva manda: Domicilio solo no se confunde con el RPG de tipo_clase', () => {
    expect(actividadesDe({ tipo_clase: 'RPG', actividades: ['Domicilio'] })).toEqual(['Domicilio']);
  });

  it('siempre en el mismo orden', () => {
    expect(actividadesDe({ tipo_clase: 'ambos', actividades: ['Domicilio', 'TPA', 'RPG'] })).toEqual(['RPG', 'TPA', 'Domicilio']);
  });

  it('texto', () => {
    expect(textoActividades({ tipo_clase: 'RPG', actividades: ['RPG', 'Domicilio'] })).toBe('RPG · Domicilio');
    expect(textoActividades({ tipo_clase: null, actividades: null })).toBe('');
  });
});

describe('edadEn', () => {
  it('cumplió, cumple hoy o todavía no cumplió', () => {
    expect(edadEn('1985-03-12', '2026-03-11')).toBe(40);
    expect(edadEn('1985-03-12', '2026-03-12')).toBe(41);
    expect(edadEn('1985-03-12', '2026-12-31')).toBe(41);
  });

  it('todavía no nació: sin edad', () => {
    expect(edadEn('2027-01-01', '2026-11-18')).toBeNull();
  });

  it('el día que nació: 0', () => {
    expect(edadEn('2026-11-18', '2026-11-18')).toBe(0);
  });

  it('nacido un 29/02: en un año común cumple el 28/02', () => {
    expect(edadEn('2000-02-29', '2027-02-27')).toBe(26);
    expect(edadEn('2000-02-29', '2027-02-28')).toBe(27);
    expect(edadEn('2000-02-29', '2028-02-28')).toBe(27); // bisiesto: todavía falta un día
    expect(edadEn('2000-02-29', '2028-02-29')).toBe(28);
  });
});

describe('edadDe y textoEdad', () => {
  it('con fecha de nacimiento, se calcula (no importa la edad guardada)', () => {
    expect(edadDe({ edad: 99, fecha_nacimiento: '1985-03-12' }, '2026-11-18')).toBe(41);
  });

  it('sin fecha, la edad guardada', () => {
    expect(edadDe({ edad: 50, fecha_nacimiento: null }, '2026-11-18')).toBe(50);
    expect(edadDe({ edad: 50 }, '2026-11-18')).toBe(50);
  });

  it('textos', () => {
    expect(textoEdad({ edad: 32, fecha_nacimiento: null }, '2026-11-18')).toBe('32 años');
    expect(textoEdad({ edad: 1, fecha_nacimiento: null }, '2026-11-18')).toBe('1 año');
    expect(textoEdad({ edad: null, fecha_nacimiento: null }, '2026-11-18')).toBe('Edad no registrada');
  });

  it('fecha de nacimiento legible y validación', () => {
    expect(textoFechaNacimiento('1985-03-02')).toBe('2/3/1985');
    expect(fechaNacimientoValida('1985-03-02', '2026-11-18')).toBe(true);
    expect(fechaNacimientoValida('2026-11-19', '2026-11-18')).toBe(false);
    expect(fechaNacimientoValida('0185-03-02', '2026-11-18')).toBe(false);
  });
});

describe('cumpleaniosProximos', () => {
  const paciente = (nombre: string, fecha_nacimiento: string | null, activo = true) => ({ id: nombre, nombre, activo, fecha_nacimiento });

  it('hoy primero, después los próximos 7 días, con los años que cumple', () => {
    const lista = cumpleaniosProximos([
      paciente('Dentro de 7', '1990-11-25'), paciente('Hoy', '1980-11-18'), paciente('Mañana', '2000-11-19'),
      paciente('Dentro de 8', '1990-11-26'), paciente('Ayer', '1990-11-17'),
    ], '2026-11-18');
    expect(lista.map((c) => [c.nombre, c.dias, c.cumple, c.fecha])).toEqual([
      ['Hoy', 0, 46, '2026-11-18'],
      ['Mañana', 1, 26, '2026-11-19'],
      ['Dentro de 7', 7, 36, '2026-11-25'],
    ]);
  });

  it('dos el mismo día: por nombre', () => {
    const lista = cumpleaniosProximos([paciente('Zoe', '1990-11-18'), paciente('Ana', '1991-11-18')], '2026-11-18');
    expect(lista.map((c) => c.nombre)).toEqual(['Ana', 'Zoe']);
  });

  it('cruza fin de año: cumple los años del año siguiente', () => {
    const [c] = cumpleaniosProximos([paciente('Enero', '1990-01-02')], '2026-12-29');
    expect(c).toMatchObject({ fecha: '2027-01-02', dias: 4, cumple: 37 });
  });

  it('dados de baja y sin fecha: no aparecen', () => {
    expect(cumpleaniosProximos([paciente('Baja', '1990-11-18', false), paciente('Sin fecha', null)], '2026-11-18')).toEqual([]);
  });

  it('el día que nació no es un cumpleaños', () => {
    expect(cumpleaniosProximos([paciente('Bebé', '2026-11-18')], '2026-11-18')).toEqual([]);
  });

  it('29/02 en un año común: aparece el 28/02 y una sola vez', () => {
    const lista = cumpleaniosProximos([paciente('Bisiesto', '2000-02-29')], '2027-02-25');
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ fecha: '2027-02-28', dias: 3, cumple: 27 });
  });

  it('29/02 en un año bisiesto: aparece el 29/02, no el 28/02', () => {
    const lista = cumpleaniosProximos([paciente('Bisiesto', '2000-02-29')], '2028-02-28');
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ fecha: '2028-02-29', dias: 1, cumple: 28 });
  });
});
