import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Cliente del navegador. Guarda la sesión en cookies para que src/proxy.ts
// pueda leerla y refrescarla en cada request.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
