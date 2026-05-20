"use client";

import { useState, useEffect, useMemo } from "react";
import { Clock, Plus, ChevronLeft, ChevronRight, User } from "lucide-react";
import { cn } from "@/components/layout/Navigation";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameWeek, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { getHorariosTPA, getClasesTPAPorRango, getAsistenciasTPA } from "@/lib/queries";
import type { HorarioTPA, ClaseTPA, AsistenciaTPA, EstadoAsistenciaTPA } from "@/types";
import { TpaClaseModal } from "./TpaClaseModal";
import { HistoriaClinicaModal } from "@/components/pacientes/HistoriaClinicaModal";

const DIAS_SEMANA = [
  { id: 'lunes', label: 'Lunes' },
  { id: 'miercoles', label: 'Miércoles' },
  { id: 'viernes', label: 'Viernes' }
] as const;

export function TpaWeeklyView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [horarios, setHorarios] = useState<HorarioTPA[]>([]);
  const [clases, setClases] = useState<ClaseTPA[]>([]);
  const [asistencias, setAsistencias] = useState<AsistenciaTPA[]>([]);
  
  // Patient details modal
  const [selectedPacienteId, setSelectedPacienteId] = useState<string | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  
  // Modal states
  const [modalData, setModalData] = useState<{
    isOpen: boolean;
    horarios: HorarioTPA[];
    claseExistente: ClaseTPA | null;
    fecha: string;
    hora: string;
    diaSemana: string;
  }>({
    isOpen: false,
    horarios: [],
    claseExistente: null,
    fecha: '',
    hora: '',
    diaSemana: ''
  });

  const fetchWeekData = async () => {
    setLoading(true);
    try {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      
      const startDateStr = format(start, 'yyyy-MM-dd');
      const endDateStr = format(end, 'yyyy-MM-dd');

      const [horariosData, clasesData] = await Promise.all([
        getHorariosTPA(),
        getClasesTPAPorRango(startDateStr, endDateStr)
      ]);

      setHorarios(horariosData as HorarioTPA[]);
      setClases(clasesData as ClaseTPA[]);

      if (clasesData.length > 0) {
        const claseIds = clasesData.map(c => c.id);
        const asistenciasData = await getAsistenciasTPA(claseIds);
        setAsistencias(asistenciasData as AsistenciaTPA[]);
      } else {
        setAsistencias([]);
      }
    } catch (error) {
      console.error("Error fetching TPA data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeekData();
  }, [currentDate]);

  const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  // Distinct times for rows
  const timeSlots = useMemo(() => {
    const times = new Set<string>();
    
    // Always include a default range of hours so the grid doesn't appear empty
    for (let i = 8; i <= 20; i++) {
      times.add(`${i.toString().padStart(2, '0')}:00`);
    }

    horarios.forEach(h => times.add(h.hora));
    clases.forEach(c => times.add(c.hora)); // Include times if a class was created outside fixed schedule
    return Array.from(times).sort();
  }, [horarios, clases]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const getStatusColor = (estado?: EstadoAsistenciaTPA) => {
    switch (estado) {
      case 'presente': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'aviso_ausencia': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'falto_sin_avisar': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'recupera': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'cancelado': return 'bg-zinc-700/40 text-zinc-500 border-zinc-600/30';
      default: return 'bg-zinc-800 text-zinc-500 border-zinc-700';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Week Header */}
      <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold tracking-tight text-white w-64">
            {format(weekStart, "d MMM", { locale: es })} - {format(weekEnd, "d MMM yyyy", { locale: es })}
          </h2>
          <div className="flex bg-zinc-950 rounded-lg p-1 border border-zinc-800">
            <button onClick={handlePrevWeek} className="p-1.5 rounded-md hover:bg-zinc-800 hover:text-white text-zinc-400 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={handleToday} className="px-4 py-1.5 text-sm font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors rounded-md">
              Hoy
            </button>
            <button onClick={handleNextWeek} className="p-1.5 rounded-md hover:bg-zinc-800 hover:text-white text-zinc-400 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-zinc-950 p-6">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-[100px_1fr_1fr_1fr] gap-6 max-w-7xl mx-auto">
            {/* Headers */}
            <div className="col-start-2 text-center pb-4 border-b-2 border-zinc-800 font-bold text-zinc-400 text-lg">Lunes</div>
            <div className="text-center pb-4 border-b-2 border-zinc-800 font-bold text-zinc-400 text-lg">Miércoles</div>
            <div className="text-center pb-4 border-b-2 border-zinc-800 font-bold text-zinc-400 text-lg">Viernes</div>

            {/* Grid Rows */}
            {timeSlots.map((time) => (
              <div key={time} className="contents group">
                {/* Time Label */}
                <div className="flex items-center justify-end pr-4 text-zinc-500 font-bold text-lg">
                  {time}
                </div>

                {/* Day Columns */}
                {DIAS_SEMANA.map((dia) => {
                  const dayHorarios = horarios.filter(h => h.hora === time && h.dia_semana === dia.id);
                  const maxSlots = 5;
                  
                  // Calculate exact date for this column
                  let dayOffset = 0;
                  if (dia.id === 'lunes') dayOffset = 0;
                  if (dia.id === 'miercoles') dayOffset = 2;
                  if (dia.id === 'viernes') dayOffset = 4;
                  
                  // In JS, startOfWeek with weekStartsOn: 1 means Monday is day 1. 
                  const cellDate = format(new Date(weekStart.getTime() + dayOffset * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
                  
                  // Check if a class exists for this date and time
                  const classThisWeek = clases.find(c => c.fecha === cellDate && c.hora === time);
                  
                  return (
                    <div 
                      key={`${time}-${dia.id}`} 
                      className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 shadow-sm hover:border-zinc-700 transition-colors cursor-pointer min-h-[160px]"
                      onClick={() => {
                        setModalData({
                          isOpen: true,
                          horarios: dayHorarios,
                          claseExistente: classThisWeek || null,
                          fecha: cellDate,
                          hora: time,
                          diaSemana: dia.label
                        });
                      }}
                    >
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-950 rounded-md border border-zinc-800">
                          <Clock className="w-3.5 h-3.5 text-zinc-500" />
                          <span className="text-xs font-bold text-zinc-300">{time}</span>
                        </div>
                        <span className="text-xs font-semibold text-zinc-500 bg-zinc-950 px-2 py-1 rounded-md border border-zinc-800">
                          {dayHorarios.length}/{maxSlots}
                        </span>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        {dayHorarios.map((horario) => {
                          const asistencia = classThisWeek 
                            ? asistencias.find(a => a.clase_id === classThisWeek.id && a.paciente_id === horario.paciente_id)
                            : null;
                          
                          const estado = asistencia?.estado;
                          
                          return (
                            <div 
                              key={horario.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPacienteId(horario.paciente_id);
                                setIsHistoryModalOpen(true);
                              }}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all border font-medium hover:brightness-110 hover:text-white active:scale-95 cursor-pointer",
                                getStatusColor(estado as EstadoAsistenciaTPA)
                              )}
                            >
                              <User className="w-4 h-4 opacity-70" />
                              <span className="truncate w-full hover:underline">{horario.pacientes?.nombre}</span>
                            </div>
                          );
                        })}
                        {dayHorarios.length === 0 && (
                          <div className="flex-1 flex items-center justify-center pt-6 opacity-40">
                            <span className="text-sm text-zinc-500 font-medium border border-dashed border-zinc-700 rounded-lg px-4 py-2">Libre</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <TpaClaseModal 
        isOpen={modalData.isOpen}
        onClose={() => setModalData(prev => ({ ...prev, isOpen: false }))}
        horarios={modalData.horarios}
        claseExistente={modalData.claseExistente}
        asistenciasActuales={asistencias.filter(a => a.clase_id === modalData.claseExistente?.id)}
        fecha={modalData.fecha}
        hora={modalData.hora}
        diaSemana={modalData.diaSemana}
        onGuardado={fetchWeekData}
      />

      <HistoriaClinicaModal 
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        pacienteId={selectedPacienteId}
      />
    </div>
  );
}
