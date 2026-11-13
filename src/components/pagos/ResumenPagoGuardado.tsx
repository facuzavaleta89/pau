"use client";

import { CircleCheck } from 'lucide-react';
import { ESTADOS_PAGO } from '@/lib/estados';
import { MEDIOS_PAGO, diaYMes, formatoPesos } from '@/lib/pagos';
import type { MedioPago } from '@/types';
import { cn } from '@/lib/utils';

interface ResumenPagoGuardadoProps {
  pago: { importe: number; pagadoEl: string | null; medio: MedioPago | null; nota?: string | null };
  /** "Plan 1 vez por semana", "2 clases"… */
  detalle?: string;
  /** El importe no se guardó: es el precio del mes. */
  importeEstimado?: boolean;
}

// "Pagó el 5/11 · Transferencia · $50.000" en verde, con la nota si tiene.
export function ResumenPagoGuardado({ pago, detalle, importeEstimado = false }: ResumenPagoGuardadoProps) {
  const partes = [
    pago.pagadoEl ? `Pagó el ${diaYMes(pago.pagadoEl)}` : 'Pagó',
    pago.medio ? MEDIOS_PAGO[pago.medio] : 'sin medio',
    `${formatoPesos(pago.importe)}${importeEstimado ? ' (precio del mes)' : ''}`,
  ];
  return (
    <div className={cn('rounded-lg border px-4 py-3 space-y-1', ESTADOS_PAGO.pagado.clases)}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <CircleCheck size={16} aria-hidden="true" /> {partes.join(' · ')}
      </p>
      {detalle && <p className="text-sm text-stone-700">{detalle}</p>}
      {pago.nota && <p className="text-sm text-stone-600">Nota: {pago.nota}</p>}
    </div>
  );
}
