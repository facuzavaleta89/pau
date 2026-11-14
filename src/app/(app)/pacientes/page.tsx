"use client";

import { useCallback, useState } from 'react';
import { Archive, Search, UserPlus, Users } from 'lucide-react';
import { getPacientes } from '@/lib/queries';
import { useDatos } from '@/hooks/useDatos';
import { useToast } from '@/components/ui/ToastProvider';
import { EstadoCarga } from '@/components/ui/EstadoCarga';
import { Pestanias } from '@/components/ui/Pestanias';
import { CopiaDeSeguridad } from '@/components/pacientes/CopiaDeSeguridad';
import { DarDeBajaDialog } from '@/components/pacientes/DarDeBajaDialog';
import { EliminarPacienteDialog } from '@/components/pacientes/EliminarPacienteDialog';
import { HistoriaClinicaModal } from '@/components/pacientes/HistoriaClinicaModal';
import { PacienteFormModal } from '@/components/pacientes/PacienteFormModal';
import { PacientesTabla } from '@/components/pacientes/PacientesTabla';
import { PacientesListaCelular } from '@/components/pacientes/PacientesListaCelular';
import type { Paciente } from '@/types';

type Vista = 'activos' | 'baja';

export default function PacientesPage() {
  const toast = useToast();
  const [busqueda, setBusqueda] = useState('');
  const [vista, setVista] = useState<Vista>('activos');
  const [pacienteHistoria, setPacienteHistoria] = useState<string | null>(null);
  // undefined = formulario cerrado; null = paciente nuevo.
  const [enFormulario, setEnFormulario] = useState<Paciente | null | undefined>(undefined);
  const [pacienteAEliminar, setPacienteAEliminar] = useState<Paciente | null>(null);
  const [pacienteABaja, setPacienteABaja] = useState<Paciente | null>(null);

  const cargar = useCallback(() => getPacientes(), []);
  const { datos, cargando, error, recargar } = useDatos('pacientes', cargar, 'No se pudieron cargar los pacientes.');

  const activos = (datos ?? []).filter((p) => p.activo);
  const deBaja = (datos ?? []).filter((p) => !p.activo);
  const texto = busqueda.toLowerCase();
  const filtrados = (vista === 'activos' ? activos : deBaja).filter(p =>
    p.nombre.toLowerCase().includes(texto) ||
    (p.antecedentes_clinicos?.toLowerCase().includes(texto) ?? false)
  );
  const vacio = busqueda
    ? 'Ningún paciente coincide con la búsqueda.'
    : vista === 'activos' ? 'Todavía no hay pacientes cargados.' : 'No hay pacientes dados de baja.';

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Pacientes</h1>
          <p className="text-stone-600 mt-1 text-sm">Fichas e historias clínicas</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <CopiaDeSeguridad />
          <button
            type="button"
            onClick={() => setEnFormulario(null)}
            className="h-11 px-4 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors duration-150 flex items-center justify-center gap-2"
          >
            <UserPlus size={16} /> Nuevo paciente
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <Pestanias<Vista>
          etiqueta="Pacientes"
          activa={vista}
          onCambiar={setVista}
          pestanias={[
            { id: 'activos', label: 'Activos', icono: Users, contador: datos ? activos.length : undefined },
            { id: 'baja', label: 'Dados de baja', corto: 'De baja', icono: Archive, contador: datos ? deBaja.length : undefined },
          ]}
        />
        <div className="relative w-full md:max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            placeholder="Buscar por nombre o antecedentes…"
            aria-label="Buscar paciente"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full h-11 pl-10 pr-4 bg-white border border-stone-200 rounded-lg text-base md:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
      </div>

      {!datos ? (
        <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} />
      ) : filtrados.length === 0 ? (
        <p className="text-center py-12 text-sm text-stone-500 bg-white rounded-xl border border-dashed border-stone-200">{vacio}</p>
      ) : (
        <>
          {vista === 'baja' && (
            <p className="text-sm text-stone-600">No aparecen en las listas para elegir pacientes. Su historia queda; se reactivan desde su ficha.</p>
          )}
          <div className="md:hidden">
            <PacientesListaCelular pacientes={filtrados} onAbrirHistoria={setPacienteHistoria} onEditar={setEnFormulario} />
          </div>
          <div className="hidden md:block bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <PacientesTabla pacientes={filtrados} onAbrirHistoria={setPacienteHistoria} onEditar={setEnFormulario} />
          </div>
        </>
      )}

      <HistoriaClinicaModal
        isOpen={pacienteHistoria !== null}
        onClose={() => setPacienteHistoria(null)}
        pacienteId={pacienteHistoria}
        onCambioPaciente={recargar}
      />

      {enFormulario !== undefined && (
        <PacienteFormModal
          paciente={enFormulario}
          onCerrar={() => setEnFormulario(undefined)}
          onGuardado={() => { setEnFormulario(undefined); recargar(); }}
          onEliminar={setPacienteAEliminar}
        />
      )}

      {pacienteAEliminar && (
        <EliminarPacienteDialog
          key={pacienteAEliminar.id}
          paciente={pacienteAEliminar}
          onCancelar={() => setPacienteAEliminar(null)}
          onEliminado={() => {
            toast.exito('Paciente eliminado');
            setPacienteAEliminar(null);
            setEnFormulario(undefined);
            recargar();
          }}
          onDarDeBaja={() => { setPacienteABaja(pacienteAEliminar); setPacienteAEliminar(null); }}
        />
      )}

      {pacienteABaja && (
        <DarDeBajaDialog
          key={pacienteABaja.id}
          paciente={pacienteABaja}
          onCancelar={() => setPacienteABaja(null)}
          onHecho={() => { setPacienteABaja(null); setEnFormulario(undefined); recargar(); }}
        />
      )}
    </div>
  );
}
