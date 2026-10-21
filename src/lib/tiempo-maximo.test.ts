import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostgrestClient } from '@supabase/postgrest-js';
import { fetchConTiempoMaximo, TIEMPO_MAXIMO_ESCRITURA_MS, TIEMPO_MAXIMO_LECTURA_MS } from './tiempo-maximo';
import { MENSAJE_RESULTADO_INCIERTO, mensajeError, mensajeErrorAlGuardar } from './errores';

// Usa el mismo postgrest-js que supabase-js (es el que arma las consultas de
// queries.ts), con fetchConTiempoMaximo como en src/lib/supabase.ts. Así se
// prueba lo que la app recibe de verdad cuando se corta una petición.
const cliente = () => new PostgrestClient('http://localhost/rest/v1', { fetch: fetchConTiempoMaximo });

/** fetch que nunca responde: solo termina si lo cortan (como con señal muy mala). */
function fetchColgado() {
  return vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolver, rechazar) => {
    init?.signal?.addEventListener('abort', () => rechazar(new DOMException('This operation was aborted', 'AbortError')));
  }));
}

/** Para saber si una promesa ya terminó sin esperarla. */
function seguir<T>(promesa: PromiseLike<T>) {
  const estado = { terminada: false };
  const resultado = Promise.resolve(promesa).finally(() => { estado.terminada = true; });
  return { estado, resultado };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('fetchConTiempoMaximo con supabase (postgrest-js)', () => {
  it('corta una lectura a los 15 s, sin reintentarla, con el mensaje de lectura', async () => {
    const fetchFalso = fetchColgado();
    vi.stubGlobal('fetch', fetchFalso);

    const { estado, resultado } = seguir(cliente().from('pacientes').select('*'));
    await vi.advanceTimersByTimeAsync(TIEMPO_MAXIMO_LECTURA_MS - 1);
    expect(estado.terminada).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const { data, error } = await resultado;
    expect(data).toBeNull();
    // supabase-js no tira la excepción: la devuelve en `error`, y sin código.
    expect(error?.code).toBe('');
    expect(error?.message).toBe('AbortError: tiempo-agotado-lectura');
    expect(mensajeError(error)).toBe('La conexión tardó demasiado. Revisá la señal y probá de nuevo.');
    // Un corte no se reintenta (otros errores de red de las lecturas, sí: hasta 3 veces).
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('a una escritura le da 45 s y después avisa que no se sabe si se guardó', async () => {
    vi.stubGlobal('fetch', fetchColgado());

    const { estado, resultado } = seguir(cliente().from('pacientes').insert({ id: 'x' }).select());
    await vi.advanceTimersByTimeAsync(TIEMPO_MAXIMO_LECTURA_MS);
    expect(estado.terminada).toBe(false);

    await vi.advanceTimersByTimeAsync(TIEMPO_MAXIMO_ESCRITURA_MS - TIEMPO_MAXIMO_LECTURA_MS);
    const { error } = await resultado;
    expect(error?.message).toBe('AbortError: tiempo-agotado-escritura');
    expect(mensajeErrorAlGuardar('No se pudo guardar el paciente.', error)).toBe(MENSAJE_RESULTADO_INCIERTO);
    expect(mensajeError(error)).toMatch(/no sabemos si se hizo el cambio/);
  });

  it('trata PATCH y DELETE como escrituras', async () => {
    vi.stubGlobal('fetch', fetchColgado());

    const { estado, resultado } = seguir(cliente().from('pacientes').update({ nombre: 'x' }).eq('id', 'x').select());
    await vi.advanceTimersByTimeAsync(TIEMPO_MAXIMO_LECTURA_MS);
    expect(estado.terminada).toBe(false);
    await vi.advanceTimersByTimeAsync(TIEMPO_MAXIMO_ESCRITURA_MS);
    expect((await resultado).error?.message).toBe('AbortError: tiempo-agotado-escritura');
  });

  it('si la respuesta llega a tiempo, no queda ningún corte pendiente', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })));

    const { data, error } = await cliente().from('pacientes').select('*');
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('otro error de red no se disfraza de corte', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));

    const { error } = await cliente().from('pacientes').insert({ id: 'x' }).select();
    expect(mensajeErrorAlGuardar('No se pudo guardar el paciente.', error))
      .toBe('No se pudo guardar el paciente. Ocurrió un error. Revisá la conexión y probá de nuevo.');
  });
});

describe('mensajeErrorAlGuardar', () => {
  it('antepone el prefijo a los demás errores', () => {
    expect(mensajeErrorAlGuardar('No se pudo guardar el turno.', { code: '42501' }))
      .toBe('No se pudo guardar el turno. No tenés permiso para hacer esto. Probá cerrar sesión y volver a entrar.');
  });
});
