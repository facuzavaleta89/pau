"use client";

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SemanaNavProps {
  etiqueta: string;
  onAnterior: () => void;
  onHoy: () => void;
  onSiguiente: () => void;
  textoAnterior?: string;
  textoSiguiente?: string;
}

const BOTON = 'h-11 min-w-11 flex items-center justify-center rounded-lg text-stone-600 hover:text-stone-900 hover:bg-white border border-transparent hover:border-stone-200 transition-colors duration-150';

// Navegación anterior / hoy / siguiente (semana o mes), con botones de 44px.
export function SemanaNav({
  etiqueta, onAnterior, onHoy, onSiguiente,
  textoAnterior = 'Semana anterior', textoSiguiente = 'Semana siguiente',
}: SemanaNavProps) {
  return (
    <div className="flex items-center gap-1 bg-stone-100 border border-stone-200 rounded-xl p-1">
      <button type="button" onClick={onAnterior} aria-label={textoAnterior} className={BOTON}>
        <ChevronLeft size={20} />
      </button>
      <span className="flex-1 text-center text-sm font-semibold text-stone-900 capitalize px-2 truncate">{etiqueta}</span>
      <button type="button" onClick={onHoy} className={`${BOTON} px-3 text-sm font-medium`}>
        Hoy
      </button>
      <button type="button" onClick={onSiguiente} aria-label={textoSiguiente} className={BOTON}>
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
