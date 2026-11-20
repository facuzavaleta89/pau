import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { registrarError } from '@/lib/errores';

// Mantener activo el proyecto de Supabase (plan Free: se pausa con 7 días sin
// actividad). La llama Vercel Cron una vez por día (vercel.json) con el header
// `Authorization: Bearer <CRON_SECRET>`. Hace unas pocas llamadas a
// public.ping() (select 1, migración 20261120000001) con la clave anon: no lee
// ninguna tabla ni devuelve datos. Sin el secreto, 401 y no toca la base.
// proxy.ts la deja pasar sin sesión (no redirige al login).

export const dynamic = 'force-dynamic';

/** Supabase pide "unas pocas" consultas por día: una sola corrida hace varias. */
const LLAMADAS = 3;

function autorizado(header: string | null): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || !header) return false;
  const esperado = Buffer.from(`Bearer ${secreto}`);
  const recibido = Buffer.from(header);
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
}

export async function GET(request: Request) {
  if (!autorizado(request.headers.get('authorization'))) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !clave) return Response.json({ ok: false }, { status: 500 });

  const supabase = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
  for (let i = 0; i < LLAMADAS; i++) {
    const { data, error } = await supabase.rpc('ping');
    if (error || data !== 1) {
      registrarError('mantener-activo: falló ping', error ?? new Error('respuesta inesperada'));
      return Response.json({ ok: false }, { status: 502 });
    }
  }
  return Response.json({ ok: true });
}
