"use client";

import { useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { useConexion } from '@/hooks/useConexion';

// Aviso fijo mientras no hay conexión, y recarga al volver con "atrás" a una
// página que el navegador restauró de memoria (bfcache): esa copia muestra los
// datos de cuando se cargó, sin volver a pedirlos y sin ningún aviso.
export function AvisoSinConexion() {
  const conectada = useConexion();

  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted && navigator.onLine) window.location.reload();
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  if (conectada) return null;

  return (
    <div
      role="status"
      className="sticky top-16 z-30 flex items-center gap-2 px-4 md:px-6 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-800"
    >
      <WifiOff size={16} className="shrink-0 text-amber-600" />
      <span>Sin conexión. Lo que ves puede no estar actualizado y no se puede guardar.</span>
    </div>
  );
}
