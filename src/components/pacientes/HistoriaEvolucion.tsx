"use client";

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CalendarCheck, Plus } from 'lucide-react';
import { actualizarNota, borrarNota, crearNotaLibre, type HistoriaClinica } from '@/lib/queries';
import { lineaDeTiempo } from '@/lib/evolucion';
import { calcularRecuperaciones, textoResumenMes } from '@/lib/recuperaciones';
import { textoAlertaFaltas, type AlertaFaltas } from '@/lib/alertas';
import { ALERTA_FALTAS } from '@/lib/estados';
import { mensajeErrorAlGuardar, registrarError } from '@/lib/errores';
import { cn, nuevoId } from '@/lib/utils';
import { useToast } from '@/components/ui/ToastProvider';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { NotaEvolucion } from '@/types';
import { EvolucionItem } from './EvolucionItem';
import { NotaEvolucionForm } from './NotaEvolucionForm';

interface HistoriaEvolucionProps {
  historia: HistoriaClinica;
  alerta: AlertaFaltas | null;
  /** Recarga la historia después de crear, editar o borrar una nota. */
  onCambio: () => void;
}

// Pestaña "Evolución" (diseño 7.5): alerta de faltas, resumen del mes, "+ Nota"
// (nota libre) y la línea de tiempo con notas, asistencias de TPA y sesiones de RPG.
export function HistoriaEvolucion({ historia, alerta, onCambio }: HistoriaEvolucionProps) {
  const toast = useToast();
  const [ahora] = useState(() => new Date());
  const hoy = format(ahora, 'yyyy-MM-dd');
  // Nota libre nueva: id generado al abrir el formulario (reintentar no duplica).
  const [nueva, setNueva] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [aBorrar, setABorrar] = useState<NotaEvolucion | null>(null);
  const [guardando, setGuardando] = useState(false);

  const items = useMemo(() => lineaDeTiempo(historia), [historia]);
  const resumen = useMemo(() => {
    const mes = hoy.slice(0, 7);
    const saldo = calcularRecuperaciones(mes, historia.recuperaciones, hoy).find((s) => s.pacienteId === historia.paciente.id);
    return textoResumenMes(mes, saldo, historia.asistencias);
  }, [historia, hoy]);
  const IconoAlerta = ALERTA_FALTAS.icono;

  // Los mensajes de error nunca llevan el texto de la nota (datos de salud).
  const ejecutar = async (accion: () => Promise<unknown>, exito: string, fallo: string, alTerminar: () => void) => {
    setGuardando(true);
    try {
      await accion();
      toast.exito(exito);
      alTerminar();
      onCambio();
    } catch (error: unknown) {
      registrarError('Error con una nota de evolución', error);
      toast.error(mensajeErrorAlGuardar(fallo, error));
    } finally {
      setGuardando(false);
    }
  };

  const guardarNueva = (texto: string, fecha: string | null) => nueva && ejecutar(
    () => crearNotaLibre({ id: nueva, paciente_id: historia.paciente.id, fecha: fecha ?? hoy, texto }),
    'Nota guardada', 'No se pudo guardar la nota.', () => setNueva(null),
  );
  const guardarEdicion = (nota: NotaEvolucion, texto: string, fecha: string | null) => ejecutar(
    () => actualizarNota(nota.id, fecha ? { texto, fecha } : { texto }),
    'Nota guardada', 'No se pudo guardar la nota.', () => setEditando(null),
  );
  const confirmarBorrado = () => aBorrar && ejecutar(
    () => borrarNota(aBorrar.id), 'Nota borrada', 'No se pudo borrar la nota.', () => setABorrar(null),
  );

  return (
    <div className="space-y-4">
      {alerta && (
        <div role="status" className={cn('flex items-start gap-3 rounded-xl border px-4 py-3', ALERTA_FALTAS.clases)}>
          <IconoAlerta size={20} className="shrink-0 mt-0.5 text-red-600" aria-hidden="true" />
          <p className="text-sm">
            <strong className="font-semibold">{textoAlertaFaltas(alerta)}</strong> en sus clases de TPA como fijo. El lugar no se libera solo.
          </p>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        {resumen && (
          <p className="flex-1 flex items-start gap-2 text-sm text-stone-700 bg-white border border-stone-200 rounded-xl px-4 py-3">
            <CalendarCheck size={16} className="shrink-0 mt-0.5 text-teal-600" aria-hidden="true" />
            {resumen}
          </p>
        )}
        {nueva === null && (
          <button
            type="button"
            onClick={() => { setEditando(null); setNueva(nuevoId()); }}
            className="md:ml-auto h-11 px-4 flex items-center justify-center gap-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors duration-150"
          >
            <Plus size={16} /> Nota
          </button>
        )}
      </div>

      {nueva !== null && (
        <div className="bg-white border border-teal-200 rounded-xl p-4 shadow-sm space-y-2">
          <h3 className="text-sm font-semibold text-stone-900">Nota libre (sin clase)</h3>
          <NotaEvolucionForm textoInicial="" fechaInicial={hoy} guardando={guardando} onGuardar={guardarNueva} onCancelar={() => setNueva(null)} />
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-stone-500 bg-white border border-dashed border-stone-200 rounded-xl px-4 py-6 text-center">
          Todavía no hay clases, sesiones ni notas.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <EvolucionItem
              key={item.clave}
              item={item}
              editando={item.tipo !== 'rpg' && item.nota !== null && editando === item.nota.id}
              guardando={guardando}
              onEditar={(nota) => { setNueva(null); setEditando(nota.id); }}
              onGuardar={guardarEdicion}
              onCancelar={() => setEditando(null)}
              onBorrar={setABorrar}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        abierto={aBorrar !== null}
        titulo="¿Borrar esta nota?"
        mensaje={<p>Se borra la nota de evolución. La asistencia de esa clase no cambia. No se puede deshacer.</p>}
        textoConfirmar="Borrar nota"
        peligroso
        cargando={guardando}
        onConfirmar={confirmarBorrado}
        onCancelar={() => setABorrar(null)}
      />
    </div>
  );
}
