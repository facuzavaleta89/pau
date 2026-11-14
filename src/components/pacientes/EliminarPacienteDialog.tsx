"use client";

import { useCallback, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { contarDatosPaciente, eliminarPaciente, type DatosPaciente } from '@/lib/queries';
import { mensajeError, registrarError } from '@/lib/errores';
import { useDatos } from '@/hooks/useDatos';
import type { Paciente } from '@/types';

interface EliminarPacienteDialogProps {
  paciente: Pick<Paciente, 'id' | 'nombre' | 'activo'>;
  onCancelar: () => void;
  onEliminado: () => void;
  /** Tiene historial: en lugar de eliminar, dar de baja. */
  onDarDeBaja: () => void;
}

function plural(n: number, singular: string, pluralTxt: string) {
  return `${n} ${n === 1 ? singular : pluralTxt}`;
}

function textoDatos(d: DatosPaciente): string {
  return [
    d.turnos > 0 && plural(d.turnos, 'turno RPG', 'turnos RPG'),
    d.asistencias > 0 && plural(d.asistencias, 'asistencia TPA', 'asistencias TPA'),
    d.notas > 0 && plural(d.notas, 'nota de evolución', 'notas de evolución'),
    d.pagos > 0 && plural(d.pagos, 'pago', 'pagos'),
    d.horarios > 0 && plural(d.horarios, 'horario fijo', 'horarios fijos'),
    d.listaEspera > 0 && 'lista de espera',
  ].filter(Boolean).join(', ');
}

// "Eliminar definitivamente" solo para un paciente SIN ningún dato (cargado
// por error). Con historial, la base no lo deja borrar (FK RESTRICT) y se
// ofrece darlo de baja. Se monta al abrir.
export function EliminarPacienteDialog({ paciente, onCancelar, onEliminado, onDarDeBaja }: EliminarPacienteDialogProps) {
  const cargar = useCallback(() => contarDatosPaciente(paciente.id), [paciente.id]);
  const { datos, error: errorCarga } = useDatos(`datos-${paciente.id}`, cargar, 'No se pudo revisar su historial.');
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = datos ? Object.values(datos).reduce((n, v) => n + v, 0) : null;

  const eliminar = async () => {
    // Todavía contando: esperar. Si el conteo falló, se intenta igual: la base
    // no deja borrar a alguien con historial.
    if (total === null && !errorCarga) return;
    setBorrando(true);
    setError(null);
    try {
      await eliminarPaciente(paciente.id);
      onEliminado();
    } catch (err: unknown) {
      registrarError('Error eliminando paciente', err);
      setError(mensajeError(err));
      setBorrando(false);
    }
  };

  if (datos && total !== null && total > 0) {
    return (
      <ConfirmDialog
        abierto
        titulo={`${paciente.nombre} tiene historial`}
        mensaje={
          <>
            <p>Tiene {textoDatos(datos)}: no se puede eliminar, para no perder su historia.</p>
            <p>
              {paciente.activo
                ? 'Si ya no viene, dalo de baja: deja de aparecer en las listas y su historia queda guardada.'
                : 'Ya está dado de baja: no aparece en las listas y su historia queda guardada.'}
            </p>
          </>
        }
        textoConfirmar={paciente.activo ? 'Dar de baja' : 'Entendido'}
        onConfirmar={paciente.activo ? onDarDeBaja : onCancelar}
        onCancelar={onCancelar}
      />
    );
  }

  return (
    <ConfirmDialog
      abierto
      peligroso
      titulo={`¿Eliminar a ${paciente.nombre}?`}
      mensaje={
        <>
          <p>
            {total === null
              ? errorCarga ? 'No se pudo revisar si tiene datos. Si tiene historial, la base no deja eliminarlo.' : 'Revisando si tiene datos guardados…'
              : 'No tiene turnos, asistencias, notas, pagos ni horarios: se borra su ficha (por ejemplo, si se cargó por error).'}
          </p>
          <p className="font-semibold text-red-700">No se puede deshacer.</p>
        </>
      }
      textoConfirmar="Eliminar definitivamente"
      cargando={borrando}
      error={error ?? errorCarga}
      onConfirmar={eliminar}
      onCancelar={onCancelar}
    />
  );
}
