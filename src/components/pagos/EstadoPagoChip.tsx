"use client";

import { ESTADOS_PAGO } from '@/lib/estados';
import { MEDIOS_PAGO, diaYMes } from '@/lib/pagos';
import type { MedioPago } from '@/types';
import { cn } from '@/lib/utils';

interface EstadoPagoChipProps {
  /** null = pendiente. */
  pago: { pagadoEl: string | null; medio: MedioPago | null } | null;
  /** Texto en lugar de "Pendiente" (por ejemplo, "Todavía no se hizo"). */
  textoPendiente?: string;
  /** Pendiente que no es deuda todavía: gris. */
  apagado?: boolean;
}

// Verde "Pagó el 5/11 · Efectivo" o rosa "Pendiente" (colores de ESTADOS_PAGO).
export function EstadoPagoChip({ pago, textoPendiente, apagado = false }: EstadoPagoChipProps) {
  const config = ESTADOS_PAGO[pago ? 'pagado' : 'pendiente'];
  const Icono = config.icono;
  const texto = pago
    ? [pago.pagadoEl ? `Pagó el ${diaYMes(pago.pagadoEl)}` : 'Pagó', pago.medio && MEDIOS_PAGO[pago.medio]].filter(Boolean).join(' · ')
    : textoPendiente ?? config.label;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap',
        apagado && !pago ? 'bg-stone-50 text-stone-500 border-stone-200' : config.clases
      )}
    >
      <Icono size={12} aria-hidden="true" /> {texto}
    </span>
  );
}
