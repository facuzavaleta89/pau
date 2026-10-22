"use client";

import { AlertTriangle, Info, Plus } from "lucide-react";
import type { SugerenciaAviso } from "@/lib/avisos";
import type { AlumnoCeldaTPA, EstadoAsistenciaTPA, LugaresTPA } from "@/types";
import { TpaAsistenciaFila } from "./TpaAsistenciaFila";

interface TpaAsistenciaListaProps {
  alumnos: AlumnoCeldaTPA[];
  estadoActual: (alumno: AlumnoCeldaTPA) => EstadoAsistenciaTPA;
  onCambiar: (pacienteId: string, estado: EstadoAsistenciaTPA) => void;
  onIrAInscripcion: () => void;
  /** Con las marcas sin guardar. */
  lugares: LugaresTPA;
  cupo: number;
  claseFutura: boolean;
  sugerencia: SugerenciaAviso | null;
}

// Registro rápido: un alumno por fila, estados como chips de un toque.
export function TpaAsistenciaLista({
  alumnos, estadoActual, onCambiar, onIrAInscripcion, lugares, cupo, claseFutura, sugerencia,
}: TpaAsistenciaListaProps) {
  if (alumnos.length === 0) {
    return (
      <div className="m-4 md:m-6 text-center py-10 px-4 text-sm text-stone-500 bg-stone-50 rounded-xl border border-dashed border-stone-200">
        No hay alumnos en este horario.
        <button
          type="button"
          onClick={onIrAInscripcion}
          className="mt-3 mx-auto h-11 px-4 flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50 rounded-lg"
        >
          <Plus size={16} /> Inscribir un alumno fijo
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-3">
      {claseFutura && (
        <p className="flex items-start gap-2 text-sm text-stone-700 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
          <Info size={16} className="shrink-0 mt-0.5 text-teal-600" />
          <span>
            La clase todavía no empezó: solo se cargan avisos.
            {sugerencia && <> <strong className="font-semibold">{sugerencia.motivo}</strong>.</>}
          </span>
        </p>
      )}
      {lugares.excedidos > 0 && (
        <p role="status" className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
          {lugares.ocupados}/{cupo}: hay más personas que lugares. Se puede guardar igual.
        </p>
      )}
      <ul className="space-y-3">
        {alumnos.map((alumno) => (
          <TpaAsistenciaFila
            key={alumno.pacienteId}
            alumno={alumno}
            actual={estadoActual(alumno)}
            claseFutura={claseFutura}
            sugerencia={sugerencia}
            onCambiar={(estado) => onCambiar(alumno.pacienteId, estado)}
          />
        ))}
      </ul>
    </div>
  );
}
