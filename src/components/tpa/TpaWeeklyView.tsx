"use client";

import { useState, useEffect, useMemo } from "react";
import { Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { getHorariosTPA, getClasesTPAPorRango, getAsistenciasTPA } from "@/lib/queries";
import { mensajeError, registrarError } from "@/lib/errores";
import { normalizarHora } from "@/lib/horas";
import { ESTADOS_ASISTENCIA } from "@/lib/estados";
import { useToast } from "@/components/ui/ToastProvider";
import type { HorarioTPA, ClaseTPA, AsistenciaTPA } from "@/types";
import { TpaClaseModal } from "./TpaClaseModal";
import { HistoriaClinicaModal } from "@/components/pacientes/HistoriaClinicaModal";

const DIAS_SEMANA = [
  { id: 'lunes', label: 'Lunes', offset: 0 },
  { id: 'miercoles', label: 'Miércoles', offset: 2 },
  { id: 'viernes', label: 'Viernes', offset: 4 }
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
  
  // Modal: solo guarda qué celda está abierta. Los alumnos, la clase y las
  // asistencias se derivan de los datos actuales (no una copia congelada),
  // así el modal se actualiza al inscribir/desinscribir o al recargar.
  const [modalData, setModalData] = useState<{
    isOpen: boolean;
    fecha: string;
    hora: string;
    diaId: string;
    diaSemana: string;
  }>({
    isOpen: false,
    fecha: '',
    hora: '',
    diaId: '',
    diaSemana: ''
  });
  const toast = useToast();

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
      registrarError("Error cargando la semana TPA", error);
      toast.error(`No se pudo cargar la agenda TPA. ${mensajeError(error)}`);
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

    horarios.forEach(h => times.add(normalizarHora(h.hora)));
    clases.forEach(c => times.add(normalizarHora(c.hora))); // Include times if a class was created outside fixed schedule
    return Array.from(times).sort();
  }, [horarios, clases]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const mismaHora = (a: string, b: string) => normalizarHora(a) === normalizarHora(b);

  // Datos de la celda abierta en el modal, siempre tomados del estado actual.
  const modalHorarios = useMemo(
    () => horarios.filter(h => h.dia_semana === modalData.diaId && mismaHora(h.hora, modalData.hora)),
    [horarios, modalData.diaId, modalData.hora]
  );
  const modalClase = useMemo(
    () => clases.find(c => c.fecha === modalData.fecha && mismaHora(c.hora, modalData.hora)) ?? null,
    [clases, modalData.fecha, modalData.hora]
  );
  const modalAsistencias = useMemo(
    () => (modalClase ? asistencias.filter(a => a.clase_id === modalClase.id) : []),
    [asistencias, modalClase]
  );

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Week Header */}
      <div className="flex items-center justify-between p-5 border-b border-stone-200 bg-white">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold tracking-tight text-stone-900 w-64">
            {format(weekStart, "d MMM", { locale: es })} - {format(weekEnd, "d MMM yyyy", { locale: es })}
          </h2>
          <div className="flex bg-stone-100 rounded-lg p-1 border border-stone-200">
            <button onClick={handlePrevWeek} className="p-1.5 rounded-md hover:bg-white hover:text-stone-900 text-stone-600 hover:shadow-sm transition-all">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={handleToday} className="px-4 py-1.5 text-sm font-semibold text-stone-600 hover:text-stone-900 hover:bg-white hover:shadow-sm transition-all rounded-md">
              Hoy
            </button>
            <button onClick={handleNextWeek} className="p-1.5 rounded-md hover:bg-white hover:text-stone-900 text-stone-600 hover:shadow-sm transition-all">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-stone-50 p-6">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-[100px_1fr_1fr_1fr] gap-6 max-w-7xl mx-auto">
            {/* Headers */}
            <div className="col-start-2 text-center pb-4 border-b-2 border-stone-200 font-bold text-stone-400 text-xs uppercase tracking-wider">Lunes</div>
            <div className="text-center pb-4 border-b-2 border-stone-200 font-bold text-stone-400 text-xs uppercase tracking-wider">Miércoles</div>
            <div className="text-center pb-4 border-b-2 border-stone-200 font-bold text-stone-400 text-xs uppercase tracking-wider">Viernes</div>

            {/* Grid Rows */}
            {timeSlots.map((time) => (
              <div key={time} className="contents group">
                {/* Time Label */}
                <div className="flex items-center justify-end pr-4 text-stone-400 font-bold text-sm">
                  {time}
                </div>

                {/* Day Columns */}
                {DIAS_SEMANA.map((dia) => {
                  const dayHorarios = horarios.filter(h => mismaHora(h.hora, time) && h.dia_semana === dia.id);
                  const maxSlots = 5;
                  
                  // Fecha exacta de esta columna (la semana arranca el lunes)
                  const cellDate = format(addDays(weekStart, dia.offset), 'yyyy-MM-dd');
                  
                  // Check if a class exists for this date and time
                  const classThisWeek = clases.find(c => c.fecha === cellDate && mismaHora(c.hora, time));
                  
                  return (
                    <div 
                      key={`${time}-${dia.id}`} 
                      className="bg-white rounded-xl p-4 border border-stone-200 shadow-sm hover:shadow-md hover:border-stone-300 transition-all cursor-pointer min-h-[160px] flex flex-col justify-between"
                      onClick={() => {
                        setModalData({
                          isOpen: true,
                          fecha: cellDate,
                          hora: time,
                          diaId: dia.id,
                          diaSemana: dia.label
                        });
                      }}
                    >
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-stone-50 rounded-md border border-stone-200">
                            <Clock className="w-3.5 h-3.5 text-stone-400" />
                            <span className="text-xs font-bold text-stone-600">{time}</span>
                          </div>
                          <span className="text-xs font-semibold text-stone-500 bg-stone-50 px-2 py-1 rounded-md border border-stone-200">
                            {dayHorarios.length}/{maxSlots}
                          </span>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          {dayHorarios.map((horario) => {
                            const asistencia = classThisWeek 
                              ? asistencias.find(a => a.clase_id === classThisWeek.id && a.paciente_id === horario.paciente_id)
                              : null;
                            
                            const estado = ESTADOS_ASISTENCIA[asistencia?.estado ?? 'pendiente'];
                            const IconoEstado = estado.icono;
                            
                            return (
                              <div 
                                key={horario.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPacienteId(horario.paciente_id);
                                  setIsHistoryModalOpen(true);
                                }}
                                title={estado.label}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all border font-medium active:scale-95 cursor-pointer shadow-sm hover:shadow-md",
                                  estado.clases
                                )}
                              >
                                <IconoEstado className="w-3.5 h-3.5 shrink-0" aria-label={estado.label} />
                                <span className="truncate w-full hover:underline">{horario.pacientes?.nombre}</span>
                              </div>
                            );
                          })}
                          {dayHorarios.length === 0 && (
                            <div className="flex-1 flex items-center justify-center pt-6">
                              <span className="text-xs text-stone-400 font-medium border border-dashed border-stone-200 rounded-lg px-4 py-2 bg-stone-50/50">Libre</span>
                            </div>
                          )}
                        </div>
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
        horarios={modalHorarios}
        claseExistente={modalClase}
        asistenciasActuales={modalAsistencias}
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
