"use client";

import { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Clock, Save, User, CheckCircle2 } from 'lucide-react';
import type { SesionRPG, Paciente, EstadoPago, EstadoSesionRPG } from '@/types';
import { getPacientesActivos, createSesionRPG, updateSesionRPG } from '@/lib/queries';
import { mensajeError, registrarError } from '@/lib/errores';
import { useToast } from '@/components/ui/ToastProvider';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { normalizarHora } from '@/lib/horas';
import { ESTADOS_PAGO, ESTADOS_SESION_RPG, ORDEN_ESTADOS_PAGO, ORDEN_ESTADOS_SESION_RPG } from '@/lib/estados';

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
  const toast = useToast();

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
          registrarError("Error cargando pacientes", error);
          toast.error(`No se pudo cargar la lista de pacientes. ${mensajeError(error)}`);
        } finally {
          setLoading(false);
        }
      };
      loadPacientes();

      if (turno) {
        setPacienteId(turno.paciente_id);
        setFecha(turno.fecha);
        setHora(normalizarHora(turno.hora));
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
  }, [isOpen, turno, selectedDate, toast]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pacienteId) {
      toast.aviso("Elegí un paciente.");
      return;
    }

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
      
      toast.exito(turno?.id ? 'Turno guardado' : 'Turno creado');
      if (onSave) onSave();
      onClose();
    } catch (error: unknown) {
      registrarError("Error guardando turno", error);
      toast.error(`No se pudo guardar el turno. ${mensajeError(error)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-stone-200 w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-200 flex items-start justify-between bg-white">
          <div>
            <h3 className="text-xl font-bold text-stone-900 capitalize tracking-tight">
              {turno ? 'Editar Turno RPG' : 'Nuevo Turno RPG'}
            </h3>
            <p className="text-sm font-medium text-stone-600 mt-1">Completa los detalles de la sesión</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form id="turno-form" onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5">
          
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-stone-600 flex items-center gap-1.5">
              <User className="w-4 h-4 text-stone-400" /> Paciente
            </label>
            <select 
              required
              value={pacienteId}
              onChange={(e) => setPacienteId(e.target.value)}
              className="w-full p-2.5 bg-white border border-stone-200 rounded-lg text-stone-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-colors"
            >
              <option value="">Seleccionar paciente...</option>
              {pacientes.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-stone-600 flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-stone-400" /> Fecha
              </label>
              <input 
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full p-2.5 bg-white border border-stone-200 rounded-lg text-stone-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-stone-600 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-stone-400" /> Hora
              </label>
              <input 
                type="time"
                required
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="w-full p-2.5 bg-white border border-stone-200 rounded-lg text-stone-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-stone-600 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-stone-400" /> Estado Sesión
              </label>
              <select 
                value={estadoSesion}
                onChange={(e) => setEstadoSesion(e.target.value as EstadoSesionRPG)}
                className="w-full p-2.5 bg-white border border-stone-200 rounded-lg text-stone-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-colors"
              >
                {ORDEN_ESTADOS_SESION_RPG.map(valor => (
                  <option key={valor} value={valor}>{ESTADOS_SESION_RPG[valor].label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-stone-600 flex items-center gap-1.5">
                Pago
              </label>
              <select 
                value={estadoPago}
                onChange={(e) => setEstadoPago(e.target.value as EstadoPago)}
                className="w-full p-2.5 bg-white border border-stone-200 rounded-lg text-stone-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-colors"
              >
                {ORDEN_ESTADOS_PAGO.map(valor => (
                  <option key={valor} value={valor}>{ESTADOS_PAGO[valor].label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-stone-600 flex items-center gap-1.5">
              Nota (Opcional)
            </label>
            <textarea 
              rows={3}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Alguna observación sobre el turno..."
              className="w-full p-2.5 bg-white border border-stone-200 rounded-lg text-stone-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-colors resize-none placeholder:text-stone-400"
            />
          </div>

        </form>

        {/* Footer */}
        <div className="p-5 border-t border-stone-200 bg-white flex justify-end gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 bg-white border border-stone-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button 
            type="submit"
            form="turno-form"
            disabled={saving || loading}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none shadow-sm"
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
