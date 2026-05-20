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
    } catch (error) {
      console.error("Error saving paciente:", error);
      alert("Hubo un error al guardar los datos del paciente.");
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
          <h1 className="text-2xl font-semibold text-white">Pacientes</h1>
          <p className="text-zinc-400 mt-1 text-sm">Gestiona la base de datos de alumnos e historias clínicas</p>
        </div>
        <button
          onClick={handleOpenNew}
          className="bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Nuevo Paciente</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative w-full max-w-md group">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-violet-400 transition-colors" />
        <input
          type="text"
          placeholder="Buscar por nombre o antecedentes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-colors outline-none placeholder:text-zinc-500 text-white"
        />
      </div>

      {/* Grid of Patients */}
      {loading ? (
        <div className="flex-1 flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPacientes.map((paciente) => (
            <div 
              key={paciente.id}
              onClick={() => {
                setSelectedPacienteId(paciente.id);
                setIsHistoryModalOpen(true);
              }}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors duration-150 cursor-pointer flex flex-col justify-between group h-48"
            >
              <div>
                <div className="flex justify-between items-start">
                  <h3 className="text-base font-semibold text-white group-hover:text-violet-400 transition-colors leading-tight">
                    {paciente.nombre}
                  </h3>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit(paciente);
                      }}
                      className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-md transition-colors"
                      title="Editar ficha"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-2.5 text-xs">
                  {paciente.telefono && (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Phone className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span>{paciente.telefono}</span>
                    </div>
                  )}
                  {paciente.tipo_clase && (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Award className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span className="uppercase font-semibold text-violet-400 bg-violet-600/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                        {paciente.tipo_clase}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-zinc-800/80 pt-3 mt-3 flex justify-between items-center text-xs text-zinc-500">
                <span>{paciente.edad ? `${paciente.edad} años` : 'Edad no registrada'}</span>
                <span className="flex items-center gap-1 text-violet-400 font-semibold group-hover:underline">
                  <FileText className="w-3.5 h-3.5" /> Ver Historia Clínica
                </span>
              </div>
            </div>
          ))}

          {filteredPacientes.length === 0 && (
            <div className="col-span-full py-16 text-center text-zinc-500 bg-zinc-900/40 rounded-xl border border-dashed border-zinc-800">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="px-6 py-5 border-b border-zinc-800 flex items-start justify-between bg-zinc-900">
              <div>
                <h3 className="text-xl font-bold text-white capitalize tracking-tight">
                  {editingPaciente ? 'Editar Ficha Médica' : 'Registrar Nuevo Paciente'}
                </h3>
                <p className="text-sm font-medium text-zinc-400 mt-1">Completa los datos demográficos y antecedentes clínicos</p>
              </div>
              <button 
                onClick={() => setIsFormModalOpen(false)}
                className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6 text-sm text-zinc-300">
              
              {/* Sección 1: Datos Personales */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-800 pb-2 flex items-center gap-2">
                  <User className="w-4 h-4 text-violet-400" /> Información Personal
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Nombre Completo *</label>
                    <input 
                      type="text"
                      required
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Ej: Juan Pérez"
                      className="w-full p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 outline-none transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Edad</label>
                    <input 
                      type="number"
                      value={edad}
                      onChange={(e) => setEdad(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Ej: 32"
                      className="w-full p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Teléfono</label>
                    <input 
                      type="text"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="Ej: 11223344"
                      className="w-full p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 outline-none transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Contacto de Emergencia</label>
                    <input 
                      type="text"
                      value={telefonoEmergencia}
                      onChange={(e) => setTelefonoEmergencia(e.target.value)}
                      placeholder="Nombre y teléfono"
                      className="w-full p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Dirección</label>
                    <input 
                      type="text"
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value)}
                      placeholder="Ej: Av. Rivadavia 1234"
                      className="w-full p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 outline-none transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Clase Asignada</label>
                    <select
                      value={tipoClase}
                      onChange={(e) => setTipoClase(e.target.value as TipoClase)}
                      className="w-full p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 outline-none transition-colors"
                    >
                      <option value="RPG">RPG (Individual)</option>
                      <option value="TPA">TPA (Clases)</option>
                      <option value="ambos">Ambos</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Profesión</label>
                    <input 
                      type="text"
                      value={profesion}
                      onChange={(e) => setProfesion(e.target.value)}
                      placeholder="Ej: Administrativo"
                      className="w-full p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 outline-none transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Actividad Física</label>
                    <input 
                      type="text"
                      value={actividadFisica}
                      onChange={(e) => setActividadFisica(e.target.value)}
                      placeholder="Ej: Gimnasio 2 veces/sem"
                      className="w-full p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Ficha Médica */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-800 pb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-violet-400" /> Antecedentes y Estado Clínico
                </h4>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Motivo de Consulta</label>
                  <textarea 
                    rows={2}
                    value={motivoConsulta}
                    onChange={(e) => setMotivoConsulta(e.target.value)}
                    placeholder="Dolor lumbar, cervicalgia, etc..."
                    className="w-full p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 outline-none transition-colors resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Antecedentes Clínicos</label>
                    <textarea 
                      rows={3}
                      value={antecedentesClinicos}
                      onChange={(e) => setAntecedentesClinicos(e.target.value)}
                      placeholder="Cirugías, fracturas, diabetes, hipertensión..."
                      className="w-full p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 outline-none transition-colors resize-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Estudios Imagenológicos</label>
                    <textarea 
                      rows={3}
                      value={estudiosImagenologicos}
                      onChange={(e) => setEstudiosImagenologicos(e.target.value)}
                      placeholder="RX cervical (hernia C5-C6), RMN, etc..."
                      className="w-full p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 outline-none transition-colors resize-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Evaluación Inicial</label>
                    <textarea 
                      rows={2}
                      value={evaluacionInicial}
                      onChange={(e) => setEvaluacionInicial(e.target.value)}
                      placeholder="Limitación de rotación, dolor a la flexión..."
                      className="w-full p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 outline-none transition-colors resize-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Objetivo del Tratamiento</label>
                    <textarea 
                      rows={2}
                      value={objetivoTratamiento}
                      onChange={(e) => setObjetivoTratamiento(e.target.value)}
                      placeholder="Reducir dolor, mejorar postura, elongar cadena posterior..."
                      className="w-full p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 outline-none transition-colors resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-5 border-t border-zinc-800 bg-zinc-900 flex justify-end gap-3 -mx-6 -mb-6 mt-4">
                <button 
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors"
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
