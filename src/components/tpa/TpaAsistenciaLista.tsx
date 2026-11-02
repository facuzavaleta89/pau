"use client";

import { AlertTriangle, CheckCheck, Info, Plus, RotateCcw } from "lucide-react";
import type { SugerenciaAviso } from "@/lib/avisos";
import { CLASES_CANCELADA, ICONO_CANCELADA, LUGAR_LIBRE, MOTIVOS_CANCELACION } from "@/lib/estados";
import { ocupanteDe, type EnlacesCambio, type FilaClase, type TipoOcupante } from "@/lib/clase-tpa";
import type { AlertaFaltas } from "@/lib/alertas";
import type { EstadoAsistenciaTPA, LugaresTPA, MotivoCancelacionTPA } from "@/types";
import { cn } from "@/lib/utils";
import { TpaAsistenciaFila, type PreguntaFila } from "./TpaAsistenciaFila";
import { TpaNotaClase } from "./TpaNotaClase";

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
  alertaDe: (pacienteId: string) => AlertaFaltas | null;
  /** Notas de evolución: texto como está en el modal y si cambió. */
  notaDe: (pacienteId: string) => string;
  notaSinGuardar: (pacienteId: string) => boolean;
  /** Notas de esta clase de quienes ya no están en ella. */
  notasSinFila: { pacienteId: string; nombre: string }[];
  onCambiarNota: (pacienteId: string, texto: string) => void;
  /** Cuántos siguen en "Sin marcar" (para "Marcar el resto como presente"). */
  restoSinMarcar: number;
  onMarcarResto: () => void;
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

      {/* Al terminar la clase: todos Presente y después se corrigen las excepciones. No toca avisos ni "No avisó". */}
      {!p.claseFutura && !bloqueada && p.restoSinMarcar > 0 && (
        <button
          type="button"
          onClick={p.onMarcarResto}
          className="w-full md:w-auto min-h-11 px-4 flex items-center justify-center gap-2 text-sm font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors duration-150"
        >
          <CheckCheck size={16} />
          Marcar el resto como presente ({p.restoSinMarcar})
        </button>
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
            alerta={p.alertaDe(fila.pacienteId)}
            nota={p.notaDe(fila.pacienteId)}
            notaSinGuardar={p.notaSinGuardar(fila.pacienteId)}
            onCambiarNota={(texto) => p.onCambiarNota(fila.pacienteId, texto)}
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

      {p.notasSinFila.length > 0 && (
        <section className="space-y-2 pt-2">
          <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Notas de quienes ya no están en esta clase</h3>
          <ul className="space-y-2">
            {p.notasSinFila.map((n) => (
              <li key={n.pacienteId} className="p-3 rounded-xl border border-stone-200 bg-stone-50/50 space-y-2">
                <p className="font-semibold text-stone-900 truncate">{n.nombre}</p>
                <TpaNotaClase
                  nombre={n.nombre}
                  texto={p.notaDe(n.pacienteId)}
                  sinGuardar={p.notaSinGuardar(n.pacienteId)}
                  bloqueada={bloqueada}
                  onCambiar={(texto) => p.onCambiarNota(n.pacienteId, texto)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
