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
  endOfWeek
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
    <div className="flex flex-col h-full bg-white">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-5 border-b border-stone-200 bg-white">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold tracking-tight text-stone-900 capitalize w-48">
            {format(currentDate, 'MMMM yyyy', { locale: es })}
          </h2>
          <div className="flex bg-stone-100 rounded-lg p-1 border border-stone-200">
            <button 
              onClick={handlePreviousMonth}
              className="p-1.5 rounded-md hover:bg-white hover:text-stone-900 text-stone-600 hover:shadow-sm transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={handleToday}
              className="px-4 py-1.5 text-sm font-semibold text-stone-600 hover:text-stone-900 hover:bg-white hover:shadow-sm transition-all rounded-md"
            >
              Hoy
            </button>
            <button 
              onClick={handleNextMonth}
              className="p-1.5 rounded-md hover:bg-white hover:text-stone-900 text-stone-600 hover:shadow-sm transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        <button 
          onClick={() => openNewTurno()}
          className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors active:scale-95 flex items-center gap-2 shadow-sm"
        >
          <span className="text-lg leading-none">+</span> <span className="hidden sm:inline">Nuevo Turno</span>
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 flex flex-col overflow-auto bg-stone-50">
        <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50 sticky top-0 z-10">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
            <div key={day} className="py-3 text-center text-xs font-semibold text-stone-400 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>
        <div className="flex-1 grid grid-cols-7 auto-rows-fr bg-stone-200 gap-[1px]">
          {days.map((day, dayIdx) => {
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isActiveDay = isTuesday(day) || isThursday(day);
            const daySesiones = sesiones.filter(s => s.fecha === format(day, 'yyyy-MM-dd'));

            return (
              <div 
                key={day.toString()}
                className={cn(
                  "min-h-[120px] p-2 transition-all group relative flex flex-col justify-between",
                  !isCurrentMonth && "bg-stone-50/40 text-stone-400",
                  isCurrentMonth && isActiveDay && "bg-white",
                  isCurrentMonth && !isActiveDay && "bg-stone-50/60"
                )}
              >
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className={cn(
                      "w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold transition-all",
                      isToday(day) ? "bg-teal-600 text-white shadow-sm" : 
                      (!isCurrentMonth ? "text-stone-400" : "text-stone-900")
                    )}>
                      {format(day, 'd')}
                    </span>
                    {isActiveDay && isCurrentMonth && (
                      <button 
                        onClick={() => openNewTurno(day)}
                        className="p-1 text-stone-400 hover:text-teal-600 hover:bg-stone-100 rounded-full transition-colors opacity-0 group-hover:opacity-100 md:opacity-100"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    {loading && dayIdx === 15 ? (
                      <div className="animate-pulse space-y-2">
                        <div className="h-16 bg-stone-200 rounded-xl w-full"></div>
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
