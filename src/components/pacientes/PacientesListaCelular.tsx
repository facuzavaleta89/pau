"use client";

import { ChevronRight, Edit2, Phone } from 'lucide-react';
import type { Paciente } from '@/types';

interface PacientesListaCelularProps {
  pacientes: Paciente[];
  onAbrirHistoria: (pacienteId: string) => void;
  onEditar: (paciente: Paciente) => void;
}

// Listado de pacientes para el celular: una card por paciente.
// Tocar la card abre la historia clínica; el lápiz, la ficha para editar.
export function PacientesListaCelular({ pacientes, onAbrirHistoria, onEditar }: PacientesListaCelularProps) {
  return (
    <ul className="flex flex-col gap-2">
      {pacientes.map((p) => (
        <li key={p.id} className="flex items-stretch bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => onAbrirHistoria(p.id)}
            className="flex-1 min-w-0 flex items-center gap-3 p-3 text-left active:bg-stone-50"
          >
            <span className="shrink-0 w-10 h-10 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 font-semibold uppercase">
              {p.nombre.charAt(0)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-stone-900 truncate">{p.nombre}</span>
              <span className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                {p.tipo_clase && <span className="font-semibold text-teal-700 uppercase">{p.tipo_clase}</span>}
                {p.telefono && (
                  <span className="flex items-center gap-1 truncate"><Phone size={12} />{p.telefono}</span>
                )}
              </span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-stone-300" />
          </button>
          <button
            type="button"
            onClick={() => onEditar(p)}
            aria-label={`Editar ficha de ${p.nombre}`}
            className="shrink-0 w-12 flex items-center justify-center border-l border-stone-100 text-stone-400 hover:text-stone-900 active:bg-stone-50"
          >
            <Edit2 size={16} />
          </button>
        </li>
      ))}
    </ul>
  );
}
