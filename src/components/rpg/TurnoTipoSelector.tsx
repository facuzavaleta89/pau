"use client";

import { ORDEN_TIPOS_TURNO, esDomicilio, tipoTurno } from '@/lib/estados';
import { cn } from '@/lib/utils';

interface TurnoTipoSelectorProps {
  valor: string;
  onCambiar: (tipo: string) => void;
}

// "Tipo de turno": 4 botones de 44px con ícono (2 × 2). Domicilio, en violeta.
export function TurnoTipoSelector({ valor, onCambiar }: TurnoTipoSelectorProps) {
  // Un tipo viejo que no está en la lista se conserva como opción: no se pierde al editar.
  const tipos: string[] = ORDEN_TIPOS_TURNO.some((t) => t === valor) ? ORDEN_TIPOS_TURNO : [...ORDEN_TIPOS_TURNO, valor];

  return (
    <div className="space-y-1.5">
      <span className="text-sm font-semibold text-stone-600">Tipo de turno</span>
      <div role="radiogroup" aria-label="Tipo de turno" className="grid grid-cols-2 gap-2">
        {tipos.map((tipo) => {
          const { label, clases, icono: Icono } = tipoTurno(tipo);
          const activo = valor === tipo;
          return (
            <button key={tipo} type="button" role="radio" aria-checked={activo} onClick={() => onCambiar(tipo)}
              className={cn('min-h-11 px-3 flex items-center gap-2 rounded-lg border text-sm font-medium text-left transition-colors duration-150',
                !activo && 'bg-white border-stone-200 text-stone-700 hover:border-stone-300',
                activo && 'ring-1 ring-current',
                activo && (esDomicilio(tipo) ? clases : 'bg-teal-50 border-teal-500 text-teal-800'))}>
              <Icono size={16} className="shrink-0" aria-hidden="true" /> {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
