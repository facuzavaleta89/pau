"use client";

import { Ban, CalendarX, Loader2 } from "lucide-react";
import type { MotivoCancelacionTPA } from "@/types";
import { Modal, BOTON_PIE_SECUNDARIO } from "@/components/ui/Modal";

interface TpaCancelarDialogProps {
  /** "¿Cancelar la clase de las 10:30?" / "¿Cancelar el lunes 26 de octubre?" */
  titulo: string;
  subtitulo: string;
  cargando: boolean;
  onElegir: (motivo: MotivoCancelacionTPA) => void;
  onCerrar: () => void;
}

// Cada motivo con su consecuencia a la vista (diseño 7.2). Sin "Otro": corte
// de luz, paro, etc. = cancelada por Pau (decisión 10.2.4).
const MOTIVOS: { motivo: MotivoCancelacionTPA; titulo: string; consecuencia: string; icono: typeof Ban }[] = [
  {
    motivo: 'feriado',
    titulo: 'Feriado',
    consecuencia: 'Recuperan solo los que se quedan con menos de 4 clases en el mes por cada vez por semana.',
    icono: CalendarX,
  },
  {
    motivo: 'cancelada_por_pau',
    titulo: 'Cancelada por mí',
    consecuencia: 'Todos los fijos la recuperan, sin tope y aunque sea el mes que viene. También para corte de luz, paro, etc.',
    icono: Ban,
  },
];

export function TpaCancelarDialog({ titulo, subtitulo, cargando, onElegir, onCerrar }: TpaCancelarDialogProps) {
  return (
    <Modal
      titulo={titulo}
      subtitulo={subtitulo}
      onCerrar={() => !cargando && onCerrar()}
      ancho="md"
      capa={60}
      pie={<button type="button" onClick={onCerrar} disabled={cargando} className={BOTON_PIE_SECUNDARIO}>Volver</button>}
    >
      <div className="p-4 md:p-6 space-y-3">
        <p className="text-sm text-stone-600">
          Las asistencias que ya cargaste no se borran: mientras esté cancelada no cuentan, y vuelven si la reactivás.
        </p>
        {MOTIVOS.map(({ motivo, titulo: t, consecuencia, icono: Icono }) => (
          <button
            key={motivo}
            type="button"
            disabled={cargando}
            onClick={() => onElegir(motivo)}
            className="w-full min-h-11 text-left flex items-start gap-3 p-4 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 hover:border-stone-300 transition-colors duration-150 disabled:opacity-50"
          >
            <Icono size={20} className="shrink-0 mt-0.5 text-stone-500" />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-stone-900">{t}</span>
              <span className="block text-sm text-stone-600 mt-0.5">{consecuencia}</span>
            </span>
            {cargando && <Loader2 size={16} className="shrink-0 animate-spin text-stone-400" />}
          </button>
        ))}
      </div>
    </Modal>
  );
}
