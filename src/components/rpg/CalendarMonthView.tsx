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
      <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold tracking-tight text-white capitalize w-48">
            {format(currentDate, 'MMMM yyyy', { locale: es })}
          </h2>
          <div className="flex bg-zinc-950 rounded-lg p-1 border border-zinc-800">
            <button 
              onClick={handlePreviousMonth}
              className="p-1.5 rounded-md hover:bg-zinc-800 hover:text-white text-zinc-400 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={handleToday}
              className="px-4 py-1.5 text-sm font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors rounded-md"
            >
              Hoy
            </button>
            <button 
              onClick={handleNextMonth}
              className="p-1.5 rounded-md hover:bg-zinc-800 hover:text-white text-zinc-400 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        <button 
          onClick={() => openNewTurno()}
          className="bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors active:scale-95 flex items-center gap-2"
        >
          <span className="text-lg leading-none">+</span> <span className="hidden sm:inline">Nuevo Turno</span>
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 flex flex-col overflow-auto bg-zinc-950">
        <div className="grid grid-cols-7 border-b border-zinc-800 bg-zinc-900 sticky top-0 z-10">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
            <div key={day} className="py-3 text-center text-sm font-semibold text-zinc-400">
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
                  "min-h-[120px] p-2 border-b border-r border-zinc-800 transition-colors",
                  !isCurrentMonth && "bg-zinc-950 text-zinc-600",
                  isCurrentMonth && isActiveDay && "bg-zinc-900",
                  isCurrentMonth && !isActiveDay && "bg-zinc-950/50",
                  dayIdx % 7 === 6 && "border-r-0"
                )}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className={cn(
                    "w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium",
                    isToday(day) ? "bg-violet-600 text-white" : 
                    (!isCurrentMonth ? "text-zinc-600" : "text-zinc-300")
                  )}>
                    {format(day, 'd')}
                  </span>
                  {isActiveDay && isCurrentMonth && (
                    <button 
                      onClick={() => openNewTurno(day)}
                      className="p-1 text-zinc-500 hover:text-violet-400 hover:bg-zinc-800 rounded-full transition-colors opacity-0 hover:opacity-100 group-hover:opacity-100 md:opacity-100"
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
        onSave={() => {
          // Manually trigger fetch logic
          const fetchSesiones = async () => {
            const start = startOfMonth(currentDate);
            const end = endOfMonth(currentDate);
            const data = await getSesionesRPGPorRango(
              format(start, 'yyyy-MM-dd'),
              format(end, 'yyyy-MM-dd')
            );
            setSesiones(data);
          };
          fetchSesiones();
        }}
      />

      <HistoriaClinicaModal 
        isOpen={isHistoriaModalOpen}
        onClose={() => setIsHistoriaModalOpen(false)}
        pacienteId={selectedPacienteId}
      />
    </div>
  );
}
