"use client";

import { ArrowLeftRight, CornerDownRight, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ESTADOS_ASISTENCIA, ORDEN_ESTADOS_FIJO, ORDEN_ESTADOS_OCUPANTE, TIPOS_OCUPANTE,
  esEstadoAsistenciaConocido, estadoAsistencia, etiquetaAsistencia,
} from "@/lib/estados";
import { esAviso, type SugerenciaAviso } from "@/lib/avisos";
import { claseCorta } from "@/lib/ocupar";
import type { ClaseHora, FilaClase, TipoOcupante } from "@/lib/clase-tpa";
import type { EstadoAsistenciaTPA } from "@/types";

/** Algo que hay que resolver antes de cambiarle el estado a un fijo (el trigger no lo deja directo). */
export type PreguntaFila =
  | { tipo: 'lugar_ocupado'; estado: EstadoAsistenciaTPA; ocupante: string }
  | { tipo: 'origen_de_cambio'; estado: EstadoAsistenciaTPA; destino: ClaseHora };

interface TpaAsistenciaFilaProps {
  fila: FilaClase;
  /** La clase todavía no empezó: solo se cargan avisos. */
  claseFutura: boolean;
  /** Clase cancelada: no se marca nada. */
  bloqueada: boolean;
  sugerencia: SugerenciaAviso | null;
  /** Nombre de quien ocupa su lugar (solo fijos). */
  ocupadoPor: string | null;
  /** Cambio de horario: de dónde viene (quien ocupa) o adónde fue (fijo). */
  origenCambio: ClaseHora | null;
  destinoCambio: ClaseHora | null;
  pregunta: PreguntaFila | null;
  onCambiar: (estado: EstadoAsistenciaTPA) => void;
  onOcuparSuLugar: () => void;
  onQuitar: () => void;
  onCambiarTipo: (tipo: TipoOcupante) => void;
  onResolver: (decision: 'sacar' | 'libre' | 'quitar_cambio' | 'cancelar') => void;
}

// En una clase futura no se sabe si vino: Presente y No avisó se habilitan al empezar la clase.
const SOLO_CON_LA_CLASE_EMPEZADA: EstadoAsistenciaTPA[] = ['presente', 'falto_sin_avisar'];
const BOTON_CHICO = "min-h-11 md:min-h-9 px-3 flex items-center gap-1.5 rounded-lg text-sm font-medium transition-colors duration-150";

// Una persona en el registro de la clase: nombre, qué es y sus estados como chips de un toque.
export function TpaAsistenciaFila(p: TpaAsistenciaFilaProps) {
  const { fila, claseFutura, bloqueada, sugerencia, pregunta } = p;
  const esFijo = fila.tipo === 'fijo';
  const ocupante = fila.tipo === 'fijo' ? null : TIPOS_OCUPANTE[fila.tipo];
  const opciones = esFijo ? ORDEN_ESTADOS_FIJO : ORDEN_ESTADOS_OCUPANTE;

  return (
    <li className={cn("p-3 rounded-xl border border-stone-200 bg-stone-50/50 space-y-2.5", fila.ocupaLugarDe && "ml-4 md:ml-8")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-semibold text-stone-900">
            {fila.ocupaLugarDe && <CornerDownRight size={16} className="shrink-0 text-stone-400" aria-label="En el lugar del fijo de arriba" />}
            <span className="truncate">{fila.nombre}</span>
          </p>
          {p.origenCambio && (
            <p className="flex items-center gap-1 text-xs text-stone-500"><ArrowLeftRight size={12} /> Falta el {claseCorta(p.origenCambio.fecha, p.origenCambio.hora)}</p>
          )}
          {p.destinoCambio && (
            <p className="flex items-center gap-1 text-xs text-stone-500"><ArrowLeftRight size={12} /> Viene el {claseCorta(p.destinoCambio.fecha, p.destinoCambio.hora)} (cambio de horario)</p>
          )}
        </div>
        <span className="shrink-0 flex items-center gap-2 text-xs text-stone-500">
          {ocupante && fila.guardado === null && fila.tipo !== 'cambio' ? (
            // Recién agregado: el tipo se completó solo y se puede cambiar.
            <select
              value={fila.tipo}
              onChange={(e) => p.onCambiarTipo(e.target.value as TipoOcupante)}
              aria-label={`Qué es ${fila.nombre} en esta clase`}
              className="h-9 bg-white border border-stone-200 text-stone-900 text-base md:text-sm px-2 rounded-lg focus:outline-none focus:border-teal-500"
            >
              <option value="recupera">{TIPOS_OCUPANTE.recupera.label}</option>
              <option value="suelta">{TIPOS_OCUPANTE.suelta.label}</option>
            </select>
          ) : ocupante ? ocupante.label : null}
          {esFijo && !fila.esFijo && 'No es fijo'}
          {/* Estado de una versión más nueva de la app: se muestra, aunque no tenga chip. */}
          {!esEstadoAsistenciaConocido(fila.estado) && estadoAsistencia(fila.estado).label}
          {fila.sinGuardar && <span className="font-medium text-stone-600">Sin guardar</span>}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {opciones.map((valor) => {
          const estado = ESTADOS_ASISTENCIA[valor];
          const seleccionado = fila.estado === valor;
          const deshabilitado = bloqueada || (claseFutura && SOLO_CON_LA_CLASE_EMPEZADA.includes(valor));
          const sugerido = esFijo && !bloqueada && sugerencia?.estado === valor;
          return (
            <button
              key={valor}
              type="button"
              onClick={() => p.onCambiar(valor)}
              disabled={deshabilitado}
              aria-pressed={seleccionado}
              title={claseFutura && deshabilitado && !bloqueada ? 'La clase todavía no empezó: solo se cargan avisos.' : undefined}
              className={cn(
                "min-h-11 px-3 rounded-lg text-sm font-medium border transition-colors duration-150",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                seleccionado
                  ? cn(estado.clases, "ring-2 ring-teal-500/30 font-semibold")
                  : "bg-white text-stone-600 border-stone-200 enabled:hover:bg-stone-50 enabled:hover:text-stone-900",
                sugerido && !seleccionado && "border-amber-300"
              )}
            >
              {etiquetaAsistencia(valor, fila.tipo)}
              {sugerido && <span className="ml-1 text-xs font-normal">(sugerido)</span>}
            </button>
          );
        })}
        {!esFijo && !bloqueada && (
          <button type="button" onClick={p.onQuitar} className={cn(BOTON_CHICO, "md:ml-auto text-red-600 hover:bg-red-50")}>
            <X size={16} /> Quitar de esta clase
          </button>
        )}
      </div>

      {esFijo && esAviso(fila.estado) && !p.ocupadoPor && !bloqueada && !pregunta && (
        <button type="button" onClick={p.onOcuparSuLugar} className={cn(BOTON_CHICO, "text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200")}>
          <UserPlus size={16} /> Ocupar su lugar
        </button>
      )}

      {pregunta && <PreguntaFijo pregunta={pregunta} onResolver={p.onResolver} />}
    </li>
  );
}

function PreguntaFijo({ pregunta, onResolver }: { pregunta: PreguntaFila; onResolver: TpaAsistenciaFilaProps['onResolver'] }) {
  const boton = "min-h-11 px-3 rounded-lg text-sm font-medium border transition-colors duration-150";
  return (
    <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
      <p className="text-sm text-amber-800">
        {pregunta.tipo === 'lugar_ocupado'
          ? <><strong className="font-semibold">{pregunta.ocupante}</strong> ocupa su lugar. ¿Qué hacemos con {pregunta.ocupante}?</>
          : <>Tiene un cambio de horario: viene el {claseCorta(pregunta.destino.fecha, pregunta.destino.hora)}. Para marcarlo así hay que quitar ese cambio.</>}
      </p>
      <div className="flex flex-wrap gap-2">
        {pregunta.tipo === 'lugar_ocupado' ? (
          <>
            <button type="button" onClick={() => onResolver('sacar')} className={cn(boton, "bg-white text-red-600 border-red-200 hover:bg-red-50")}>
              Sacarlo de la clase
            </button>
            <button type="button" onClick={() => onResolver('libre')} className={cn(boton, "bg-white text-stone-700 border-stone-200 hover:bg-stone-50")}>
              Dejarlo en un lugar libre
            </button>
          </>
        ) : (
          <button type="button" onClick={() => onResolver('quitar_cambio')} className={cn(boton, "bg-white text-red-600 border-red-200 hover:bg-red-50")}>
            Quitar el cambio
          </button>
        )}
        <button type="button" onClick={() => onResolver('cancelar')} className={cn(boton, "bg-white text-stone-700 border-stone-200 hover:bg-stone-50")}>
          No cambiar
        </button>
      </div>
    </div>
  );
}
