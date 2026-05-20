"use client";

import { X } from 'lucide-react';

interface HistoriaClinicaModalProps {
  isOpen: boolean;
  onClose: () => void;
  pacienteId?: string | null;
}

export function HistoriaClinicaModal({ isOpen, onClose, pacienteId }: HistoriaClinicaModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white w-full h-[90vh] sm:h-[85vh] sm:max-w-4xl sm:rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300 flex flex-col rounded-t-2xl">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">
            Historia Clínica
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-gray-500 text-center py-8">
            Cargando datos del paciente {pacienteId}... (A implementar)
          </p>
        </div>
      </div>
    </div>
  );
}
