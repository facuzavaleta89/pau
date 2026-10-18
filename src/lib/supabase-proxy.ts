import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const RUTA_LOGIN = '/login'
const RUTA_INICIO = '/rpg'

// Refresca la sesión de Supabase (cookies) y redirige según haya o no sesión.
// Es un chequeo "optimista": la protección real de los datos es RLS en la base.
export async function actualizarSesion(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
        },
      },
    }
  )

  // No poner código entre createServerClient y getClaims: getClaims es lo que
  // valida el token y, si venció, lo refresca y escribe las cookies nuevas.
  const { data } = await supabase.auth.getClaims()
  const haySesion = Boolean(data?.claims)

  const { pathname, search } = request.nextUrl
  const enLogin = pathname === RUTA_LOGIN

  if (!haySesion && !enLogin) {
    const url = request.nextUrl.clone()
    url.pathname = RUTA_LOGIN
    url.search = ''
    url.searchParams.set('next', pathname + search)
    return redirigirConCookies(url, response)
  }

  if (haySesion && enLogin) {
    const url = request.nextUrl.clone()
    url.pathname = RUTA_INICIO
    url.search = ''
    return redirigirConCookies(url, response)
  }

  return response
}

// Al redirigir hay que copiar las cookies que haya escrito el refresco del
// token; si no, el navegador se queda con la sesión vieja.
function redirigirConCookies(url: URL, response: NextResponse) {
  const redireccion = NextResponse.redirect(url)
  response.cookies.getAll().forEach((cookie) => redireccion.cookies.set(cookie))
  return redireccion
}
