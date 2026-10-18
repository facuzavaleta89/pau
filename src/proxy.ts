import type { NextRequest } from 'next/server'
import { actualizarSesion } from '@/lib/supabase-proxy'

// Next 16: "proxy" es el nuevo nombre de "middleware" (corre en Node.js).
export async function proxy(request: NextRequest) {
  return actualizarSesion(request)
}

export const config = {
  matcher: [
    // Todo menos archivos estáticos e imágenes.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
