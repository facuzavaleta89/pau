"use client";

import { AlertTriangle, Info, Plus, RotateCcw } from "lucide-react";
import type { SugerenciaAviso } from "@/lib/avisos";
import { CLASES_CANCELADA, ICONO_CANCELADA, LUGAR_LIBRE, MOTIVOS_CANCELACION } from "@/lib/estados";
import { ocupanteDe, type EnlacesCambio, type FilaClase, type TipoOcupante } from "@/lib/clase-tpa";
import type { EstadoAsistenciaTPA, LugaresTPA, MotivoCancelacionTPA } from "@/types";
import { cn } from "@/lib/utils";
import { TpaAsistenciaFila, type PreguntaFila } from "./TpaAsistenciaFila";

interface TpaAsistenciaListaProps {
  filas: FilaClase[];
  /** Con las marcas sin guardar. */
  lugares: LugaresTPA;
  cupo: number;
  claseFutura: boolean;
  sugerencia: SugerenciaAviso | null;
  motivoCancelacion: MotivoCancelacionTPA | null;
  enlaces: EnlacesCambio;
  preguntas: Record<string, PreguntaFila>;
  onCambiar: (pacienteId: string, estado: EstadoAsistenciaTPA) => void;
  /** Abrir el selector para el lugar de ese fijo (null = un lugar libre). */
  onOcupar: (lugarDe: string | null) => void;
  onQuitar: (pacienteId: string) => void;
  onCambiarTipo: (pacienteId: string, tipo: TipoOcupante) => void;
  onResolver: (pacienteId: string, decision: 'sacar' | 'libre' | 'quitar_cambio' | 'cancelar') => void;
  onIrAInscripcion: () => void;
  onReactivar: () => void;
}

// Registro de la clase: una fila por lugar (fijos, quien ocupa su lugar debajo,
// y los lugares libres con "+ Ocupar").
export function TpaAsistenciaLista(p: TpaAsistenciaListaProps) {
  const { filas, lugares, cupo, motivoCancelacion } = p;
  const IconoLibre = LUGAR_LIBRE.icono;
  const IconoCancelada = ICONO_CANCELADA;
  const bloqueada = motivoCancelacion !== null;

  return (
    <div className="p-4 md:p-6 space-y-3">
      {motivoCancelacion && (
        <div className={cn("flex flex-col md:flex-row md:items-center gap-2 rounded-lg border px-3 py-2", CLASES_CANCELADA)}>
          <p className="flex-1 flex items-start gap-2 text-sm">
            <IconoCancelada size={16} className="shrink-0 mt-0.5" />
            <span>
              <strong className="font-semibold">{MOTIVOS_CANCELACION[motivoCancelacion]}.</strong>{' '}
              No se marca asistencia ni se ocupan lugares. Lo que estaba cargado se conserva y vuelve si la reactivás.
            </span>
          </p>
          <button
            type="button"
            onClick={p.onReactivar}
            className="shrink-0 min-h-11 md:min-h-9 px-3 flex items-center justify-center gap-1.5 text-sm font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-lg"
          >
            <RotateCcw size={16} /> Reactivar clase
          </button>
        </div>
      )}
      {p.claseFutura && !bloqueada && (
        <p className="flex items-start gap-2 text-sm text-stone-700 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
          <Info size={16} className="shrink-0 mt-0.5 text-teal-600" />
          <span>
            La clase todavía no empezó: solo se cargan avisos.
            {p.sugerencia && <> <strong className="font-semibold">{p.sugerencia.motivo}</strong>.</>}
          </span>
        </p>
      )}
      {lugares.excedidos > 0 && (
        <p role="status" className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
          {lugares.ocupados}/{cupo}: hay más personas que lugares. Se puede guardar igual.
        </p>
      )}

      {filas.length === 0 && (
        <div className="text-center py-6 px-4 text-sm text-stone-500 bg-stone-50 rounded-xl border border-dashed border-stone-200">
          No hay alumnos fijos en este horario.
          <button
            type="button"
            onClick={p.onIrAInscripcion}
            className="mt-2 mx-auto h-11 px-4 flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50 rounded-lg"
          >
            <Plus size={16} /> Inscribir un alumno fijo
          </button>
        </div>
      )}

      <ul className="space-y-3">
        {filas.map((fila) => (
          <TpaAsistenciaFila
            key={fila.pacienteId}
            fila={fila}
            claseFutura={p.claseFutura}
            bloqueada={bloqueada}
            sugerencia={p.sugerencia}
            ocupadoPor={fila.tipo === 'fijo' ? ocupanteDe(filas, fila.pacienteId)?.nombre ?? null : null}
            origenCambio={p.enlaces.origenDe.get(fila.pacienteId) ?? null}
            destinoCambio={p.enlaces.destinoDe.get(fila.pacienteId) ?? null}
            pregunta={p.preguntas[fila.pacienteId] ?? null}
            onCambiar={(estado) => p.onCambiar(fila.pacienteId, estado)}
            onOcuparSuLugar={() => p.onOcupar(fila.pacienteId)}
            onQuitar={() => p.onQuitar(fila.pacienteId)}
            onCambiarTipo={(tipo) => p.onCambiarTipo(fila.pacienteId, tipo)}
            onResolver={(decision) => p.onResolver(fila.pacienteId, decision)}
          />
        ))}
        {!bloqueada && Array.from({ length: lugares.libres }, (_, i) => (
          <li key={`libre-${i}`}>
            <button
              type="button"
              onClick={() => p.onOcupar(null)}
              className={cn(
                "w-full min-h-11 px-3 flex items-center gap-2 rounded-xl border text-sm font-medium hover:bg-teal-100 transition-colors duration-150",
                LUGAR_LIBRE.clases
              )}
            >
              <IconoLibre size={16} className="shrink-0" aria-hidden="true" />
              <span className="flex-1 text-left">{LUGAR_LIBRE.label}</span>
              <span className="flex items-center gap-1"><Plus size={16} /> Ocupar</span>
            </button>
          </li>
        ))}
        {/* Clase completa: se puede sumar a alguien igual (queda de más, se avisa y no se bloquea). */}
        {!bloqueada && lugares.libres === 0 && (
          <li>
            <button
              type="button"
              onClick={() => p.onOcupar(null)}
              className="w-full min-h-11 px-3 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-stone-300 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors duration-150"
            >
              <Plus size={16} /> Agregar a alguien más (queda de más)
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}
