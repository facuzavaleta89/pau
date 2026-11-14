"use client";

import { FileText, Phone } from 'lucide-react';
import type { Paciente } from '@/types';
import { EstadoPacienteCard } from './EstadoPacienteCard';

interface HistoriaFichaProps {
  paciente: Paciente;
  /** Se dio de baja o se reactivó. */
  onCambio: () => void;
}

// Pestaña "Ficha" de la historia clínica: contacto y datos clínicos (solo
// lectura) y, al pie, "Dar de baja" / "Reactivar".
export function HistoriaFicha({ paciente, onCambio }: HistoriaFichaProps) {
  return (
    <div className="space-y-6">
      {/* Datos Básicos */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4 shadow-sm">
        <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider flex items-center gap-2 border-b border-stone-100 pb-2">
          <Phone className="w-4 h-4 text-teal-600" /> Datos de Contacto
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-xs text-stone-500 font-semibold uppercase tracking-wider block">Teléfono Principal</span>
            <span className="text-stone-700 font-semibold">{paciente.telefono || 'No registrado'}</span>
          </div>
          <div>
            <span className="text-xs text-stone-500 font-semibold uppercase tracking-wider block">Contacto de Emergencia</span>
            <span className="text-stone-700 font-semibold">{paciente.telefono_emergencia || 'No registrado'}</span>
          </div>
          <div>
            <span className="text-xs text-stone-500 font-semibold uppercase tracking-wider block">Dirección</span>
            <span className="text-stone-700 font-semibold">{paciente.direccion || 'No registrada'}</span>
          </div>
          <div>
            <span className="text-xs text-stone-500 font-semibold uppercase tracking-wider block">Profesión</span>
            <span className="text-stone-700 font-semibold">{paciente.profesion || 'No registrada'}</span>
          </div>
        </div>
      </div>

      {/* Datos Clínicos */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4 shadow-sm">
        <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider flex items-center gap-2 border-b border-stone-100 pb-2">
          <FileText className="w-4 h-4 text-teal-600" /> Antecedentes y Evaluación
        </h3>
        <div className="space-y-4 text-sm">
          <div>
            <span className="text-xs text-stone-500 font-semibold uppercase tracking-wider block">Motivo de Consulta</span>
            <p className="text-stone-600 mt-1 leading-relaxed bg-stone-50 p-3 rounded-lg border border-stone-200">{paciente.motivo_consulta || 'Sin registrar'}</p>
          </div>
          <div>
            <span className="text-xs text-stone-500 font-semibold uppercase tracking-wider block">Antecedentes Clínicos</span>
            <p className="text-stone-600 mt-1 leading-relaxed bg-stone-50 p-3 rounded-lg border border-stone-200">{paciente.antecedentes_clinicos || 'Sin antecedentes registrados'}</p>
          </div>
          <div>
            <span className="text-xs text-stone-500 font-semibold uppercase tracking-wider block">Estudios Imagenológicos (Rayos X, RM, etc.)</span>
            <p className="text-stone-600 mt-1 leading-relaxed bg-stone-50 p-3 rounded-lg border border-stone-200">{paciente.estudios_imagenologicos || 'Sin estudios cargados'}</p>
          </div>
          <div>
            <span className="text-xs text-stone-500 font-semibold uppercase tracking-wider block">Evaluación Inicial</span>
            <p className="text-stone-600 mt-1 leading-relaxed bg-stone-50 p-3 rounded-lg border border-stone-200 whitespace-pre-line">{paciente.evaluacion_inicial || 'Sin registrar'}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-stone-500 font-semibold uppercase tracking-wider block">Actividad Física</span>
              <p className="text-stone-600 mt-1 leading-relaxed bg-stone-50 p-3 rounded-lg border border-stone-200">{paciente.actividad_fisica || 'No realiza / no registrada'}</p>
            </div>
            <div>
              <span className="text-xs text-stone-500 font-semibold uppercase tracking-wider block">Objetivo del Tratamiento</span>
              <p className="text-stone-600 mt-1 leading-relaxed bg-stone-50 p-3 rounded-lg border border-stone-200">{paciente.objetivo_tratamiento || 'Sin definir'}</p>
            </div>
          </div>
        </div>
      </div>

      <EstadoPacienteCard paciente={paciente} onCambio={onCambio} />
    </div>
  );
}
