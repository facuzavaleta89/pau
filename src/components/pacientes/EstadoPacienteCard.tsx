"use client";

import { useState } from 'react';
import { Archive, RotateCcw } from 'lucide-react';
import type { Paciente } from '@/types';
import { DarDeBajaDialog } from './DarDeBajaDialog';
import { ReactivarPacienteDialog } from './ReactivarPacienteDialog';
import { textoBaja } from '@/lib/pacientes';

interface EstadoPacienteCardProps {
  paciente: Pick<Paciente, 'id' | 'nombre' | 'activo' | 'fecha_baja'>;
  onCambio: () => void;
}

const BOTON = 'h-11 md:h-9 px-3 shrink-0 inline-flex items-center justify-center gap-2 text-sm font-medium rounded-lg border transition-colors duration-150';

// Al pie de la ficha: "Dar de baja" (activo) o "Dado de baja el 13/11/2026 ·
// Reactivar" (con la opción, aparte, de recuperar sus horarios de TPA).
export function EstadoPacienteCard({ paciente, onCambio }: EstadoPacienteCardProps) {
  const [abierto, setAbierto] = useState<'baja' | 'reactivar' | null>(null);

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
      {paciente.activo ? (
        <>
          <p className="flex-1 text-sm text-stone-600">Si ya no viene, dalo de baja: deja de aparecer en las listas y su historia queda guardada.</p>
          <button type="button" onClick={() => setAbierto('baja')} className={`${BOTON} bg-white border-stone-200 text-stone-700 hover:bg-stone-50`}>
            <Archive size={16} /> Dar de baja
          </button>
        </>
      ) : (
        <>
          <p className="flex-1 text-sm font-medium text-stone-700">{textoBaja(paciente)}. No aparece en las listas para elegir pacientes.</p>
          <button type="button" onClick={() => setAbierto('reactivar')} className={`${BOTON} bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100`}>
            <RotateCcw size={16} /> Reactivar
          </button>
        </>
      )}

      {abierto === 'baja' && (
        <DarDeBajaDialog paciente={paciente} onCancelar={() => setAbierto(null)} onHecho={() => { setAbierto(null); onCambio(); }} />
      )}
      {abierto === 'reactivar' && (
        <ReactivarPacienteDialog paciente={paciente} onCancelar={() => setAbierto(null)} onHecho={() => { setAbierto(null); onCambio(); }} />
      )}
    </div>
  );
}
