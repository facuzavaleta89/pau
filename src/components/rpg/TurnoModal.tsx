"use client";

import { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Clock, Save, User, CheckCircle2, AlertCircle } from 'lucide-react';
import type { SesionRPG, Paciente, EstadoPago, EstadoSesionRPG } from '@/types';
import { getPacientesActivos, createSesionRPG, updateSesionRPG } from '@/lib/queries';
import { format } from 'date-fns';
import { cn } from '@/components/layout/Navigation';

interface TurnoModalProps {
  isOpen: boolean;
  onClose: () => void;
  turno?: SesionRPG | null;
  selectedDate?: Date;
  onSave?: () => void;
}

export function TurnoModal({ isOpen, onClose, turno, selectedDate, onSave }: TurnoModalProps) {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [pacienteId, setPacienteId] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [tipoSesion, setTipoSesion] = useState('RPG');
  const [estadoPago, setEstadoPago] = useState<EstadoPago>('pendiente');
  const [estadoSesion, setEstadoSesion] = useState<EstadoSesionRPG>('pendiente');
  const [nota, setNota] = useState('');

  useEffect(() => {
    if (isOpen) {
      const loadPacientes = async () => {
        setLoading(true);
        try {
          const data = await getPacientesActivos();
          setPacientes(data);
        } catch (error) {
          console.error("Error cargando pacientes:", error);
        } finally {
          setLoading(false);
        }
      };
      loadPacientes();

      if (turno) {
        setPacienteId(turno.paciente_id);
        setFecha(turno.fecha);
        setHora(turno.hora);
        setTipoSesion(turno.tipo_sesion || 'RPG');
        setEstadoPago(turno.estado_pago);
        setEstadoSesion(turno.estado_sesion);
        setNota(turno.nota || '');
      } else {
        setPacienteId('');
        setFecha(selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
        setHora('09:00');
        setTipoSesion('RPG');
        setEstadoPago('pendiente');
        setEstadoSesion('pendiente');
        setNota('');
      }
    }
  }, [isOpen, turno, selectedDate]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pacienteId) return alert("Selecciona un paciente");

    setSaving(true);
    try {
      const payload = {
        paciente_id: pacienteId,
        fecha,
        hora,
        tipo_sesion: tipoSesion,
        estado_pago: estadoPago,
        estado_sesion: estadoSesion,
        nota
      };

      if (turno?.id) {
        await updateSesionRPG(turno.id, payload);
      } else {
        await createSesionRPG(payload as Partial<SesionRPG>);
      }
      
      if (onSave) onSave();
      onClose();
    } catch (error) {
      console.error("Error guardando turno:", error);
      alert("Error al guardar el turno");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-800 flex items-start justify-between bg-zinc-900">
          <div>
            <h3 className="text-xl font-bold text-white capitalize tracking-tight">
              {turno ? 'Editar Turno RPG' : 'Nuevo Turno RPG'}
            </h3>
            <p className="text-sm font-medium text-zinc-400 mt-1">Completa los detalles de la sesión</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form id="turno-form" onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5">
          
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-zinc-400 flex items-center gap-1.5">
              <User className="w-4 h-4" /> Paciente
            </label>
            <select 
              required
              value={pacienteId}
              onChange={(e) => setPacienteId(e.target.value)}
              className="w-full p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500 outline-none transition-colors"
            >
              <option value="">Seleccionar paciente...</option>
              {pacientes.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-zinc-400 flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4" /> Fecha
              </label>
              <input 
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500 outline-none transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-zinc-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Hora
              </label>
              <input 
                type="time"
                required
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="w-full p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500 outline-none transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-zinc-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Estado Sesión
              </label>
              <select 
                value={estadoSesion}
                onChange={(e) => setEstadoSesion(e.target.value as EstadoSesionRPG)}
                className="w-full p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500 outline-none transition-colors"
              >
                <option value="pendiente">Pendiente</option>
                <option value="realizada">Realizada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-zinc-400 flex items-center gap-1.5">
                Pago
              </label>
              <select 
                value={estadoPago}
                onChange={(e) => setEstadoPago(e.target.value as EstadoPago)}
                className="w-full p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500 outline-none transition-colors"
              >
                <option value="pendiente">Pendiente</option>
                <option value="pagado">Pagado</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-zinc-400 flex items-center gap-1.5">
              Nota (Opcional)
            </label>
            <textarea 
              rows={3}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Alguna observación sobre el turno..."
              className="w-full p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500 outline-none transition-colors resize-none"
            />
          </div>

        </form>

        {/* Footer */}
        <div className="p-5 border-t border-zinc-800 bg-zinc-900 flex justify-end gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button 
            type="submit"
            form="turno-form"
            disabled={saving || loading}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
