import { createBrowserClient } from '@supabase/ssr'
import { fetchConTiempoMaximo } from './tiempo-maximo'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Cliente del navegador. Guarda la sesión en cookies para que src/proxy.ts
// pueda leerla y refrescarla en cada request. Las peticiones se cortan a los
// 15 s (lecturas) o 45 s (escrituras): ver src/lib/tiempo-maximo.ts.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchConTiempoMaximo },
})
