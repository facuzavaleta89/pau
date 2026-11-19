"use client";

import { parseISO } from 'date-fns';
import { TurnoModal } from '@/components/rpg/TurnoModal';
import { TpaClaseModal } from '@/components/tpa/TpaClaseModal';
import { HistoriaClinicaModal } from '@/components/pacientes/HistoriaClinicaModal';
import type { DatosRecuperaciones } from '@/lib/recuperaciones';
import type { FilaAlerta } from '@/lib/alertas';
import type { CeldaTPA, SesionRPG } from '@/types';

export type ModalAgenda =
  | { tipo: 'turno'; turno: SesionRPG | null; fecha?: string; hora?: string }
  | { tipo: 'clase'; clave: string; ocupar: boolean };

interface AgendaModalesProps {
  abierto: ModalAgenda | null;
  /** La clase abierta, buscada en los datos actuales (al recargar, el modal ve los cambios). */
  celda: CeldaTPA | null;
  datosRec: DatosRecuperaciones | null;
  filasAlertas: FilaAlerta[] | null;
  pacienteHistoria: string | null;
  onCerrar: () => void;
  onCerrarHistoria: () => void;
  onGuardadoTurno: () => void;
  onGuardadoClase: () => void;
}

// Los modales de siempre, abiertos desde la agenda: turno, clase de TPA e historia clínica.
export function AgendaModales({
  abierto, celda, datosRec, filasAlertas, pacienteHistoria, onCerrar, onCerrarHistoria, onGuardadoTurno, onGuardadoClase,
}: AgendaModalesProps) {
  return (
    <>
      {abierto?.tipo === 'turno' && (
        <TurnoModal
          onClose={onCerrar}
          turno={abierto.turno}
          selectedDate={abierto.fecha ? parseISO(abierto.fecha) : undefined}
          horaInicial={abierto.hora}
          onSave={onGuardadoTurno}
        />
      )}

      {abierto?.tipo === 'clase' && celda && (
        <TpaClaseModal
          key={celda.clave}
          celda={celda}
          datosRec={datosRec}
          filasAlertas={filasAlertas}
          abrirOcupar={abierto.ocupar}
          onClose={onCerrar}
          onGuardado={onGuardadoClase}
        />
      )}

      <HistoriaClinicaModal
        isOpen={pacienteHistoria !== null}
        onClose={onCerrarHistoria}
        pacienteId={pacienteHistoria}
        onCambioPaciente={onGuardadoClase}
      />
    </>
  );
}
