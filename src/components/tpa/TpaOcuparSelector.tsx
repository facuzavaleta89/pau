"use client";

import { useCallback, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { AlertTriangle, ArrowLeft, Search } from "lucide-react";
import { cargarSemanaTPA } from "@/lib/queries";
import { celdasEntre } from "@/lib/tpa";
import {
  filtrarOpciones, opcionesParaOcupar, ORDEN_GRUPOS, TITULOS_GRUPOS, type OpcionOcupar,
} from "@/lib/ocupar";
import type { EstadoAviso } from "@/lib/avisos";
import { ESTADOS_ASISTENCIA } from "@/lib/estados";
import type { AsistenciaConClase, CeldaTPA, HorarioTPA, Paciente, SaldoRecuperaciones } from "@/types";
import { cn } from "@/lib/utils";
import { useDatos } from "@/hooks/useDatos";
import { EstadoCarga } from "@/components/ui/EstadoCarga";

interface TpaOcuparSelectorProps {
  celda: CeldaTPA;
  /** Quienes ya están en la clase (con las marcas sin guardar). */
  enLaClase: Set<string>;
  /** Nombre del fijo cuyo lugar se ocupa (null = lugar libre). */
  lugarDe: string | null;
  saldos: SaldoRecuperaciones[];
  pacientes: Paciente[];
  horarios: HorarioTPA[];
  historial: AsistenciaConClase[];
  ahora: Date;
  /** La clase ya está completa: el que se agregue queda de más (no se bloquea). */
  completa: boolean;
  /** Para un cambio de horario: el aviso que queda en el origen (null = ya había avisado). */
  onElegir: (opcion: OpcionOcupar, avisoOrigen: EstadoAviso | null) => void;
  onVolver: () => void;
}

// Selector "Ocupar lugar" (diseño 7.3): en el orden de prioridad de Pau, cada
// persona con su motivo y su saldo. Los avisos (tope, otro mes, 5/4) no bloquean.
export function TpaOcuparSelector({
  celda, enLaClase, lugarDe, saldos, pacientes, horarios, historial, ahora, completa, onElegir, onVolver,
}: TpaOcuparSelectorProps) {
  const [busqueda, setBusqueda] = useState('');
  const desde = format(addDays(parseISO(celda.fecha), -6), 'yyyy-MM-dd');
  const hasta = format(addDays(parseISO(celda.fecha), 6), 'yyyy-MM-dd');
  // Clases de alrededor, para ofrecer un cambio de horario.
  const cargar = useCallback(() => cargarSemanaTPA(desde, hasta), [desde, hasta]);
  const { datos, cargando, error, recargar } = useDatos(`ventana_${celda.clave}`, cargar, 'No se pudieron cargar las clases de alrededor.');

  const opciones = useMemo(() => {
    if (!datos) return null;
    return opcionesParaOcupar({
      celda, enLaClase, saldos, pacientes, horarios, historial, ahora,
      ventana: celdasEntre(desde, hasta, datos),
    });
  }, [datos, celda, enLaClase, saldos, pacientes, horarios, historial, ahora, desde, hasta]);

  const visibles = opciones ? filtrarOpciones(opciones, busqueda) : [];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onVolver}
          className="h-11 px-3 -ml-3 flex items-center gap-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100 rounded-lg"
        >
          <ArrowLeft size={16} /> Volver a la clase
        </button>
        <span className="text-sm text-stone-500 truncate">{lugarDe ? `Lugar de ${lugarDe}` : 'Lugar libre'}</span>
      </div>

      {completa && (
        <p className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
          La clase ya está completa: quien agregues va a quedar de más. Se puede igual.
        </p>
      )}

      <label className="relative block">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden="true" />
        <span className="sr-only">Buscar por nombre</span>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre…"
          className="w-full h-11 pl-9 pr-3 bg-white border border-stone-200 text-stone-900 text-base md:text-sm rounded-lg placeholder:text-stone-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />
      </label>

      {!opciones ? (
        <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} />
      ) : visibles.length === 0 ? (
        <p className="text-sm text-stone-500 text-center py-6">Nadie con ese nombre.</p>
      ) : (
        ORDEN_GRUPOS.map((grupo) => {
          const delGrupo = visibles.filter((o) => o.grupo === grupo);
          if (delGrupo.length === 0) return null;
          return (
            <section key={grupo} className="space-y-2">
              <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">{TITULOS_GRUPOS[grupo]}</h3>
              <ul className="divide-y divide-stone-100 border border-stone-200 rounded-xl bg-white">
                {delGrupo.map((o) => <FilaOpcion key={o.clave} opcion={o} onElegir={onElegir} />)}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

function FilaOpcion({ opcion, onElegir }: { opcion: OpcionOcupar; onElegir: TpaOcuparSelectorProps['onElegir'] }) {
  const boton = "min-h-11 px-3 rounded-lg text-sm font-medium border transition-colors duration-150";
  const elegirAviso = opcion.cambioDe && !opcion.cambioDe.yaAviso;
  return (
    <li className="p-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-stone-900 truncate">{opcion.nombre}</p>
        <p className="text-sm text-stone-600">
          {opcion.motivo}{opcion.saldo && <span className="text-stone-500"> · {opcion.saldo}</span>}
        </p>
        {opcion.avisos.map((a) => (
          <p key={a} className="flex items-center gap-1 text-xs text-amber-700 mt-0.5">
            <AlertTriangle size={12} className="shrink-0" /> {a}
          </p>
        ))}
      </div>
      {elegirAviso ? (
        // Cambio de horario de alguien que todavía no avisó: se elige cómo queda en su horario.
        <div className="flex gap-2 shrink-0" role="group" aria-label={`Aviso de ${opcion.nombre} en su horario`}>
          {(['aviso_con_tiempo', 'aviso_sin_tiempo'] as const).map((estado) => (
            <button
              key={estado}
              type="button"
              onClick={() => onElegir(opcion, estado)}
              className={cn(boton, "bg-white text-stone-700 border-stone-200 hover:bg-stone-50",
                opcion.cambioDe?.sugerencia === estado && "border-amber-300")}
            >
              {ESTADOS_ASISTENCIA[estado].label}
              {opcion.cambioDe?.sugerencia === estado && <span className="ml-1 text-xs font-normal">(sugerido)</span>}
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onElegir(opcion, null)}
          className={cn(boton, "shrink-0 bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100")}
        >
          Elegir
        </button>
      )}
    </li>
  );
}
