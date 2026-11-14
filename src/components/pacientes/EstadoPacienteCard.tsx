"use client";

import { useState } from 'react';
import { Archive, RotateCcw } from 'lucide-react';
import { reactivarPaciente } from '@/lib/queries';
import { mensajeErrorAlGuardar, registrarError } from '@/lib/errores';
import { useToast } from '@/components/ui/ToastProvider';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { Paciente } from '@/types';
import { DarDeBajaDialog } from './DarDeBajaDialog';
import { textoBaja } from '@/lib/pacientes';

interface EstadoPacienteCardProps {
  paciente: Pick<Paciente, 'id' | 'nombre' | 'activo' | 'fecha_baja'>;
  onCambio: () => void;
}

const BOTON = 'h-11 md:h-9 px-3 shrink-0 inline-flex items-center justify-center gap-2 text-sm font-medium rounded-lg border transition-colors duration-150';

// Al pie de la ficha: "Dar de baja" (activo) o "Dado de baja el 13/11/2026 · Reactivar".
export function EstadoPacienteCard({ paciente, onCambio }: EstadoPacienteCardProps) {
  const toast = useToast();
  const [abierto, setAbierto] = useState<'baja' | 'reactivar' | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reactivar = async () => {
    setCargando(true);
    setError(null);
    try {
      await reactivarPaciente(paciente.id);
      toast.exito(`${paciente.nombre}: reactivado`);
      setAbierto(null);
      onCambio();
    } catch (err: unknown) {
      registrarError('Error reactivando al paciente', err);
      setError(mensajeErrorAlGuardar('No se pudo reactivar.', err));
    } finally {
      setCargando(false);
    }
  };

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
      <ConfirmDialog
        abierto={abierto === 'reactivar'}
        titulo={`¿Reactivar a ${paciente.nombre}?`}
        mensaje={<p>Vuelve a aparecer en las listas. Sus horarios fijos no se reabren: si vuelve a TPA, inscribilo desde TPA → Calendario.</p>}
        textoConfirmar="Reactivar"
        cargando={cargando}
        error={error}
        onConfirmar={reactivar}
        onCancelar={() => { setAbierto(null); setError(null); }}
      />
    </div>
  );
}
