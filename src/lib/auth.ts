import { supabase } from './supabase';
import { ErrorApp } from './errores';

// Todas las operaciones de autenticación. Como con queries.ts, los
// componentes no llaman a supabase.auth directamente.

// Distingue "Pau tocó Salir" de "la sesión se cerró sola" (token revocado,
// salió en otra pestaña, etc.), para no mostrarle "sesión cerrada" al salir.
let cierreVoluntario = false;

export async function iniciarSesion(email: string, password: string): Promise<void> {
  cierreVoluntario = false;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return;

  if (error.code === 'invalid_credentials') throw new ErrorApp('Email o contraseña incorrectos.');
  if (error.status === 429) throw new ErrorApp('Demasiados intentos. Esperá unos minutos y probá de nuevo.');
  throw error;
}

// scope 'local': cierra la sesión solo en este dispositivo.
export async function cerrarSesion(): Promise<void> {
  cierreVoluntario = true;
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) {
    cierreVoluntario = false;
    throw error;
  }
}

// Llama a `alCerrar` si la sesión se cierra sin que Pau haya tocado Salir.
// Devuelve la función para dejar de escuchar.
export function escucharCierreInesperado(alCerrar: () => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((evento) => {
    if (evento === 'SIGNED_OUT' && !cierreVoluntario) alCerrar();
  });
  return () => data.subscription.unsubscribe();
}

export type EstadoAutorizacion = 'autorizada' | 'no_autorizada' | 'desconocido';

// ¿La usuaria logueada está en private.usuarias_autorizadas?
// 'desconocido' si no se pudo saber (por ejemplo, la función
// public.soy_autorizada() todavía no existe en la base, o no hay red):
// en ese caso la app sigue como si estuviera autorizada y RLS protege igual.
export async function verificarAutorizacion(): Promise<EstadoAutorizacion> {
  const { data, error } = await supabase.rpc('soy_autorizada');
  if (error || typeof data !== 'boolean') return 'desconocido';
  return data ? 'autorizada' : 'no_autorizada';
}
