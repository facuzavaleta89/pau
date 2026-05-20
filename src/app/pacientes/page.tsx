"use client";

import { useState, useEffect } from 'react';
import { Search, UserPlus, FileText, Phone, Award, Edit2, X, Save, User } from 'lucide-react';
import { getPacientesActivos, createPaciente, updatePaciente } from '@/lib/queries';
import type { Paciente, TipoClase } from '@/types';
import { HistoriaClinicaModal } from '@/components/pacientes/HistoriaClinicaModal';
import { cn } from '@/components/layout/Navigation';

export default function PacientesPage() {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedPacienteId, setSelectedPacienteId] = useState<string | null>(null);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingPaciente, setEditingPaciente] = useState<Paciente | null>(null);

  // Form states
  const [nombre, setNombre] = useState('');
  const [edad, setEdad] = useState<number | ''>('');
  const [telefono, setTelefono] = useState('');
  const [telefonoEmergencia, setTelefonoEmergencia] = useState('');
  const [direccion, setDireccion] = useState('');
  const [profesion, setProfesion] = useState('');
  const [actividadFisica, setActividadFisica] = useState('');
  const [antecedentesClinicos, setAntecedentesClinicos] = useState('');
  const [estudiosImagenologicos, setEstudiosImagenologicos] = useState('');
  const [motivoConsulta, setMotivoConsulta] = useState('');
  const [evaluacionInicial, setEvaluacionInicial] = useState('');
  const [objetivoTratamiento, setObjetivoTratamiento] = useState('');
  const [tipoClase, setTipoClase] = useState<TipoClase>('RPG');

  const fetchPacientes = async () => {
    setLoading(true);
    try {
      const data = await getPacientesActivos();
      setPacientes(data);
    } catch (error) {
      console.error("Error fetching pacientes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPacientes();
  }, []);

  const handleOpenNew = () => {
    setEditingPaciente(null);
    setNombre('');
    setEdad('');
    setTelefono('');
    setTelefonoEmergencia('');
    setDireccion('');
    setProfesion('');
    setActividadFisica('');
    setAntecedentesClinicos('');
    setEstudiosImagenologicos('');
    setMotivoConsulta('');
    setEvaluacionInicial('');
    setObjetivoTratamiento('');
    setTipoClase('RPG');
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (paciente: Paciente) => {
    setEditingPaciente(paciente);
    setNombre(paciente.nombre || '');
    setEdad(paciente.edad || '');
    setTelefono(paciente.telefono || '');
    setTelefonoEmergencia(paciente.telefono_emergencia || '');
    setDireccion(paciente.direccion || '');
    setProfesion(paciente.profesion || '');
    setActividadFisica(paciente.actividad_fisica || '');
    setAntecedentesClinicos(paciente.antecedentes_clinicos || '');
    setEstudiosImagenologicos(paciente.estudios_imagenologicos || '');
    setMotivoConsulta(paciente.motivo_consulta || '');
    setEvaluacionInicial(paciente.evaluacion_inicial || '');
    setObjetivoTratamiento(paciente.objetivo_tratamiento || '');
    setTipoClase(paciente.tipo_clase || 'RPG');
    setIsFormModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre) return alert("El nombre es obligatorio");

    const payload: Partial<Paciente> = {
      nombre,
      edad: edad === '' ? null : Number(edad),
      telefono: telefono || null,
      telefono_emergencia: telefonoEmergencia || null,
      direccion: direccion || null,
      profesion: profesion || null,
      actividad_fisica: actividadFisica || null,
      antecedentes_clinicos: antecedentesClinicos || null,
      estudios_imagenologicos: estudiosImagenologicos || null,
      motivo_consulta: motivoConsulta || null,
      evaluacion_inicial: evaluacionInicial || null,
      objetivo_tratamiento: objetivoTratamiento || null,
      tipo_clase: tipoClase,
      activo: true
    };

    try {
      if (editingPaciente) {
        await updatePaciente(editingPaciente.id, payload);
      } else {
        await createPaciente(payload);
      }
      setIsFormModalOpen(false);
      fetchPacientes();
    } catch (error: any) {
      console.error("Error saving paciente:", error);
      alert(`Hubo un error al guardar los datos del paciente: ${error.message || error.details || JSON.stringify(error)}`);
    }
  };

  const filteredPacientes = pacientes.filter(p => 
    p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.antecedentes_clinicos && p.antecedentes_clinicos.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full space-y-8 animate-in fade-in duration-500">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Pacientes</h1>
          <p className="text-stone-600 mt-1 text-sm">Gestiona la base de datos de alumnos e historias clínicas</p>
        </div>
        <button
          onClick={handleOpenNew}
          className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 self-start sm:self-auto shadow-sm cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Nuevo Paciente</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative w-full max-w-md group">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 group-focus-within:text-teal-600 transition-colors" />
        <input
          type="text"
          placeholder="Buscar por nombre o antecedentes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none placeholder:text-stone-400 text-stone-900 shadow-sm"
        />
      </div>

      {/* List of Patients */}
      {loading ? (
        <div className="flex-1 flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden animate-in fade-in duration-200">
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
                {filteredPacientes.map((paciente) => (
                  <tr 
                    key={paciente.id}
                    onClick={() => {
                      setSelectedPacienteId(paciente.id);
                      setIsHistoryModalOpen(true);
                    }}
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
                          <div className="text-[10px] text-stone-400 truncate max-w-[150px]">{paciente.direccion}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {paciente.tipo_clase ? (
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider shadow-sm",
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
                          onClick={() => {
                            setSelectedPacienteId(paciente.id);
                            setIsHistoryModalOpen(true);
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-teal-600 bg-teal-50 border border-teal-100 rounded-lg hover:bg-teal-100/50 hover:text-teal-700 transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Historia Clínica</span>
                        </button>
                        <button
                          onClick={() => handleOpenEdit(paciente)}
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
          
          {filteredPacientes.length === 0 && (
            <div className="text-center py-16 text-stone-400 bg-stone-50 rounded-b-xl border-t border-stone-200">
              No se encontraron pacientes activos.
            </div>
          )}
        </div>
      )}

      {/* History Modal */}
      <HistoriaClinicaModal 
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        pacienteId={selectedPacienteId}
      />

      {/* New/Edit Patient Modal Form */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-stone-200 w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="px-6 py-5 border-b border-stone-200 flex items-start justify-between bg-white">
              <div>
                <h3 className="text-xl font-bold text-stone-900 capitalize tracking-tight">
                  {editingPaciente ? 'Editar Ficha Médica' : 'Registrar Nuevo Paciente'}
                </h3>
                <p className="text-sm font-medium text-stone-600 mt-1">Completa los datos demográficos y antecedentes clínicos</p>
              </div>
              <button 
                onClick={() => setIsFormModalOpen(false)}
                className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6 text-sm text-stone-700 bg-white">
              
              {/* Sección 1: Datos Personales */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider border-b border-stone-100 pb-2 flex items-center gap-2">
                  <User className="w-4 h-4 text-teal-600" /> Información Personal
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-stone-600">Nombre Completo *</label>
                    <input 
                      type="text"
                      required
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Ej: Juan Pérez"
                      className="w-full p-2.5 bg-white border border-stone-200 rounded-lg text-stone-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-colors placeholder:text-stone-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-600">Edad</label>
                    <input 
                      type="number"
                      value={edad}
                      onChange={(e) => setEdad(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Ej: 32"
                      className="w-full p-2.5 bg-white border border-stone-200 rounded-lg text-stone-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-colors placeholder:text-stone-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-600">Teléfono</label>
                    <input 
                      type="text"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="Ej: 11223344"
                      className="w-full p-2.5 bg-white border border-stone-200 rounded-lg text-stone-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-colors placeholder:text-stone-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-600">Contacto de Emergencia</label>
                    <input 
                      type="text"
                      value={telefonoEmergencia}
                      onChange={(e) => setTelefonoEmergencia(e.target.value)}
                      placeholder="Nombre y teléfono"
                      className="w-full p-2.5 bg-white border border-stone-200 rounded-lg text-stone-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-colors placeholder:text-stone-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-stone-600">Dirección</label>
                    <input 
                      type="text"
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value)}
                      placeholder="Ej: Av. Rivadavia 1234"
                      className="w-full p-2.5 bg-white border border-stone-200 rounded-lg text-stone-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-colors placeholder:text-stone-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-600">Clase Asignada</label>
                    <select
                      value={tipoClase}
                      onChange={(e) => setTipoClase(e.target.value as TipoClase)}
                      className="w-full p-2.5 bg-white border border-stone-200 rounded-lg text-stone-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-colors"
                    >
                      <option value="RPG">RPG (Individual)</option>
                      <option value="TPA">TPA (Clases)</option>
                      <option value="ambos">Ambos</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-600">Profesión</label>
                    <input 
                      type="text"
                      value={profesion}
                      onChange={(e) => setProfesion(e.target.value)}
                      placeholder="Ej: Administrativo"
                      className="w-full p-2.5 bg-white border border-stone-200 rounded-lg text-stone-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-colors placeholder:text-stone-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-600">Actividad Física</label>
                    <input 
                      type="text"
                      value={actividadFisica}
                      onChange={(e) => setActividadFisica(e.target.value)}
                      placeholder="Ej: Gimnasio 2 veces/sem"
                      className="w-full p-2.5 bg-white border border-stone-200 rounded-lg text-stone-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-colors placeholder:text-stone-400"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Ficha Médica */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider border-b border-stone-100 pb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-600" /> Antecedentes y Estado Clínico
                </h4>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-600">Motivo de Consulta</label>
                  <textarea 
                    rows={2}
                    value={motivoConsulta}
                    onChange={(e) => setMotivoConsulta(e.target.value)}
                    placeholder="Dolor lumbar, cervicalgia, etc..."
                    className="w-full p-2.5 bg-white border border-stone-200 rounded-lg text-stone-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-colors resize-none placeholder:text-stone-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-600">Antecedentes Clínicos</label>
                    <textarea 
                      rows={3}
                      value={antecedentesClinicos}
                      onChange={(e) => setAntecedentesClinicos(e.target.value)}
                      placeholder="Cirugías, fracturas, diabetes, hipertensión..."
                      className="w-full p-2.5 bg-white border border-stone-200 rounded-lg text-stone-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-colors resize-none placeholder:text-stone-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-600">Estudios Imagenológicos</label>
                    <textarea 
                      rows={3}
                      value={estudiosImagenologicos}
                      onChange={(e) => setEstudiosImagenologicos(e.target.value)}
                      placeholder="RX cervical (hernia C5-C6), RMN, etc..."
                      className="w-full p-2.5 bg-white border border-stone-200 rounded-lg text-stone-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-colors resize-none placeholder:text-stone-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-600">Evaluación Inicial</label>
                    <textarea 
                      rows={2}
                      value={evaluacionInicial}
                      onChange={(e) => setEvaluacionInicial(e.target.value)}
                      placeholder="Limitación de rotación, dolor a la flexión..."
                      className="w-full p-2.5 bg-white border border-stone-200 rounded-lg text-stone-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-colors resize-none placeholder:text-stone-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-600">Objetivo del Tratamiento</label>
                    <textarea 
                      rows={2}
                      value={objetivoTratamiento}
                      onChange={(e) => setObjetivoTratamiento(e.target.value)}
                      placeholder="Reducir dolor, mejorar postura, elongar cadena posterior..."
                      className="w-full p-2.5 bg-white border border-stone-200 rounded-lg text-stone-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-colors resize-none placeholder:text-stone-400"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-5 border-t border-stone-200 bg-stone-50/50 flex justify-end gap-3 -mx-6 -mb-6 mt-4">
                <button 
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-100 border border-stone-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors shadow-sm cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Guardar Ficha
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
