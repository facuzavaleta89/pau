"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Plus, Trash2, User } from "lucide-react";
import { createHorarioTPA, deactivateHorarioTPA } from "@/lib/queries";
import { mensajeErrorAlGuardar, registrarError } from "@/lib/errores";
import { DIAS_TPA } from "@/lib/tpa";
import type { CeldaTPA, HorarioTPA, Paciente } from "@/types";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";

interface TpaInscripcionProps {
  celda: CeldaTPA;
  todosPacientes: Paciente[];
  /** Recarga la semana (el modal se actualiza sin cerrarse ni perder marcas). */
  onCambio: () => void;
}

// Pestaña "Alumnos fijos": quiénes son fijos HOY de este día y hora.
export function TpaInscripcion({ celda, todosPacientes, onCambio }: TpaInscripcionProps) {
  const toast = useToast();
  const [seleccionado, setSeleccionado] = useState('');
  // Desde qué fecha es fijo: hoy por defecto; se puede elegir otra (pasada o futura).
  const [hoy] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [fechaAlta, setFechaAlta] = useState(hoy);
  const [inscribiendo, setInscribiendo] = useState(false);
  const [aDesinscribir, setADesinscribir] = useState<HorarioTPA | null>(null);
  const [desinscribiendo, setDesinscribiendo] = useState(false);

  const diaLabel = DIAS_TPA.find(d => d.id === celda.dia)?.label.toLowerCase() ?? celda.dia;
  const disponibles = todosPacientes.filter(p => !celda.fijosActuales.some(h => h.paciente_id === p.id));

  const handleInscribir = async () => {
    if (!seleccionado || !fechaAlta) return;
    setInscribiendo(true);
    try {
      await createHorarioTPA({ paciente_id: seleccionado, dia_semana: celda.dia, hora: celda.hora, fecha_alta: fechaAlta });
      setSeleccionado('');
      setFechaAlta(hoy);
      toast.exito('Alumno inscripto');
      onCambio();
    } catch (err: unknown) {
      registrarError("Error inscribiendo alumno", err);
      toast.error(mensajeErrorAlGuardar("No se pudo inscribir al alumno.", err));
    } finally {
      setInscribiendo(false);
    }
  };

  const handleDesinscribir = async () => {
    if (!aDesinscribir) return;
    setDesinscribiendo(true);
    try {
      await deactivateHorarioTPA(aDesinscribir);
      toast.exito('Alumno desinscripto');
      setADesinscribir(null);
      onCambio();
    } catch (err: unknown) {
      registrarError("Error desinscribiendo alumno", err);
      toast.error(mensajeErrorAlGuardar("No se pudo desinscribir al alumno.", err));
    } finally {
      setDesinscribiendo(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
          Fijos de los {diaLabel} a las {celda.hora}
        </h3>
        {celda.fijosActuales.length === 0 ? (
          <p className="text-sm text-stone-500 bg-stone-50 rounded-xl border border-dashed border-stone-200 py-6 text-center">
            Todavía no hay alumnos fijos en este horario.
          </p>
        ) : (
          <ul className="space-y-2">
            {celda.fijosActuales.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2 pl-3 rounded-lg border border-stone-200 bg-white">
                <span className="flex items-center gap-2 min-w-0 text-sm font-medium text-stone-900">
                  <User size={16} className="text-stone-400 shrink-0" />
                  <span className="truncate">{h.pacientes?.nombre}</span>
                  <span className={cn("shrink-0 text-xs font-normal", h.fecha_alta > hoy ? "text-teal-700" : "text-stone-500")}>
                    {h.fecha_alta > hoy ? 'empieza el ' : 'desde '}{format(parseISO(h.fecha_alta), 'dd/MM/yyyy')}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setADesinscribir(h)}
                  aria-label={`Desinscribir a ${h.pacientes?.nombre ?? 'este alumno'}`}
                  className="h-11 w-11 flex items-center justify-center text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-150"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2 border-t border-stone-200 pt-5">
        <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Inscribir alumno fijo</h3>
        <div className="flex flex-col sm:flex-row sm:items-end gap-2">
          <select
            value={seleccionado}
            onChange={(e) => setSeleccionado(e.target.value)}
            aria-label="Paciente a inscribir"
            className="flex-1 min-w-0 h-11 bg-white border border-stone-200 text-stone-900 text-base md:text-sm px-3 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          >
            <option value="">Elegir paciente…</option>
            {disponibles.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}{p.tipo_clase ? ` (${p.tipo_clase})` : ''}</option>
            ))}
          </select>
          <label className="flex flex-col gap-1 text-xs text-stone-500 sm:w-40">
            Fijo desde
            <input
              type="date"
              value={fechaAlta}
              onChange={(e) => setFechaAlta(e.target.value)}
              required
              className="h-11 bg-white border border-stone-200 text-stone-900 text-base md:text-sm px-3 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </label>
          <button
            type="button"
            onClick={handleInscribir}
            disabled={inscribiendo || !seleccionado || !fechaAlta}
            className="h-11 px-4 flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Plus size={16} /> Inscribir
          </button>
        </div>
        {fechaAlta && fechaAlta !== hoy && (
          <p className="text-xs text-stone-500">
            {fechaAlta > hoy
              ? `Aparece en la grilla desde el ${format(parseISO(fechaAlta), 'dd/MM/yyyy')}.`
              : `Aparece como fijo también en las semanas pasadas, desde el ${format(parseISO(fechaAlta), 'dd/MM/yyyy')}.`}
          </p>
        )}
        {celda.fijosActuales.length >= celda.cupo && (
          <p className="text-xs text-amber-700">El horario ya tiene {celda.fijosActuales.length} de {celda.cupo} lugares ocupados por fijos.</p>
        )}
      </section>

      <ConfirmDialog
        abierto={aDesinscribir !== null}
        titulo={`¿Desinscribir a ${aDesinscribir?.pacientes?.nombre ?? 'este alumno'}?`}
        mensaje={<p>Deja de ser alumno fijo de los {diaLabel} a las {celda.hora}. Sus asistencias ya registradas no se borran.</p>}
        textoConfirmar="Desinscribir"
        cargando={desinscribiendo}
        onConfirmar={handleDesinscribir}
        onCancelar={() => setADesinscribir(null)}
      />
    </div>
  );
}
