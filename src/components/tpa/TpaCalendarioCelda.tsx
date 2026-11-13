"use client";

import { Clock, Plus } from 'lucide-react';
import { ESTADOS_PAGO, LUGAR_LIBRE } from '@/lib/estados';
import { diaYMes, type CeldaCalendario } from '@/lib/pagos';
import { cn } from '@/lib/utils';

interface TpaCalendarioCeldaProps {
  celda: CeldaCalendario;
  /** Mostrar la hora arriba (en el celular; en la compu la hora va en la columna de la izquierda). */
  conHora?: boolean;
  onCobrar: (pacienteId: string) => void;
  onInscribir: (celda: CeldaCalendario) => void;
}

const FILA = 'w-full min-h-11 md:min-h-9 flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm md:text-xs font-medium text-left transition-colors duration-150';

// Un horario del calendario general: sus 4 lugares. Fijo en verde (pagó el
// mes) o rosa (todavía no): un clic abre Cobrar. Libre: "+ Inscribir fijo".
export function TpaCalendarioCelda({ celda, conHora = false, onCobrar, onInscribir }: TpaCalendarioCeldaProps) {
  const IconoLibre = LUGAR_LIBRE.icono;

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-2.5 shadow-sm flex flex-col gap-1.5">
      {(conHora || !celda.enHorarioHabitual) && (
        <p className="flex items-center gap-1.5 px-1 text-sm font-semibold text-stone-900">
          {conHora && <><Clock size={16} className="text-stone-400" /> {celda.hora}</>}
          {!celda.enHorarioHabitual && <span className="text-xs font-medium text-stone-500">(fuera de horario)</span>}
        </p>
      )}
      <ul className="flex flex-col gap-1.5">
        {celda.lugares.map((lugar, i) => (
          <li key={lugar.tipo === 'fijo' ? lugar.pacienteId : `libre-${i}`}>
            {lugar.tipo === 'fijo' ? (
              <button
                type="button"
                onClick={() => onCobrar(lugar.pacienteId)}
                title={`${lugar.nombre}: ${lugar.pagado ? 'pagó el mes' : 'todavía no pagó'}`}
                className={cn(FILA, ESTADOS_PAGO[lugar.pagado ? 'pagado' : 'pendiente'].clases, 'hover:shadow-sm')}
              >
                <span className="truncate flex-1">{lugar.nombre}</span>
                {lugar.desde && <span className="shrink-0 text-xs opacity-80">desde {diaYMes(lugar.desde)}</span>}
                {lugar.baja && <span className="shrink-0 text-xs opacity-80">baja {diaYMes(lugar.baja)}</span>}
                <span className="sr-only">{lugar.pagado ? ', pagó' : ', no pagó'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onInscribir(celda)}
                aria-label={`Inscribir un fijo en el lugar libre de las ${celda.hora}`}
                className={cn(FILA, LUGAR_LIBRE.clases, 'hover:bg-teal-100')}
              >
                <IconoLibre size={14} className="shrink-0" aria-hidden="true" />
                <span className="flex-1">{LUGAR_LIBRE.label}</span>
                <span className="flex items-center gap-0.5 shrink-0"><Plus size={14} aria-hidden="true" /> Inscribir fijo</span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
