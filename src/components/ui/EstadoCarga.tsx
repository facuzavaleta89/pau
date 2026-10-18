"use client";

import { CircleAlert, RotateCcw } from 'lucide-react';

interface EstadoCargaProps {
  cargando: boolean;
  error: boolean;
  onReintentar: () => void;
}

// Lo que se muestra en lugar de los datos mientras cargan o si la carga falló.
// Nunca una pantalla vacía que parezca "no hay datos".
export function EstadoCarga({ cargando, error, onReintentar }: EstadoCargaProps) {
  if (error && !cargando) {
    return (
      <div role="alert" className="bg-white border border-red-200 rounded-xl p-6 flex flex-col items-center gap-3 text-center">
        <CircleAlert size={24} className="text-red-600" />
        <p className="text-sm text-stone-700">No se pudieron cargar los datos. Revisá la conexión.</p>
        <button
          type="button"
          onClick={onReintentar}
          className="h-11 px-4 flex items-center gap-2 text-sm font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-300 rounded-lg transition-colors duration-150"
        >
          <RotateCcw size={16} />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center py-16" aria-label="Cargando" role="status">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" />
    </div>
  );
}
