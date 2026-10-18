"use client";

import { Edit2, FileText, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Paciente } from '@/types';

interface PacientesTablaProps {
  pacientes: Paciente[];
  onAbrirHistoria: (pacienteId: string) => void;
  onEditar: (paciente: Paciente) => void;
}

// Listado de pacientes para la compu (en el celular se usa PacientesListaCelular).
export function PacientesTabla({ pacientes, onAbrirHistoria, onEditar }: PacientesTablaProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50/75">
            <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-wider">Paciente</th>
            <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-wider">Contacto</th>
            <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-wider">Actividad</th>
            <th className="px-6 py-4 text-xs font-bold text-stone-400 uppercase tracking-wider">Motivo de Consulta</th>
            <th className="px-6 py-4 text-right text-xs font-bold text-stone-400 uppercase tracking-wider">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 bg-white">
          {pacientes.map((paciente) => (
            <tr 
              key={paciente.id}
              onClick={() => onAbrirHistoria(paciente.id)}
              className="hover:bg-stone-50/50 transition-colors cursor-pointer group"
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 font-bold text-xs shadow-sm uppercase">
                    {paciente.nombre.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-stone-900 group-hover:text-teal-600 transition-colors">{paciente.nombre}</div>
                    <div className="text-xs text-stone-500 mt-0.5">{paciente.edad ? `${paciente.edad} años` : 'Edad no registrada'}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex flex-col gap-1">
                  {paciente.telefono ? (
                    <div className="flex items-center gap-1.5 text-xs text-stone-600">
                      <Phone className="w-3.5 h-3.5 text-stone-400" />
                      <span>{paciente.telefono}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-stone-400">Sin teléfono</span>
                  )}
                  {paciente.direccion && (
                    <div className="text-xs text-stone-400 truncate max-w-[150px]">{paciente.direccion}</div>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {paciente.tipo_clase ? (
                  <span className={cn(
                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider shadow-sm",
                    paciente.tipo_clase === 'RPG' 
                      ? "bg-teal-50 text-teal-700 border-teal-200" 
                      : paciente.tipo_clase === 'TPA' 
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-purple-50 text-purple-700 border-purple-200"
                  )}>
                    {paciente.tipo_clase}
                  </span>
                ) : (
                  <span className="text-xs text-stone-400">--</span>
                )}
              </td>
              <td className="px-6 py-4">
                <div className="text-xs text-stone-600 line-clamp-1 max-w-[200px]" title={paciente.motivo_consulta || undefined}>
                  {paciente.motivo_consulta || <span className="text-stone-400 italic">No registrado</span>}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onAbrirHistoria(paciente.id)}
                    className="px-3 py-1.5 text-xs font-semibold text-teal-600 bg-teal-50 border border-teal-100 rounded-lg hover:bg-teal-100/50 hover:text-teal-700 transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Historia Clínica</span>
                  </button>
                  <button
                    onClick={() => onEditar(paciente)}
                    className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg border border-transparent hover:border-stone-200 transition-all cursor-pointer"
                    title="Editar ficha"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
