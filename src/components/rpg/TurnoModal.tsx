"use client";

import { useCallback, useState } from 'react';
import { Calendar as CalendarIcon, Clock, Save, User, CheckCircle2 } from 'lucide-react';
import { Modal, BOTON_PIE_PRIMARIO, BOTON_PIE_SECUNDARIO } from '@/components/ui/Modal';
import type { SesionRPG, EstadoPago, EstadoSesionRPG, MedioPago } from '@/types';
import { getPacientesActivos, createSesionRPG, updateSesionRPG } from '@/lib/queries';
import { mensajeErrorAlGuardar, registrarError } from '@/lib/errores';
import { useToast } from '@/components/ui/ToastProvider';
import { useDatos } from '@/hooks/useDatos';
import { format } from 'date-fns';
import { cn, nuevoId } from '@/lib/utils';
import { normalizarHora } from '@/lib/horas';
import { hoyArgentina, MEDIOS_PAGO, ORDEN_MEDIOS_PAGO } from '@/lib/pagos';
import { ESTADOS_PAGO, ESTADOS_SESION_RPG, ORDEN_ESTADOS_PAGO, ORDEN_ESTADOS_SESION_RPG } from '@/lib/estados';

interface TurnoModalProps {
  onClose: () => void;
  turno?: SesionRPG | null;
  selectedDate?: Date;
  onSave?: () => void;
}

// Se monta al abrir (AgendaRPG lo renderiza solo si hay un turno abierto):
// el formulario arranca con los datos del turno sin copiarlos en un efecto.
export function TurnoModal({ onClose, turno, selectedDate, onSave }: TurnoModalProps) {
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const cargarPacientes = useCallback(() => getPacientesActivos(), []);
  const { datos: pacientes, cargando: loading } = useDatos('pacientes-activos', cargarPacientes, 'No se pudo cargar la lista de pacientes.');

  // Form State
  const [pacienteId, setPacienteId] = useState(turno?.paciente_id ?? '');
  const [fecha, setFecha] = useState(() => turno?.fecha ?? format(selectedDate ?? new Date(), 'yyyy-MM-dd'));
  const [hora, setHora] = useState(turno ? normalizarHora(turno.hora) : '09:00');
  const [tipoSesion] = useState(turno?.tipo_sesion || 'RPG'); // todavía sin campo para cambiarlo (PENDIENTES, RPG)
  const [estadoPago, setEstadoPago] = useState<EstadoPago>(turno?.estado_pago ?? 'pendiente');
  const [estadoSesion, setEstadoSesion] = useState<EstadoSesionRPG>(turno?.estado_sesion ?? 'pendiente');
  const [medioPago, setMedioPago] = useState<MedioPago>(turno?.medio_pago ?? 'transferencia');
  const [nota, setNota] = useState(turno?.nota ?? '');
  // Id del turno nuevo, generado al abrir: guardar de nuevo no lo duplica.
  const [idNuevo] = useState(() => nuevoId());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pacienteId) {
      toast.aviso("Elegí un paciente.");
      return;
    }

    setSaving(true);
    try {
      // Pagada: medio y fecha de pago (la de antes o hoy); el importe lo
      // conserva o, si no tiene, Pagos lo cuenta con el precio del mes. Pendiente:
      // la base limpia importe, fecha y medio sola.
      const pago = estadoPago === 'pagado'
        ? { medio_pago: medioPago, pagado_el: turno?.pagado_el ?? hoyArgentina(new Date()), importe: turno?.importe ?? null }
        : {};
      const payload = {
        paciente_id: pacienteId,
        fecha,
        hora,
        tipo_sesion: tipoSesion,
        estado_pago: estadoPago,
        estado_sesion: estadoSesion,
        nota,
        ...pago,
      };

      if (turno?.id) {
        await updateSesionRPG(turno.id, payload);
      } else {
        await createSesionRPG({ ...payload, id: idNuevo });
      }
      
      toast.exito(turno?.id ? 'Turno guardado' : 'Turno creado');
      if (onSave) onSave();
      onClose();
    } catch (error: unknown) {
      registrarError("Error guardando turno", error);
      toast.error(mensajeErrorAlGuardar('No se pudo guardar el turno.', error));
    } finally {
      setSaving(false);
    }
  };

  const pie = (
    <>
      <button type="button" onClick={onClose} className={BOTON_PIE_SECUNDARIO}>
        Cancelar
      </button>
      <button type="submit" form="turno-form" disabled={saving || loading} className={BOTON_PIE_PRIMARIO}>
        {saving ? (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Save size={16} />
        )}
        Guardar
      </button>
    </>
  );

  return (
    <Modal titulo={turno ? 'Editar turno RPG' : 'Nuevo turno RPG'} onCerrar={onClose} pie={pie} ancho="md">
        <form id="turno-form" onSubmit={handleSubmit} className="p-4 md:p-6 space-y-5 text-base md:text-sm">
          
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
              {(pacientes ?? []).map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
              {/* Turno de alguien dado de baja: no está en la lista de activos, pero el turno es suyo. */}
              {pacientes && turno?.paciente_id && !pacientes.some((p) => p.id === turno.paciente_id) && (
                <option value={turno.paciente_id}>{turno.pacientes?.nombre ?? 'Paciente'} (dado de baja)</option>
              )}
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

          {estadoPago === 'pagado' && (
            <div className="space-y-1.5">
              <span className="text-sm font-semibold text-stone-600">Medio de pago</span>
              <div role="radiogroup" aria-label="Medio de pago" className="grid grid-cols-2 gap-2">
                {ORDEN_MEDIOS_PAGO.map((medio) => (
                  <button key={medio} type="button" role="radio" aria-checked={medioPago === medio} onClick={() => setMedioPago(medio)}
                    className={cn('h-11 rounded-lg border text-sm font-medium transition-colors duration-150',
                      medioPago === medio ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300')}>
                    {MEDIOS_PAGO[medio]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-stone-500">El importe y la fecha se ven y se corrigen en Pagos.</p>
            </div>
          )}

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
    </Modal>
  );
}
