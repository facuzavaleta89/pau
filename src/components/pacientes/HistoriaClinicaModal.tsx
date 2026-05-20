"use client";

import { useState, useEffect, useMemo } from 'react';
import { X, User, ShieldAlert, Calendar, FileText, CheckCircle, Phone, Info } from 'lucide-react';
import { getPacienteById, getSesionesRPGPorPaciente, getAsistenciasTPAPorPaciente } from '@/lib/queries';
import type { Paciente, SesionRPG, AsistenciaTPA } from '@/types';
import { cn } from '@/components/layout/Navigation';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface HistoriaClinicaModalProps {
  isOpen: boolean;
  onClose: () => void;
  pacienteId?: string | null;
}

export function HistoriaClinicaModal({ isOpen, onClose, pacienteId }: HistoriaClinicaModalProps) {
  const [activeTab, setActiveTab] = useState<'ficha' | 'historial' | 'alertas'>('ficha');
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [rpgSessions, setRpgSessions] = useState<SesionRPG[]>([]);
  const [tpaAttendances, setTpaAttendances] = useState<AsistenciaTPA[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && pacienteId) {
      const loadDatos = async () => {
        setLoading(true);
        try {
          const [pacienteData, rpgData, tpaData] = await Promise.all([
            getPacienteById(pacienteId),
            getSesionesRPGPorPaciente(pacienteId),
            getAsistenciasTPAPorPaciente(pacienteId)
          ]);
          setPaciente(pacienteData);
          setRpgSessions(rpgData);
          setTpaAttendances(tpaData);
        } catch (error) {
          console.error("Error cargando historia clínica:", error);
        } finally {
          setLoading(false);
        }
      };
      loadDatos();
    }
  }, [isOpen, pacienteId]);

  // --- ALERTS SYSTEM ---
  const hasThreeConsecutiveAbsences = useMemo(() => {
    if (tpaAttendances.length < 3) return false;
    const recentThree = tpaAttendances.slice(0, 3);
    return recentThree.every(a => a.estado === 'falto_sin_avisar');
  }, [tpaAttendances]);

  const hasAlertPresion = useMemo(() => {
    const containsPresion = (text: string | null) => 
      text ? text.toLowerCase().includes('presión') || text.toLowerCase().includes('presion') : false;
    
    return rpgSessions.some(s => containsPresion(s.nota)) || tpaAttendances.some(a => containsPresion(a.nota));
  }, [rpgSessions, tpaAttendances]);

  const hasAlertLesionDolor = useMemo(() => {
    const containsLesionDolor = (text: string | null) => 
      text ? text.toLowerCase().includes('lesión') || text.toLowerCase().includes('lesion') || text.toLowerCase().includes('dolor') : false;

    return rpgSessions.some(s => containsLesionDolor(s.nota)) || tpaAttendances.some(a => containsLesionDolor(a.nota));
  }, [rpgSessions, tpaAttendances]);

  const alertsCount = (hasThreeConsecutiveAbsences ? 1 : 0) + (hasAlertPresion ? 1 : 0) + (hasAlertLesionDolor ? 1 : 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-stone-200 w-full max-w-4xl h-[85vh] rounded-2xl shadow-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 text-stone-900">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-200 flex items-start justify-between bg-white">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-stone-900 tracking-tight">
                {paciente ? paciente.nombre : 'Cargando Historia Clínica...'}
              </h2>
              {alertsCount > 0 && (
                <span className="flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-sm animate-pulse">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  {alertsCount} {alertsCount === 1 ? 'alerta' : 'alertas'}
                </span>
              )}
            </div>
            {paciente && (
              <p className="text-xs text-stone-600 mt-1">
                Clase: <span className="font-semibold text-teal-600 uppercase">{paciente.tipo_clase || 'No asignada'}</span> • Edad: {paciente.edad || 'No registrada'} años
              </p>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center bg-stone-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-stone-50">
            {/* Sidebar Tabs */}
            <div className="w-full md:w-56 bg-white border-r border-stone-200 flex md:flex-col p-2 gap-1 overflow-x-auto md:overflow-x-visible">
              <button
                onClick={() => setActiveTab('ficha')}
                className={cn(
                  "flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm font-semibold transition-all w-full shrink-0 md:shrink cursor-pointer",
                  activeTab === 'ficha' 
                    ? "bg-teal-600 text-white shadow-sm" 
                    : "text-stone-500 hover:bg-stone-50 hover:text-stone-900"
                )}
              >
                <User className="w-4 h-4" />
                Ficha del Paciente
              </button>
              <button
                onClick={() => setActiveTab('historial')}
                className={cn(
                  "flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm font-semibold transition-all w-full shrink-0 md:shrink cursor-pointer",
                  activeTab === 'historial' 
                    ? "bg-teal-600 text-white shadow-sm" 
                    : "text-stone-500 hover:bg-stone-50 hover:text-stone-900"
                )}
              >
                <Calendar className="w-4 h-4" />
                Historial de Sesiones
              </button>
              <button
                onClick={() => setActiveTab('alertas')}
                className={cn(
                  "flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm font-semibold transition-all w-full shrink-0 md:shrink relative cursor-pointer",
                  activeTab === 'alertas' 
                    ? "bg-teal-600 text-white shadow-sm" 
                    : "text-stone-500 hover:bg-stone-50 hover:text-stone-900"
                )}
              >
                <ShieldAlert className="w-4 h-4" />
                Alertas Clínicas
                {alertsCount > 0 && activeTab !== 'alertas' && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-amber-500 rounded-full border border-white" />
                )}
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-stone-50">
              
              {/* Tab 1: Ficha del Paciente */}
              {activeTab === 'ficha' && paciente && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* Datos Básicos */}
                  <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4 shadow-sm">
                    <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider flex items-center gap-2 border-b border-stone-100 pb-2">
                      <Phone className="w-4 h-4 text-teal-600" /> Datos de Contacto
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Teléfono Principal</span>
                        <span className="text-stone-700 font-semibold">{paciente.telefono || 'No registrado'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Contacto de Emergencia</span>
                        <span className="text-stone-700 font-semibold">{paciente.telefono_emergencia || 'No registrado'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Dirección</span>
                        <span className="text-stone-700 font-semibold">{paciente.direccion || 'No registrada'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Profesión</span>
                        <span className="text-stone-700 font-semibold">{paciente.profesion || 'No registrada'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Datos Clínicos */}
                  <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4 shadow-sm">
                    <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider flex items-center gap-2 border-b border-stone-100 pb-2">
                      <FileText className="w-4 h-4 text-teal-600" /> Antecedentes y Evaluación
                    </h3>
                    <div className="space-y-4 text-sm">
                      <div>
                        <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Motivo de Consulta</span>
                        <p className="text-stone-600 mt-1 leading-relaxed bg-stone-50 p-3 rounded-lg border border-stone-200">{paciente.motivo_consulta || 'Sin registrar'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Antecedentes Clínicos</span>
                        <p className="text-stone-600 mt-1 leading-relaxed bg-stone-50 p-3 rounded-lg border border-stone-200">{paciente.antecedentes_clinicos || 'Sin antecedentes registrados'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Estudios Imagenológicos (Rayos X, RM, etc.)</span>
                        <p className="text-stone-600 mt-1 leading-relaxed bg-stone-50 p-3 rounded-lg border border-stone-200">{paciente.estudios_imagenologicos || 'Sin estudios cargados'}</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Actividad Física</span>
                          <p className="text-stone-600 mt-1 leading-relaxed bg-stone-50 p-3 rounded-lg border border-stone-200">{paciente.actividad_fisica || 'No realiza / no registrada'}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Objetivo del Tratamiento</span>
                          <p className="text-stone-600 mt-1 leading-relaxed bg-stone-50 p-3 rounded-lg border border-stone-200">{paciente.objetivo_tratamiento || 'Sin definir'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Historial de Sesiones */}
              {activeTab === 'historial' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* Sesiones RPG */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider border-b border-stone-200 pb-2">Sesiones RPG (Individuales)</h3>
                    {rpgSessions.length === 0 ? (
                      <p className="text-sm text-stone-400 italic">No registra sesiones individuales.</p>
                    ) : (
                      <div className="space-y-2">
                        {rpgSessions.map(session => (
                          <div key={session.id} className="bg-white border border-stone-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm hover:border-stone-300 transition-colors">
                            <div>
                              <div className="flex items-center gap-2.5">
                                <span className="text-sm font-bold text-stone-900">
                                  {format(parseISO(session.fecha), "d 'de' MMMM, yyyy", { locale: es })}
                                </span>
                                <span className="text-xs text-stone-600 bg-stone-50 border border-stone-200 px-2 py-0.5 rounded">
                                  {session.hora.substring(0,5)} hs
                                </span>
                              </div>
                              {session.nota && (
                                <p className="text-xs text-stone-500 mt-2 bg-stone-50 p-2.5 rounded border border-stone-100 leading-relaxed font-sans">
                                  Nota: {session.nota}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={cn(
                                "px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                                session.estado_sesion === 'realizada' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                session.estado_sesion === 'cancelada' ? 'bg-stone-100 text-stone-400 border-stone-200' :
                                'bg-stone-50 text-stone-500 border-stone-200'
                              )}>
                                {session.estado_sesion}
                              </span>
                              <span className={cn(
                                "px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                                session.estado_pago === 'pagado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                'bg-amber-50 text-amber-700 border-amber-200'
                              )}>
                                {session.estado_pago}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Asistencias TPA */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider border-b border-stone-200 pb-2">Clases TPA (Grupales)</h3>
                    {tpaAttendances.length === 0 ? (
                      <p className="text-sm text-stone-400 italic">No registra asistencias a clases grupales.</p>
                    ) : (
                      <div className="space-y-2">
                        {tpaAttendances.map(att => (
                          <div key={att.id} className="bg-white border border-stone-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm hover:border-stone-300 transition-colors">
                            <div>
                              <div className="flex items-center gap-2.5">
                                <span className="text-sm font-bold text-stone-900">
                                  {att.clases_tpa?.fecha 
                                    ? format(parseISO(att.clases_tpa.fecha), "d 'de' MMMM, yyyy", { locale: es }) 
                                    : 'Fecha no registrada'}
                                </span>
                                <span className="text-xs text-stone-600 bg-stone-50 border border-stone-200 px-2 py-0.5 rounded">
                                  {att.clases_tpa?.hora ? att.clases_tpa.hora.substring(0,5) : '--:--'} hs
                                </span>
                              </div>
                              {att.nota && (
                                <p className="text-xs text-stone-500 mt-2 bg-stone-50 p-2.5 rounded border border-stone-100 leading-relaxed font-sans">
                                  Nota: {att.nota}
                                </p>
                              )}
                            </div>
                            <span className={cn(
                              "px-2.5 py-0.5 rounded-full text-xs font-semibold border self-start sm:self-center",
                              att.estado === 'presente' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              att.estado === 'aviso_ausencia' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              att.estado === 'falto_sin_avisar' ? 'bg-red-50 text-red-700 border-red-200' :
                              att.estado === 'recupera' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              att.estado === 'vino_otra_clase' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                              att.estado === 'cancelado' ? 'bg-stone-100 text-stone-400 border-stone-200' :
                              'bg-stone-50 text-stone-400 border-stone-200'
                            )}>
                              {att.estado}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: Alertas Clínicas */}
              {activeTab === 'alertas' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider border-b border-stone-200 pb-2">Sistema de Monitoreo de Alertas</h3>
                  
                  {alertsCount === 0 ? (
                    <div className="bg-white border border-stone-200 rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-sm">
                      <CheckCircle className="w-12 h-12 text-emerald-500 mb-3" />
                      <h4 className="font-semibold text-stone-900">Paciente sin alertas clínicas</h4>
                      <p className="text-sm text-stone-500 mt-1 max-w-sm">
                        No se detectaron inasistencias reiteradas ni palabras de alarma en las observaciones clínicas recientes.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {hasThreeConsecutiveAbsences && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 flex gap-3.5 shadow-sm">
                          <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5 text-amber-600" />
                          <div>
                            <h4 className="font-bold text-sm">Alerta: Inasistencia Recurrente (TPA)</h4>
                            <p className="text-xs text-amber-700 mt-1 leading-relaxed font-medium">
                              El alumno ha registrado <strong className="font-semibold">3 ausencias sin previo aviso de forma consecutiva</strong> en las clases de TPA. Se recomienda contactar para corroborar su estado.
                            </p>
                          </div>
                        </div>
                      )}

                      {hasAlertPresion && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 flex gap-3.5 shadow-sm">
                          <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5 text-amber-600" />
                          <div>
                            <h4 className="font-bold text-sm">Alerta: Monitoreo Cardiovascular</h4>
                            <p className="text-xs text-amber-700 mt-1 leading-relaxed font-medium">
                              Se ha detectado el término <strong className="font-semibold">"presión"</strong> en las observaciones clínicas de sus sesiones más recientes. Por favor, verificar y controlar la presión arterial del paciente antes de realizar la actividad física.
                            </p>
                          </div>
                        </div>
                      )}

                      {hasAlertLesionDolor && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 flex gap-3.5 shadow-sm">
                          <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5 text-amber-600" />
                          <div>
                            <h4 className="font-bold text-sm">Alerta: Reporte de Lesión / Dolor Agudo</h4>
                            <p className="text-xs text-amber-700 mt-1 leading-relaxed font-medium">
                              Se registraron palabras clave de alarma como <strong className="font-semibold">"lesión"</strong> o <strong className="font-semibold">"dolor"</strong> en las evoluciones más recientes. Ajustar las posturas de RPG o ejercicios de TPA para evitar exacerbación de síntomas.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-white border border-stone-200 rounded-xl p-4 flex gap-3 text-xs text-stone-500 leading-relaxed shadow-sm">
                    <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    <p>
                      El sistema escanea de manera automática las notas de las sesiones RPG y asistencias de TPA para disparar banderas preventivas de seguridad clínica de acuerdo con la convención establecida.
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
