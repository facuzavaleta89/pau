"use client";

import { formatoPesos, type ResumenMes } from '@/lib/pagos';
import { cn } from '@/lib/utils';

interface PagosCifrasProps {
  resumen: ResumenMes;
}

const CARD = 'bg-white border border-stone-200 rounded-xl p-4 shadow-sm space-y-1 min-w-0';
const TITULO = 'text-sm font-medium text-stone-600';
const CIFRA = 'text-xl md:text-2xl font-semibold tabular-nums truncate';

// Las cuatro cifras del mes: Cobrado · Falta cobrar · Total del mes · Efectivo / Transferencia.
export function PagosCifras({ resumen }: PagosCifrasProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className={CARD}>
        <p className={TITULO}>Cobrado</p>
        <p className={cn(CIFRA, 'text-emerald-700')}>{formatoPesos(resumen.cobrado)}</p>
      </div>
      <div className={CARD}>
        <p className={TITULO}>Falta cobrar</p>
        <p className={cn(CIFRA, 'text-pink-700')}>{formatoPesos(resumen.faltaCobrar)}</p>
      </div>
      <div className={CARD}>
        <p className={TITULO}>Total del mes</p>
        <p className={cn(CIFRA, 'text-stone-900')}>{formatoPesos(resumen.total)}</p>
      </div>
      <div className={CARD}>
        <p className={TITULO}>Efectivo / Transf.</p>
        <p className="text-sm text-stone-700 tabular-nums">Efectivo <span className="font-semibold">{formatoPesos(resumen.efectivo)}</span></p>
        <p className="text-sm text-stone-700 tabular-nums">Transferencia <span className="font-semibold">{formatoPesos(resumen.transferencia)}</span></p>
        {resumen.sinMedio > 0 && <p className="text-xs text-stone-500 tabular-nums">Sin medio (RPG) {formatoPesos(resumen.sinMedio)}</p>}
      </div>
    </div>
  );
}
