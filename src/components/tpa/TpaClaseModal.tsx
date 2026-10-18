"use client";

import { useState, useEffect } from "react";
import { X, Save, Clock, Calendar as CalendarIcon, User, Users, Trash2, Plus, UserMinus } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  createClaseTPA, upsertAsistenciaTPA, deleteAsistenciaTPA, eliminarClaseTPASiVacia,
  getPacientesActivos, createHorarioTPA, deactivateHorarioTPA,
} from "@/lib/queries";
import { mensajeError, registrarError } from "@/lib/errores";
import type { HorarioTPA, ClaseTPA, AsistenciaTPA, EstadoAsistenciaTPA, Paciente } from "@/types";
import { cn } from "@/lib/utils";
import { ESTADOS_ASISTENCIA, ORDEN_ESTADOS_ASISTENCIA } from "@/lib/estados";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

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
  const [activeTab, setActiveTab] = useState<'asistencia' | 'inscripcion'>('asistencia');
  const [saving, setSaving] = useState(false);
  
  // Local state for attendance checklist
  const [localAsistencias, setLocalAsistencias] = useState<Record<string, EstadoAsistenciaTPA>>({});
  
  // States for student enrollment
  const [todosPacientes, setTodosPacientes] = useState<Paciente[]>([]);
  const [selectedPacienteId, setSelectedPacienteId] = useState<string>('');
  const [inscribing, setInscribing] = useState(false);
  const [aDesinscribir, setADesinscribir] = useState<HorarioTPA | null>(null);
  const [desinscribiendo, setDesinscribiendo] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      // Initialize local state based on passed asistencias
      const initial: Record<string, EstadoAsistenciaTPA> = {};
      horarios.forEach(h => {
        const asistencia = asistenciasActuales.find(a => a.paciente_id === h.paciente_id);
        initial[h.paciente_id] = asistencia?.estado || 'pendiente';
      });
      setLocalAsistencias(initial);

      // Load patient database for enrollment dropdown
      getPacientesActivos()
        .then(data => {
          setTodosPacientes(data as Paciente[]);
        })
        .catch(err => registrarError("Error loading patient list in TPA modal", err));
      
      // Default to attendance tab
      setActiveTab('asistencia');
    }
  }, [isOpen, horarios, asistenciasActuales]);

  if (!isOpen) return null;

  // "Sin marcar" (pendiente) = no tener fila de asistencia. Al guardar:
  // - se marcan (upsert) los que tienen un estado;
  // - se desmarcan (delete) los que vuelven a "Sin marcar" y tenían fila;
  // - no se crea la clase si nadie quedó marcado, y se borra si quedó vacía.
  const handleGuardarAsistencia = async () => {
    const estadoGuardado = (pacienteId: string): EstadoAsistenciaTPA =>
      asistenciasActuales.find(a => a.paciente_id === pacienteId)?.estado ?? 'pendiente';

    const aMarcar = horarios.filter(h => {
      const estado = localAsistencias[h.paciente_id] ?? 'pendiente';
      return estado !== 'pendiente' && estado !== estadoGuardado(h.paciente_id);
    });
    const aDesmarcar = horarios.filter(h =>
      (localAsistencias[h.paciente_id] ?? 'pendiente') === 'pendiente' &&
      estadoGuardado(h.paciente_id) !== 'pendiente'
    );

    if (aMarcar.length === 0 && aDesmarcar.length === 0) {
      if (!claseExistente) toast.aviso('No marcaste a nadie: no se guardó la clase.');
      onClose();
      return;
    }

    setSaving(true);
    try {
      let claseId = claseExistente?.id;
      if (!claseId && aMarcar.length > 0) {
        const nuevaClase = await createClaseTPA({ fecha, hora });
        claseId = nuevaClase.id;
      }

      if (claseId) {
        const idClase = claseId;
        await Promise.all([
          ...aMarcar.map(h => upsertAsistenciaTPA({
            clase_id: idClase,
            paciente_id: h.paciente_id,
            estado: localAsistencias[h.paciente_id],
          })),
          ...aDesmarcar.map(h => deleteAsistenciaTPA(idClase, h.paciente_id)),
        ]);
        if (aDesmarcar.length > 0) await eliminarClaseTPASiVacia(idClase);
      }

      toast.exito('Asistencia guardada');
      onGuardado();
      onClose();
    } catch (error: unknown) {
      registrarError("Error guardando asistencia TPA", error);
      toast.error(`No se pudo guardar la asistencia. ${mensajeError(error)}`);
      onGuardado(); // pudo guardarse una parte: refrescar la grilla
    } finally {
      setSaving(false);
    }
  };

  const handleInscribir = async () => {
    if (!selectedPacienteId) return;

    // Check if student is already in this slot
    if (horarios.some(h => h.paciente_id === selectedPacienteId)) {
      toast.aviso("Este alumno ya está inscripto en este horario.");
      return;
    }

    setInscribing(true);
    try {
      // Map label to lowercase DB value
      const diaId = diaSemana.toLowerCase()
        .replace('ércoles', 'ercoles')
        .replace('í', 'i') as 'lunes' | 'miercoles' | 'viernes';

      await createHorarioTPA({
        paciente_id: selectedPacienteId,
        dia_semana: diaId,
        hora
      });

      setSelectedPacienteId('');
      toast.exito('Alumno inscripto');
      onGuardado(); // Triggers parent fetch which refreshes grid and updates modal props
    } catch (err: unknown) {
      registrarError("Error inscribiendo alumno", err);
      toast.error(`No se pudo inscribir al alumno. ${mensajeError(err)}`);
    } finally {
      setInscribing(false);
    }
  };

  const handleConfirmarDesinscribir = async () => {
    if (!aDesinscribir) return;
    setDesinscribiendo(true);
    try {
      await deactivateHorarioTPA(aDesinscribir.id);
      toast.exito('Alumno desinscripto');
      setADesinscribir(null);
      onGuardado(); // Refresh parent data
    } catch (err: unknown) {
      registrarError("Error desinscribiendo alumno", err);
      toast.error(`No se pudo desinscribir al alumno. ${mensajeError(err)}`);
    } finally {
      setDesinscribiendo(false);
    }
  };

  const formattedDate = fecha ? format(parseISO(fecha), "EEEE d 'de' MMMM", { locale: es }) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-stone-200 w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-200 bg-white">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-stone-900 capitalize tracking-tight">Gestión de Clase TPA</h3>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 capitalize">
                  <CalendarIcon className="w-4 h-4 text-stone-400" />
                  {formattedDate}
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-500">
                  <Clock className="w-4 h-4 text-stone-400" />
                  {hora}
                </div>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-full transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Clean Navigation Tabs */}
          <div className="flex border-b border-stone-100 mt-5 -mb-5 gap-6">
            <button
              onClick={() => setActiveTab('asistencia')}
              className={cn(
                "pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer",
                activeTab === 'asistencia'
                  ? "border-teal-600 text-teal-600"
                  : "border-transparent text-stone-400 hover:text-stone-700"
              )}
            >
              Asistencia de Hoy
            </button>
            <button
              onClick={() => setActiveTab('inscripcion')}
              className={cn(
                "pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer",
                activeTab === 'inscripcion'
                  ? "border-teal-600 text-teal-600"
                  : "border-transparent text-stone-400 hover:text-stone-700"
              )}
            >
              Alumnos Inscriptos ({horarios.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Asistencia */}
        {activeTab === 'asistencia' && (
          <>
            <div className="p-6 overflow-y-auto flex-1 bg-white space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider">Planilla de Asistencia</h4>
                <span className="text-xs font-medium text-stone-600 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-full">
                  Fijos: {horarios.length}
                </span>
              </div>
              
              <div className="space-y-4">
                {horarios.map((horario) => {
                  const currentState = localAsistencias[horario.paciente_id] || 'pendiente';
                  
                  return (
                    <div key={horario.id} className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 flex flex-col gap-3 hover:border-stone-300 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-stone-200 shadow-sm">
                          <User className="w-4 h-4 text-stone-400" />
                        </div>
                        <span className="font-semibold text-stone-900 flex-1">{horario.pacientes?.nombre}</span>
                      </div>
                      
                      <div className="flex flex-wrap gap-1.5">
                        {ORDEN_ESTADOS_ASISTENCIA.map((valor) => {
                          const estado = ESTADOS_ASISTENCIA[valor];
                          const isSelected = currentState === valor;
                          return (
                            <button
                              key={valor}
                              onClick={() => setLocalAsistencias(prev => ({ ...prev, [horario.paciente_id]: valor }))}
                              aria-pressed={isSelected}
                              className={cn(
                                "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border shadow-sm cursor-pointer",
                                isSelected
                                  ? cn(estado.clases, "ring-2 ring-teal-500/30 font-semibold")
                                  : "bg-white text-stone-500 border-stone-200 hover:bg-stone-50 hover:text-stone-900"
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
                  <div className="text-center py-12 text-stone-400 bg-stone-50 rounded-xl border border-dashed border-stone-200">
                    No hay alumnos fijos inscriptos en este horario.<br/>
                    <button 
                      onClick={() => setActiveTab('inscripcion')}
                      className="mt-3 text-xs font-semibold text-teal-600 hover:underline inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Inscribir un Alumno Fijo
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Footer for Asistencia */}
            <div className="p-5 border-t border-stone-200 bg-white flex justify-end gap-3">
              <button 
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 bg-white border border-stone-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                onClick={handleGuardarAsistencia}
                disabled={saving || horarios.length === 0}
                className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none shadow-sm cursor-pointer"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                Guardar Asistencia
              </button>
            </div>
          </>
        )}

        {/* Tab 2: Inscripciones */}
        {activeTab === 'inscripcion' && (
          <>
            <div className="p-6 overflow-y-auto flex-1 bg-white flex flex-col justify-between min-h-[350px]">
              
              {/* Enrolled Students List */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Alumnos Fijos Semanales</h4>
                
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {horarios.map((horario) => (
                    <div key={horario.id} className="flex items-center justify-between p-3 rounded-lg border border-stone-150 bg-white hover:border-stone-300 transition-all shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <User className="w-4 h-4 text-stone-400" />
                        <span className="font-semibold text-stone-900 text-sm">{horario.pacientes?.nombre}</span>
                      </div>
                      <button
                        onClick={() => setADesinscribir(horario)}
                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100 cursor-pointer"
                        title="Desinscribir alumno"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {horarios.length === 0 && (
                    <div className="text-center py-10 text-stone-400 bg-stone-50 rounded-xl border border-dashed border-stone-200 text-xs">
                      Este turno semanal no tiene alumnos fijos asignados aún.
                    </div>
                  )}
                </div>
              </div>

              {/* Enrollment Form at Bottom */}
              <div className="border-t border-stone-200 pt-5 mt-6 space-y-3">
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-teal-600" /> Inscribir Nuevo Alumno
                </h4>
                
                <div className="flex gap-2">
                  <select
                    value={selectedPacienteId}
                    onChange={(e) => setSelectedPacienteId(e.target.value)}
                    className="flex-1 bg-white border border-stone-200 text-stone-900 text-sm px-3 py-2.5 rounded-lg placeholder:text-stone-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                  >
                    <option value="">-- Seleccionar Paciente --</option>
                    {todosPacientes
                      .filter(p => !horarios.some(h => h.paciente_id === p.id)) // Exclude already enrolled
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} {p.tipo_clase ? `(${p.tipo_clase})` : ''}
                        </option>
                      ))
                    }
                  </select>
                  <button
                    onClick={handleInscribir}
                    disabled={inscribing || !selectedPacienteId}
                    className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Inscribir
                  </button>
                </div>
              </div>
            </div>

            {/* Footer for Inscripciones */}
            <div className="p-5 border-t border-stone-200 bg-white flex justify-end">
              <button 
                onClick={onClose}
                className="px-6 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 bg-white border border-stone-200 rounded-lg transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        abierto={aDesinscribir !== null}
        titulo={`¿Desinscribir a ${aDesinscribir?.pacientes?.nombre ?? 'este alumno'}?`}
        mensaje={
          <p>
            Deja de ser alumno fijo de los <span className="lowercase">{diaSemana}</span> a las {hora}.
            Sus asistencias ya registradas no se borran.
          </p>
        }
        textoConfirmar="Desinscribir"
        cargando={desinscribiendo}
        onConfirmar={handleConfirmarDesinscribir}
        onCancelar={() => setADesinscribir(null)}
      />
    </div>
  );
}
