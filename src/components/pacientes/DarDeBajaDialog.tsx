"use client";

import { useState } from 'react';
import { darDeBajaPaciente } from '@/lib/queries';
import { mensajeErrorAlGuardar, registrarError } from '@/lib/errores';
import { hoyArgentina } from '@/lib/pagos';
import { useToast } from '@/components/ui/ToastProvider';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { Paciente } from '@/types';

interface DarDeBajaDialogProps {
  paciente: Pick<Paciente, 'id' | 'nombre'>;
  onCancelar: () => void;
  onHecho: () => void;
}

// Baja lógica: pregunta la fecha (hoy por defecto). Sus horarios fijos se
// cierran en esa fecha (no debe la cuota de los meses siguientes); su
// historia y sus pagos quedan. Se monta al abrir.
export function DarDeBajaDialog({ paciente, onCancelar, onHecho }: DarDeBajaDialogProps) {
  const toast = useToast();
  const [fecha, setFecha] = useState(() => hoyArgentina(new Date()));
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmar = async () => {
    if (!fecha) {
      setError('Elegí la fecha de baja.');
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const horarios = await darDeBajaPaciente(paciente.id, fecha);
      toast.exito(`${paciente.nombre}: dado de baja${horarios > 0 ? ` (${horarios === 1 ? '1 horario fijo cerrado' : `${horarios} horarios fijos cerrados`})` : ''}`);
      onHecho();
    } catch (err: unknown) {
      registrarError('Error dando de baja al paciente', err);
      setError(mensajeErrorAlGuardar('No se pudo dar de baja.', err));
      setCargando(false);
    }
  };

  return (
    <ConfirmDialog
      abierto
      titulo={`¿Dar de baja a ${paciente.nombre}?`}
      mensaje={
        <>
          <p>
            Deja de aparecer en las listas para elegir pacientes (turnos, inscribir, ocupar lugar).
            Su historia clínica y sus pagos <strong>quedan guardados</strong> y se puede reactivar.
          </p>
          <p>Si es fijo de TPA, sus horarios se cierran en esa fecha: desde ese día ya no figura ni debe la cuota de los meses siguientes.</p>
          <label className="flex flex-col gap-1 text-xs font-semibold text-stone-500">
            Fecha de baja
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="h-11 px-3 bg-white border border-stone-200 rounded-lg text-base md:text-sm font-normal text-stone-900 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </label>
        </>
      }
      textoConfirmar="Dar de baja"
      cargando={cargando}
      error={error}
      onConfirmar={confirmar}
      onCancelar={onCancelar}
    />
  );
}
