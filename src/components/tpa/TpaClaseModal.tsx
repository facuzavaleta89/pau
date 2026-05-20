"use client";

import { useState, useEffect } from "react";
import { X, Save, Clock, Calendar as CalendarIcon, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { createClaseTPA, upsertAsistenciaTPA } from "@/lib/queries";
import type { HorarioTPA, ClaseTPA, AsistenciaTPA, EstadoAsistenciaTPA } from "@/types";
import { cn } from "@/components/layout/Navigation";

interface TpaClaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  horarios: HorarioTPA[]; // Students with fixed schedule for this time slot
  claseExistente: ClaseTPA | null;
  asistenciasActuales: AsistenciaTPA[];
  fecha: string; // 'yyyy-MM-dd'
  hora: string;
  diaSemana: string;
  onGuardado: () => void; // Callback to refresh grid
}

const ESTADOS: { value: EstadoAsistenciaTPA | 'pendiente'; label: string; color: string; bg: string }[] = [
  { value: 'pendiente', label: 'Pendiente', color: 'text-zinc-500', bg: 'bg-zinc-800 border-zinc-700' },
  { value: 'presente', label: 'Presente', color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/30' },
  { value: 'aviso_ausencia', label: 'Avisó', color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/30' },
  { value: 'falto_sin_avisar', label: 'Faltó', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30' },
  { value: 'recupera', label: 'Recupera', color: 'text-blue-400', bg: 'bg-blue-500/20 border-blue-500/30' },
  { value: 'cancelado', label: 'Cancelado', color: 'text-zinc-500', bg: 'bg-zinc-700/40 border-zinc-600/30' },
  { value: 'vino_otra_clase', label: 'Vino Otra', color: 'text-cyan-400', bg: 'bg-cyan-500/20 border-cyan-500/30' }
];

export function TpaClaseModal({
  isOpen,
  onClose,
  horarios,
  claseExistente,
  asistenciasActuales,
  fecha,
  hora,
  diaSemana,
  onGuardado
}: TpaClaseModalProps) {
  const [saving, setSaving] = useState(false);
  
  // Local state to track selected attendances during modal interaction
  const [localAsistencias, setLocalAsistencias] = useState<Record<string, EstadoAsistenciaTPA | 'pendiente'>>({});

  useEffect(() => {
    if (isOpen) {
      // Initialize local state based on passed asistencias
      const initial: Record<string, EstadoAsistenciaTPA | 'pendiente'> = {};
      horarios.forEach(h => {
        const asistencia = asistenciasActuales.find(a => a.paciente_id === h.paciente_id);
        initial[h.paciente_id] = asistencia?.estado || 'pendiente';
      });
      setLocalAsistencias(initial);
    }
  }, [isOpen, horarios, asistenciasActuales]);

  if (!isOpen) return null;

  const handleGuardar = async () => {
    setSaving(true);
    try {
      let claseId = claseExistente?.id;
      
      // If no class exists yet, create it first
      if (!claseId) {
        const newClase = await createClaseTPA({
          fecha,
          hora
        });
        claseId = newClase.id;
      }

      // Upsert all changed attendances (only if they are not 'pendiente')
      const promesas = horarios.map(async (h) => {
        const estado = localAsistencias[h.paciente_id];
        if (estado && estado !== 'pendiente') {
          await upsertAsistenciaTPA({
            clase_id: claseId,
            paciente_id: h.paciente_id,
            estado: estado as EstadoAsistenciaTPA
          });
        }
      });

      await Promise.all(promesas);
      
      onGuardado();
      onClose();
    } catch (error) {
      console.error("Error saving clase TPA:", error);
      alert("Hubo un error al guardar la asistencia.");
    } finally {
      setSaving(false);
    }
  };

  const formattedDate = fecha ? format(parseISO(fecha), "EEEE d 'de' MMMM", { locale: es }) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-800 flex items-start justify-between bg-zinc-900">
          <div>
            <h3 className="text-xl font-bold text-white capitalize tracking-tight">Gestión de Clase TPA</h3>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-400 capitalize">
                <CalendarIcon className="w-4 h-4" />
                {formattedDate}
              </div>
              <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-400">
                <Clock className="w-4 h-4" />
                {hora}
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Alumnos Inscriptos</h4>
          
          <div className="space-y-4">
            {horarios.map((horario) => {
              const currentState = localAsistencias[horario.paciente_id] || 'pendiente';
              
              return (
                <div key={horario.id} className="p-4 rounded-xl border border-zinc-800 bg-zinc-950 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
                      <User className="w-4 h-4 text-zinc-500" />
                    </div>
                    <span className="font-semibold text-white flex-1">{horario.pacientes?.nombre}</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {ESTADOS.map((estado) => {
                      const isSelected = currentState === estado.value;
                      return (
                        <button
                          key={estado.value}
                          onClick={() => setLocalAsistencias(prev => ({ ...prev, [horario.paciente_id]: estado.value }))}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                            isSelected 
                              ? cn(estado.bg, estado.color, "ring-1 ring-offset-1 ring-offset-zinc-950 ring-violet-500/50") 
                              : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-300"
                          )}
                        >
                          {estado.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            
            {horarios.length === 0 && (
              <div className="text-center py-8 text-zinc-500 bg-zinc-950 rounded-xl border border-dashed border-zinc-800">
                No hay alumnos fijos en este horario.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-zinc-800 bg-zinc-900 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleGuardar}
            disabled={saving}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
