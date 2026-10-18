"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, ShieldX } from 'lucide-react';
import { cerrarSesion, verificarAutorizacion, type EstadoAutorizacion } from '@/lib/auth';
import { registrarError } from '@/lib/errores';

// Con RLS, un usuario logueado que no está autorizado ve todo vacío sin
// ningún error. Esto lo detecta y se lo dice claramente.
// Mientras verifica (o si no se puede saber), muestra la app normal.
export function VerificadorAutorizacion({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoAutorizacion>('desconocido');

  useEffect(() => {
    let cancelado = false;
    verificarAutorizacion().then((resultado) => {
      if (!cancelado) setEstado(resultado);
    });
    return () => { cancelado = true; };
  }, []);

  if (estado !== 'no_autorizada') return <>{children}</>;

  const handleSalir = async () => {
    try {
      await cerrarSesion();
    } catch (error: unknown) {
      registrarError('Error al cerrar sesión', error);
    }
    router.replace('/login');
    router.refresh();
  };

  return (
    <div className="flex items-center justify-center py-12">
      <div role="alert" className="w-full max-w-md bg-white border border-amber-200 rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="shrink-0 h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
            <ShieldX size={20} className="text-amber-600" />
          </span>
          <div className="space-y-2">
            <h1 className="text-base font-semibold text-stone-900">Tu usuario no está autorizado</h1>
            <p className="text-sm text-stone-700">
              Entraste bien, pero este usuario no tiene permiso para ver los datos del consultorio.
              Por eso no se muestra ningún paciente ni turno.
            </p>
            <p className="text-sm text-stone-700">Si sos Pau, avisale a Facu para que te habilite.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSalir}
          className="w-full h-11 flex items-center justify-center gap-2 bg-white hover:bg-stone-50 text-stone-700 text-sm font-medium rounded-lg border border-stone-200 hover:border-stone-300 transition-colors duration-150"
        >
          <LogOut size={16} />
          Salir
        </button>
      </div>
    </div>
  );
}
