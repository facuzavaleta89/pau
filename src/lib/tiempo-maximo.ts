import { errorTiempoAgotado } from './errores'

// Con señal mala, un fetch puede quedar colgado sin error y la pantalla
// cargando para siempre. Pasado este tiempo se corta y la app avisa.
// Las escrituras esperan más: con mala señal, cortar un guardado que igual
// llega a la base deja a Pau sin saber si se guardó.
export const TIEMPO_MAXIMO_LECTURA_MS = 15000
export const TIEMPO_MAXIMO_ESCRITURA_MS = 45000

function metodoDe(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase()
  if (typeof Request !== 'undefined' && input instanceof Request) return input.method.toUpperCase()
  return 'GET'
}

// fetch para el cliente de Supabase (src/lib/supabase.ts). Si se vence el
// tiempo, falla con errorTiempoAgotado() para que errores.ts muestre el
// mensaje correcto ("no sabemos si se guardó" en las escrituras).
// Sin AbortSignal.timeout/any: no existen en iPhones con iOS anterior a 16/17.
export function fetchConTiempoMaximo(input: RequestInfo | URL, init?: RequestInit) {
  const metodo = metodoDe(input, init)
  const esLectura = metodo === 'GET' || metodo === 'HEAD'
  const controlador = new AbortController()
  let vencido = false
  const timer = setTimeout(() => {
    vencido = true
    controlador.abort()
  }, esLectura ? TIEMPO_MAXIMO_LECTURA_MS : TIEMPO_MAXIMO_ESCRITURA_MS)
  const senalOriginal = init?.signal
  if (senalOriginal) {
    if (senalOriginal.aborted) controlador.abort()
    else senalOriginal.addEventListener('abort', () => controlador.abort(), { once: true })
  }
  return fetch(input, { ...init, signal: controlador.signal })
    .catch((error: unknown) => {
      if (vencido) throw errorTiempoAgotado(esLectura ? 'lectura' : 'escritura')
      throw error
    })
    .finally(() => clearTimeout(timer))
}
