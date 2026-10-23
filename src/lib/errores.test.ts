import { describe, expect, it } from 'vitest';
import { mensajeError, mensajeErrorAlGuardar } from './errores';

describe('mensajeError con mensajes de la base', () => {
  it('muestra tal cual (sin el prefijo) los mensajes "TPA: " de las funciones y el trigger de TPA', () => {
    const error = { code: 'P0001', message: 'TPA: la clase está cancelada. Reactivala para marcar asistencia u ocupar lugares.' };
    expect(mensajeError(error)).toBe('La clase está cancelada. Reactivala para marcar asistencia u ocupar lugares.');
    expect(mensajeErrorAlGuardar('No se pudo guardar la asistencia.', { code: '23514', message: 'TPA: alguien ocupa el lugar de este fijo.' }))
      .toBe('No se pudo guardar la asistencia. Alguien ocupa el lugar de este fijo.');
  });

  it('cualquier otro mensaje de Postgres sigue siendo genérico (puede traer datos)', () => {
    expect(mensajeError({ code: '23514', message: 'new row for relation "asistencia_tpa" violates check constraint' }))
      .toBe('Ocurrió un error. Revisá la conexión y probá de nuevo.');
  });
});
