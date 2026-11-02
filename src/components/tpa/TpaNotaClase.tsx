"use client";

import { useState } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
import { ICONO_NOTA } from "@/lib/estados";
import { cn } from "@/lib/utils";

interface TpaNotaClaseProps {
  nombre: string;
  /** Texto como está en el modal (con lo escrito sin guardar). */
  texto: string;
  sinGuardar: boolean;
  /** Clase cancelada: la nota se ve, no se edita. */
  bloqueada: boolean;
  onCambiar: (texto: string) => void;
}

const BOTON = "min-h-11 md:min-h-9 px-3 flex items-center gap-1.5 rounded-lg text-sm font-medium transition-colors duration-150";

// Nota de evolución de un alumno en esta clase (diseño 7.2): "+ Nota" abre un
// campo de texto; se guarda con el resto de la clase al tocar Guardar.
export function TpaNotaClase({ nombre, texto, sinGuardar, bloqueada, onCambiar }: TpaNotaClaseProps) {
  const [editando, setEditando] = useState(false);
  const IconoNota = ICONO_NOTA;
  const tieneTexto = texto.trim() !== '';

  if (editando && !bloqueada) {
    return (
      <div className="space-y-2">
        <label className="block">
          <span className="sr-only">Nota de evolución de {nombre}</span>
          <textarea
            value={texto}
            onChange={(e) => onCambiar(e.target.value)}
            autoFocus
            rows={3}
            maxLength={5000}
            placeholder="Cómo estuvo en la clase: presión, dolor, avances…"
            className="w-full bg-white border border-stone-200 text-stone-900 text-base md:text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setEditando(false)} className={cn(BOTON, "text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200")}>
            <Check size={16} /> Listo
          </button>
          {tieneTexto && (
            <button type="button" onClick={() => { onCambiar(''); setEditando(false); }} className={cn(BOTON, "text-red-600 hover:bg-red-50")}>
              <X size={16} /> Quitar nota
            </button>
          )}
          <span className="text-xs text-stone-500">Se guarda al tocar Guardar.</span>
        </div>
      </div>
    );
  }

  if (!tieneTexto) {
    if (bloqueada) return sinGuardar ? <p className="text-xs text-stone-500">Nota quitada (sin guardar).</p> : null;
    return (
      <button type="button" onClick={() => setEditando(true)} className={cn(BOTON, "text-stone-600 hover:text-teal-700 hover:bg-teal-50")}>
        <Plus size={16} /> Nota
        {sinGuardar && <span className="text-xs font-normal text-stone-500">(se quita al guardar)</span>}
      </button>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-lg bg-white border border-stone-200 px-3 py-2">
      <IconoNota size={16} className="shrink-0 mt-0.5 text-teal-600" aria-label="Nota de evolución" />
      <p className="flex-1 min-w-0 text-sm text-stone-700 whitespace-pre-line break-words">{texto}</p>
      {!bloqueada && (
        <button
          type="button"
          onClick={() => setEditando(true)}
          aria-label={`Editar la nota de ${nombre}`}
          className="shrink-0 -my-1 -mr-1 h-11 w-11 md:h-9 md:w-9 flex items-center justify-center rounded-lg text-stone-400 hover:text-teal-700 hover:bg-teal-50"
        >
          <Pencil size={16} />
        </button>
      )}
    </div>
  );
}
