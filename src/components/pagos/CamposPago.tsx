"use client";

import { MEDIOS_PAGO, ORDEN_MEDIOS_PAGO } from '@/lib/pagos';
import type { MedioPago } from '@/types';
import { cn } from '@/lib/utils';

export const INPUT_PAGO =
  'h-11 w-full bg-white border border-stone-200 text-stone-900 text-base md:text-sm px-3 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';
export const ETIQUETA_PAGO = 'flex flex-col gap-1 text-xs font-semibold text-stone-500';

export interface ValoresPago {
  /** '' mientras el campo está vacío. */
  importe: number | '';
  medio: MedioPago;
  /** 'yyyy-MM-dd' */
  pagadoEl: string;
  nota: string;
}

interface CamposPagoProps {
  valores: ValoresPago;
  onCambiar: (cambios: Partial<ValoresPago>) => void;
  /** Debajo del importe: motivo o aviso ("Después del 10: …"). */
  debajoDelImporte?: React.ReactNode;
  /** Sin nota (RPG). */
  conNota?: boolean;
}

// Importe, medio (transferencia / efectivo), fecha y nota de un pago. Lo usan
// los paneles de cobrar cuota, clases sueltas y sesiones de RPG.
export function CamposPago({ valores, onCambiar, debajoDelImporte, conNota = true }: CamposPagoProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className={ETIQUETA_PAGO}>
          Importe
          <span className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">$</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={valores.importe}
              onChange={(e) => onCambiar({ importe: e.target.value === '' ? '' : Math.max(0, Math.round(Number(e.target.value))) })}
              className={cn(INPUT_PAGO, 'pl-7')}
            />
          </span>
        </label>
        <label className={ETIQUETA_PAGO}>
          Fecha de pago
          <input
            type="date"
            required
            value={valores.pagadoEl}
            onChange={(e) => onCambiar({ pagadoEl: e.target.value })}
            className={INPUT_PAGO}
          />
        </label>
      </div>
      {debajoDelImporte}

      <div className="space-y-1">
        <span className="text-xs font-semibold text-stone-500">Medio</span>
        <div role="radiogroup" aria-label="Medio de pago" className="grid grid-cols-2 gap-2">
          {ORDEN_MEDIOS_PAGO.map((medio) => (
            <button
              key={medio}
              type="button"
              role="radio"
              aria-checked={valores.medio === medio}
              onClick={() => onCambiar({ medio })}
              className={cn(
                'h-11 rounded-lg border text-sm font-medium transition-colors duration-150',
                valores.medio === medio
                  ? 'bg-teal-600 border-teal-600 text-white'
                  : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300'
              )}
            >
              {MEDIOS_PAGO[medio]}
            </button>
          ))}
        </div>
      </div>

      {conNota && (
        <label className={ETIQUETA_PAGO}>
          Nota (opcional)
          <input
            type="text"
            maxLength={500}
            value={valores.nota}
            onChange={(e) => onCambiar({ nota: e.target.value })}
            placeholder="Por ejemplo: pagó en dos partes"
            className={INPUT_PAGO}
          />
        </label>
      )}
    </div>
  );
}
