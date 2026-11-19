"use client";

import { CheckCircle2 } from 'lucide-react';
import { ESTADOS_PAGO, ESTADOS_SESION_RPG, ORDEN_ESTADOS_PAGO, ORDEN_ESTADOS_SESION_RPG } from '@/lib/estados';
import { MEDIOS_PAGO, ORDEN_MEDIOS_PAGO } from '@/lib/pagos';
import { cn } from '@/lib/utils';
import type { EstadoPago, EstadoSesionRPG, MedioPago } from '@/types';
import { CAMPO_TURNO } from './campo';

interface TurnoEstadoPagoProps {
  estadoSesion: EstadoSesionRPG;
  onEstadoSesion: (estado: EstadoSesionRPG) => void;
  estadoPago: EstadoPago;
  onEstadoPago: (estado: EstadoPago) => void;
  medioPago: MedioPago;
  onMedioPago: (medio: MedioPago) => void;
}

// Estado de la sesión, pago y, si está pagada, el medio (Transferencia / Efectivo).
export function TurnoEstadoPago({
  estadoSesion, onEstadoSesion, estadoPago, onEstadoPago, medioPago, onMedioPago,
}: TurnoEstadoPagoProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="turno-estado" className="text-sm font-semibold text-stone-600 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-stone-400" /> Estado Sesión
          </label>
          <select id="turno-estado" value={estadoSesion} onChange={(e) => onEstadoSesion(e.target.value as EstadoSesionRPG)} className={CAMPO_TURNO}>
            {ORDEN_ESTADOS_SESION_RPG.map((valor) => (
              <option key={valor} value={valor}>{ESTADOS_SESION_RPG[valor].label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="turno-pago" className="text-sm font-semibold text-stone-600 flex items-center gap-1.5">Pago</label>
          <select id="turno-pago" value={estadoPago} onChange={(e) => onEstadoPago(e.target.value as EstadoPago)} className={CAMPO_TURNO}>
            {ORDEN_ESTADOS_PAGO.map((valor) => (
              <option key={valor} value={valor}>{ESTADOS_PAGO[valor].label}</option>
            ))}
          </select>
        </div>
      </div>

      {estadoPago === 'pagado' && (
        <div className="space-y-1.5">
          <span className="text-sm font-semibold text-stone-600">Medio de pago</span>
          <div role="radiogroup" aria-label="Medio de pago" className="grid grid-cols-2 gap-2">
            {ORDEN_MEDIOS_PAGO.map((medio) => (
              <button key={medio} type="button" role="radio" aria-checked={medioPago === medio} onClick={() => onMedioPago(medio)}
                className={cn('h-11 rounded-lg border text-sm font-medium transition-colors duration-150',
                  medioPago === medio ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300')}>
                {MEDIOS_PAGO[medio]}
              </button>
            ))}
          </div>
          <p className="text-xs text-stone-500">El importe y la fecha se ven y se corrigen en Pagos.</p>
        </div>
      )}
    </>
  );
}
