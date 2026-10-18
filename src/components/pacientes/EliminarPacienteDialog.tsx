"use client";

import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { contarDatosPaciente, eliminarPaciente, type DatosPaciente } from '@/lib/queries';
import { mensajeError, registrarError } from '@/lib/errores';
import type { Paciente } from '@/types';

interface EliminarPacienteDialogProps {
  paciente: Pick<Paciente, 'id' | 'nombre'> | null;
  onCancelar: () => void;
  onEliminado: () => void;
}

function plural(n: number, singular: string, pluralTxt: string) {
  return `${n} ${n === 1 ? singular : pluralTxt}`;
}

export function EliminarPacienteDialog({ paciente, onCancelar, onEliminado }: EliminarPacienteDialogProps) {
  const [datos, setDatos] = useState<DatosPaciente | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paciente) return;
    let cancelado = false;
    contarDatosPaciente(paciente.id)
      .then((d) => { if (!cancelado) setDatos(d); })
      .catch((err: unknown) => {
        registrarError('Error contando datos del paciente', err);
        if (!cancelado) setError(mensajeError(err));
      });
    return () => {
      cancelado = true;
      setDatos(null);
      setError(null);
      setCargando(false);
    };
  }, [paciente]);

  const handleConfirmar = async () => {
    if (!paciente) return;
    setCargando(true);
    setError(null);
    try {
      await eliminarPaciente(paciente.id);
      onEliminado();
    } catch (err: unknown) {
      registrarError('Error eliminando paciente', err);
      setError(mensajeError(err));
      setCargando(false);
    }
  };

  return (
    <ConfirmDialog
      abierto={paciente !== null}
      peligroso
      titulo={`¿Eliminar a ${paciente?.nombre ?? ''}?`}
      mensaje={
        <>
          <p>
            Se va a borrar su ficha y <strong>toda su historia</strong>
            {datos
              ? `: ${plural(datos.turnos, 'turno RPG', 'turnos RPG')}, ${plural(datos.asistencias, 'asistencia TPA', 'asistencias TPA')}, ${plural(datos.pagos, 'pago', 'pagos')} y ${plural(datos.horarios, 'horario fijo', 'horarios fijos')}.`
              : ' (turnos, asistencias, pagos y horarios fijos).'}
          </p>
          <p className="font-semibold text-red-700">No se puede deshacer.</p>
        </>
      }
      textoConfirmar="Eliminar definitivamente"
      cargando={cargando}
      error={error}
      onConfirmar={handleConfirmar}
      onCancelar={onCancelar}
    />
  );
}
