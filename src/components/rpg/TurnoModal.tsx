"use client";

import { X } from 'lucide-react';
import type { SesionRPG } from '@/types';

interface TurnoModalProps {
  isOpen: boolean;
  onClose: () => void;
  turno?: SesionRPG | null;
  selectedDate?: Date;
}

export function TurnoModal({ isOpen, onClose, turno, selectedDate }: TurnoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">
            {turno ? 'Editar Turno' : 'Nuevo Turno'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4">
          <p className="text-gray-500 text-center py-8">
            Formulario de turno (A implementar)
          </p>
        </div>
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">
            Cancelar
          </button>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
