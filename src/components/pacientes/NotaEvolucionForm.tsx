"use client";

import { useState } from 'react';
import { Save } from 'lucide-react';

interface NotaEvolucionFormProps {
  textoInicial: string;
  /** Solo las notas libres eligen la fecha; la de una nota de clase es la de su clase. */
  fechaInicial: string | null;
  guardando: boolean;
  onGuardar: (texto: string, fecha: string | null) => void;
  onCancelar: () => void;
}

const BOTON = 'h-11 md:h-9 px-4 flex items-center justify-center gap-2 text-sm font-medium rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none';

// Nueva nota libre o edición de una nota (de clase o libre), en la pestaña Evolución.
export function NotaEvolucionForm({ textoInicial, fechaInicial, guardando, onGuardar, onCancelar }: NotaEvolucionFormProps) {
  const [texto, setTexto] = useState(textoInicial);
  const [fecha, setFecha] = useState(fechaInicial);
  const vacia = texto.trim() === '';
  const sinCambios = texto.trim() === textoInicial.trim() && fecha === fechaInicial;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!vacia && !sinCambios) onGuardar(texto.trim(), fecha);
      }}
    >
      {fecha !== null && (
        <label className="block max-w-48">
          <span className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Fecha</span>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
            className="w-full h-11 md:h-9 bg-white border border-stone-200 text-stone-900 text-base md:text-sm px-3 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
        </label>
      )}
      <label className="block">
        <span className="sr-only">Nota de evolución</span>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoFocus
          rows={4}
          maxLength={5000}
          placeholder="Evolución: presión, dolor, avances, lo que quieras recordar…"
          className="w-full bg-white border border-stone-200 text-stone-900 text-base md:text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />
      </label>
      <div className="flex flex-col-reverse md:flex-row md:justify-end gap-2">
        <button type="button" onClick={onCancelar} className={`${BOTON} text-stone-700 bg-white hover:bg-stone-50 border border-stone-200`}>
          Cancelar
        </button>
        <button type="submit" disabled={guardando || vacia || sinCambios || fecha === ''} className={`${BOTON} text-white bg-teal-600 hover:bg-teal-700`}>
          {guardando ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
          Guardar nota
        </button>
      </div>
    </form>
  );
}
