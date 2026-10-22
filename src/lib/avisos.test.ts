import { afterEach, describe, expect, it } from 'vitest';
import { avisadoAtAlGuardar, esAviso, esClaseFutura, inicioClaseTPA, sugerirAviso } from './avisos';

// Instantes en UTC (Z). Argentina = UTC−3: 12:00 Z = 9:00 en Argentina.
const ahora = (iso: string) => new Date(iso);

describe('inicioClaseTPA', () => {
  const zonaOriginal = process.env.TZ;
  afterEach(() => { process.env.TZ = zonaOriginal; });

  it('la clase empieza a la hora argentina (UTC−3)', () => {
    expect(inicioClaseTPA('2026-10-26', '10:30').toISOString()).toBe('2026-10-26T13:30:00.000Z');
  });

  it('acepta la hora como la devuelve la base ("HH:mm:ss")', () => {
    expect(inicioClaseTPA('2026-10-26', '19:00:00').toISOString()).toBe('2026-10-26T22:00:00.000Z');
  });

  it('da lo mismo aunque el dispositivo esté en otra zona horaria', () => {
    process.env.TZ = 'UTC';
    expect(inicioClaseTPA('2026-10-26', '10:30').toISOString()).toBe('2026-10-26T13:30:00.000Z');
    process.env.TZ = 'Europe/Madrid';
    expect(inicioClaseTPA('2026-10-26', '10:30').toISOString()).toBe('2026-10-26T13:30:00.000Z');
  });
});

describe('esClaseFutura', () => {
  it('es futura hasta que empieza; desde la hora de inicio, ya no', () => {
    expect(esClaseFutura('2026-10-26', '10:30', ahora('2026-10-26T13:29:00Z'))).toBe(true);
    expect(esClaseFutura('2026-10-26', '10:30', ahora('2026-10-26T13:30:00Z'))).toBe(false);
    expect(esClaseFutura('2026-10-26', '10:30', ahora('2026-10-26T14:00:00Z'))).toBe(false); // en curso
    expect(esClaseFutura('2026-10-19', '10:30', ahora('2026-10-26T12:00:00Z'))).toBe(false);
  });
});

describe('sugerirAviso', () => {
  it('lunes 9 h avisa que el miércoles 10:30 no va → con tiempo, faltan 49 h (diseño 7.6)', () => {
    expect(sugerirAviso('2026-10-28', '10:30', ahora('2026-10-26T12:00:00Z'))).toEqual({
      estado: 'aviso_con_tiempo',
      motivo: 'Faltan 49 h para la clase → con tiempo',
    });
  });

  it('justo 24 h antes → con tiempo', () => {
    expect(sugerirAviso('2026-10-28', '10:30', ahora('2026-10-27T13:30:00Z'))?.estado).toBe('aviso_con_tiempo');
  });

  it('un minuto menos de 24 h → sin tiempo', () => {
    expect(sugerirAviso('2026-10-28', '10:30', ahora('2026-10-27T13:31:00Z'))).toEqual({
      estado: 'aviso_sin_tiempo',
      motivo: 'Faltan 23 h para la clase → sin tiempo',
    });
  });

  it('pocos minutos antes → sin tiempo, en minutos', () => {
    expect(sugerirAviso('2026-10-28', '10:30', ahora('2026-10-28T12:50:00Z'))?.motivo)
      .toBe('Faltan 40 min para la clase → sin tiempo');
  });

  it('varios días antes → en días', () => {
    expect(sugerirAviso('2026-10-30', '18:00', ahora('2026-10-26T12:00:00Z'))?.motivo)
      .toBe('Faltan 4 días para la clase → con tiempo');
  });

  it('cuenta en hora argentina cerca de la medianoche UTC', () => {
    // Domingo 25/10 22:00 en Argentina = lunes 26/10 01:00 UTC. Clase lunes 10:30: faltan 12 h.
    expect(sugerirAviso('2026-10-26', '10:30', ahora('2026-10-26T01:00:00Z'))).toEqual({
      estado: 'aviso_sin_tiempo',
      motivo: 'Faltan 12 h para la clase → sin tiempo',
    });
    // Sábado 24/10 22:00 en Argentina: faltan 36 h → con tiempo.
    expect(sugerirAviso('2026-10-26', '10:30', ahora('2026-10-25T01:00:00Z'))?.estado).toBe('aviso_con_tiempo');
  });

  it('sin sugerencia si la clase ya empezó o ya pasó: elige Pau', () => {
    expect(sugerirAviso('2026-10-26', '10:30', ahora('2026-10-26T13:30:00Z'))).toBeNull();
    expect(sugerirAviso('2026-10-26', '10:30', ahora('2026-10-26T14:00:00Z'))).toBeNull();
    expect(sugerirAviso('2026-10-19', '10:30', ahora('2026-10-26T12:00:00Z'))).toBeNull();
  });
});

describe('avisadoAtAlGuardar', () => {
  const momento = ahora('2026-10-26T12:00:00Z');

  it('un aviso nuevo toma el momento en que se carga', () => {
    expect(avisadoAtAlGuardar(null, 'aviso_con_tiempo', momento)).toBe('2026-10-26T12:00:00.000Z');
    expect(avisadoAtAlGuardar({ estado: 'presente', avisado_at: null }, 'aviso_sin_tiempo', momento))
      .toBe('2026-10-26T12:00:00.000Z');
  });

  it('pasar de C.T. a S.T. conserva el momento del primer aviso', () => {
    const anterior = { estado: 'aviso_con_tiempo' as const, avisado_at: '2026-10-20T15:00:00Z' };
    expect(avisadoAtAlGuardar(anterior, 'aviso_sin_tiempo', momento)).toBe('2026-10-20T15:00:00Z');
  });

  it('lo que no es aviso no lleva avisado_at (la base lo exige)', () => {
    const anterior = { estado: 'aviso_con_tiempo' as const, avisado_at: '2026-10-20T15:00:00Z' };
    expect(avisadoAtAlGuardar(anterior, 'presente', momento)).toBeNull();
    expect(avisadoAtAlGuardar(null, 'falto_sin_avisar', momento)).toBeNull();
    expect(avisadoAtAlGuardar(null, 'pendiente', momento)).toBeNull();
  });
});

describe('esAviso', () => {
  it('solo C.T. y S.T.', () => {
    expect(['aviso_con_tiempo', 'aviso_sin_tiempo', 'presente', 'falto_sin_avisar', 'pendiente', 'aviso_ausencia'].filter(esAviso))
      .toEqual(['aviso_con_tiempo', 'aviso_sin_tiempo']);
  });
});
