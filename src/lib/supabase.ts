import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Con señal mala, un fetch puede quedar colgado sin error y la pantalla
// cargando para siempre. Pasado este tiempo se corta y la app avisa.
const TIEMPO_MAXIMO_MS = 15000

// Sin AbortSignal.timeout/any: no existen en iPhones con iOS anterior a 16/17.
function fetchConTiempoMaximo(input: RequestInfo | URL, init?: RequestInit) {
  const controlador = new AbortController()
  const timer = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_MS)
  const senalOriginal = init?.signal
  if (senalOriginal) {
    if (senalOriginal.aborted) controlador.abort()
    else senalOriginal.addEventListener('abort', () => controlador.abort(), { once: true })
  }
  return fetch(input, { ...init, signal: controlador.signal }).finally(() => clearTimeout(timer))
}

// Cliente del navegador. Guarda la sesión en cookies para que src/proxy.ts
// pueda leerla y refrescarla en cada request.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchConTiempoMaximo },
})
