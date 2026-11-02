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

describe('mensajeError cuando falta aplicar una migración', () => {
  const MENSAJE = 'Falta aplicar un cambio en la base de datos. Avisale a Facu.';

  it('función, columna o tabla que no existe (PostgREST y Postgres): no dice "Revisá la conexión"', () => {
    for (const code of ['PGRST202', 'PGRST204', 'PGRST205', '42883', '42703', '42P01']) {
      expect(mensajeError({ code, message: 'Could not find the function public.guardar_clase_tpa(p_clases) in the schema cache' })).toBe(MENSAJE);
    }
  });

  it('al guardar: "No se pudo guardar X." + el aviso', () => {
    expect(mensajeErrorAlGuardar('No se pudo guardar la nota.', { code: 'PGRST205', message: 'relation not found' }))
      .toBe(`No se pudo guardar la nota. ${MENSAJE}`);
  });

  it('no se confunde con un permiso (42501) ni con un corte de conexión', () => {
    expect(mensajeError({ code: '42501', message: 'permission denied' })).toBe('No tenés permiso para hacer esto. Probá cerrar sesión y volver a entrar.');
    expect(mensajeError({ code: '', message: 'TypeError: Failed to fetch' })).toBe('Ocurrió un error. Revisá la conexión y probá de nuevo.');
  });
});
