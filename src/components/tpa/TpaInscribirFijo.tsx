"use client";

import { useCallback } from 'react';
import { getPacientesActivos } from '@/lib/queries';
import { DIAS_TPA } from '@/lib/tpa';
import type { CeldaCalendario } from '@/lib/pagos';
import { useDatos } from '@/hooks/useDatos';
import { EstadoCarga } from '@/components/ui/EstadoCarga';
import { Modal, BOTON_PIE_SECUNDARIO } from '@/components/ui/Modal';
import { TpaInscripcion } from './TpaInscripcion';

interface TpaInscribirFijoProps {
  celda: CeldaCalendario;
  /** "Fijo desde" sugerido: el 1 del mes que se está mirando. */
  fechaAltaInicial: string;
  onCerrar: () => void;
  /** Recarga el calendario y la semana. */
  onCambio: () => void;
}

// "+ Inscribir fijo" desde un lugar libre del Calendario: el mismo
// TpaInscripcion del modal de la clase, con ese día y hora.
export function TpaInscribirFijo({ celda, fechaAltaInicial, onCerrar, onCambio }: TpaInscribirFijoProps) {
  const cargar = useCallback(() => getPacientesActivos(), []);
  const { datos, cargando, error, recargar } = useDatos('pacientes-activos', cargar, 'No se pudo cargar la lista de pacientes.');
  const dia = DIAS_TPA.find((d) => d.id === celda.dia)?.label ?? celda.dia;

  return (
    <Modal
      titulo={`Fijos de los ${dia.toLowerCase()} a las ${celda.hora}`}
      subtitulo={`${celda.fijosActuales.length} de ${celda.cupo} lugares con fijos hoy`}
      onCerrar={onCerrar}
      ancho="lg"
      pie={<button type="button" onClick={onCerrar} className={BOTON_PIE_SECUNDARIO}>Cerrar</button>}
    >
      {datos ? (
        <TpaInscripcion celda={celda} todosPacientes={datos} onCambio={onCambio} fechaAltaInicial={fechaAltaInicial} />
      ) : (
        <div className="p-4"><EstadoCarga cargando={cargando} error={error} onReintentar={recargar} /></div>
      )}
    </Modal>
  );
}
