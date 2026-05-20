"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday,
  isTuesday,
  isThursday,
  startOfWeek,
  endOfWeek,
  isSameDay
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { getSesionesRPGPorRango } from '@/lib/queries';
import type { SesionRPG } from '@/types';
import { cn } from '@/components/layout/Navigation';
import { TurnoCard } from './TurnoCard';
import { TurnoModal } from './TurnoModal';
import { HistoriaClinicaModal } from '../pacientes/HistoriaClinicaModal';

export function CalendarMonthView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sesiones, setSesiones] = useState<SesionRPG[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [isTurnoModalOpen, setIsTurnoModalOpen] = useState(false);
  const [selectedTurno, setSelectedTurno] = useState<SesionRPG | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  
  const [isHistoriaModalOpen, setIsHistoriaModalOpen] = useState(false);
  const [selectedPacienteId, setSelectedPacienteId] = useState<string | null>(null);

  // Fetch data when month changes
  useEffect(() => {
    const fetchSesiones = async () => {
      setLoading(true);
      try {
        const start = startOfMonth(currentDate);
        const end = endOfMonth(currentDate);
        const data = await getSesionesRPGPorRango(
          format(start, 'yyyy-MM-dd'),
          format(end, 'yyyy-MM-dd')
        );
        setSesiones(data);
      } catch (error) {
        console.error('Error fetching sesiones:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSesiones();
  }, [currentDate]);

  // Calendar generation
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const handlePreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  const openNewTurno = (date?: Date) => {
    setSelectedTurno(null);
    setSelectedDate(date);
    setIsTurnoModalOpen(true);
  };

  const openEditTurno = (turno: SesionRPG) => {
    setSelectedTurno(turno);
    setIsTurnoModalOpen(true);
  };

  const openHistoriaClinica = (pacienteId: string) => {
    setSelectedPacienteId(pacienteId);
    setIsHistoriaModalOpen(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-slate-800 capitalize w-48">
            {format(currentDate, 'MMMM yyyy', { locale: es })}
          </h2>
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button 
              onClick={handlePreviousMonth}
              className="p-1.5 rounded hover:bg-white hover:shadow-sm transition-all"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <button 
              onClick={handleToday}
              className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white hover:shadow-sm transition-all rounded"
            >
              Hoy
            </button>
            <button 
              onClick={handleNextMonth}
              className="p-1.5 rounded hover:bg-white hover:shadow-sm transition-all"
            >
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>
        <button 
          onClick={() => openNewTurno()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-sm shadow-blue-600/20"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Nuevo Turno</span>
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 flex flex-col overflow-auto bg-slate-50">
        <div className="grid grid-cols-7 border-b bg-white sticky top-0 z-10">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
            <div key={day} className="py-3 text-center text-sm font-semibold text-slate-500">
              {day}
            </div>
          ))}
        </div>
        <div className="flex-1 grid grid-cols-7 auto-rows-fr">
          {days.map((day, dayIdx) => {
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isActiveDay = isTuesday(day) || isThursday(day);
            const daySesiones = sesiones.filter(s => s.fecha === format(day, 'yyyy-MM-dd'));

            return (
              <div 
                key={day.toString()}
                className={cn(
                  "min-h-[120px] p-2 border-b border-r transition-colors",
                  !isCurrentMonth && "bg-slate-50/50 text-slate-400",
                  isCurrentMonth && isActiveDay && "bg-white",
                  isCurrentMonth && !isActiveDay && "bg-slate-50/80",
                  dayIdx % 7 === 6 && "border-r-0"
                )}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className={cn(
                    "w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium",
                    isToday(day) ? "bg-blue-600 text-white shadow-sm" : 
                    (!isCurrentMonth ? "text-slate-400" : "text-slate-700")
                  )}>
                    {format(day, 'd')}
                  </span>
                  {isActiveDay && isCurrentMonth && (
                    <button 
                      onClick={() => openNewTurno(day)}
                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors opacity-0 hover:opacity-100 group-hover:opacity-100 md:opacity-100"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                <div className="space-y-2">
                  {loading && dayIdx === 15 ? (
                    <div className="animate-pulse space-y-2">
                      <div className="h-16 bg-slate-200 rounded-xl w-full"></div>
                    </div>
                  ) : (
                    daySesiones.map(turno => (
                      <TurnoCard 
                        key={turno.id}
                        turno={turno}
                        onClick={() => openEditTurno(turno)}
                        onPacienteClick={(e) => {
                          e.stopPropagation();
                          openHistoriaClinica(turno.paciente_id);
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TurnoModal 
        isOpen={isTurnoModalOpen} 
        onClose={() => setIsTurnoModalOpen(false)} 
        turno={selectedTurno}
        selectedDate={selectedDate}
      />

      <HistoriaClinicaModal 
        isOpen={isHistoriaModalOpen}
        onClose={() => setIsHistoriaModalOpen(false)}
        pacienteId={selectedPacienteId}
      />
    </div>
  );
}
