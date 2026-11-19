"use client";

import { useState } from 'react';
import { FileText, Save, Trash2, User } from 'lucide-react';
import { createPaciente, updatePaciente } from '@/lib/queries';
import { mensajeErrorAlGuardar, registrarError } from '@/lib/errores';
import { nuevoId } from '@/lib/utils';
import { edadEn, fechaNacimientoValida } from '@/lib/pacientes';
import { hoyArgentina } from '@/lib/pagos';
import { useToast } from '@/components/ui/ToastProvider';
import { Modal, BOTON_PIE_PRIMARIO, BOTON_PIE_SECUNDARIO } from '@/components/ui/Modal';
import type { Paciente } from '@/types';
import { CampoActividades } from './CampoActividades';
import { CampoTextoPaciente } from './CampoTextoPaciente';
import {
  CLASE_CAMPO, CLASE_LABEL, DATOS_CLINICOS, DATOS_PERSONALES, datosAGuardar, formularioInicial,
  type CampoTexto, type DefCampo, type Formulario,
} from './formularioPaciente';

interface PacienteFormModalProps {
  /** null = paciente nuevo. */
  paciente: Paciente | null;
  onCerrar: () => void;
  onGuardado: () => void;
  onEliminar: (paciente: Paciente) => void;
}

const CLASE_SECCION = 'text-xs font-semibold text-stone-400 uppercase tracking-wider border-b border-stone-100 pb-2 flex items-center gap-2';

// Alta y edición de la ficha. En celular, pantalla completa con Guardar fijo abajo.
// Se monta al abrir, así que el formulario arranca con los datos del paciente.
export function PacienteFormModal({ paciente, onCerrar, onGuardado, onEliminar }: PacienteFormModalProps) {
  const toast = useToast();
  const [form, setForm] = useState<Formulario>(() => formularioInicial(paciente));
  const [guardando, setGuardando] = useState(false);
  // Id del paciente nuevo, fijo mientras el formulario está abierto: guardar de nuevo no lo duplica.
  const [idNuevo] = useState(nuevoId);
  const [hoy] = useState(() => hoyArgentina(new Date()));

  const cambiar = (campo: CampoTexto | 'edad' | 'fecha_nacimiento', valor: string) => setForm((prev) => ({ ...prev, [campo]: valor }));

  // Con una fecha válida, la edad se calcula sola y no se escribe a mano.
  const edadCalculada = form.fecha_nacimiento && fechaNacimientoValida(form.fecha_nacimiento, hoy)
    ? edadEn(form.fecha_nacimiento, hoy)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      toast.aviso('El nombre es obligatorio.');
      return;
    }

    if (form.actividades.length === 0) {
      toast.aviso('Elegí al menos una actividad.');
      return;
    }
    if (form.fecha_nacimiento && !fechaNacimientoValida(form.fecha_nacimiento, hoy)) {
      toast.aviso('Revisá la fecha de nacimiento: no puede ser futura ni anterior a 1900.');
      return;
    }

    const payload = datosAGuardar(form, edadCalculada);

    setGuardando(true);
    try {
      // Editar no toca `activo` (N6): un dado de baja sigue de baja. Se reactiva desde su ficha.
      if (paciente) await updatePaciente(paciente.id, payload);
      else await createPaciente({ ...payload, id: idNuevo, activo: true });
      toast.exito(paciente ? 'Ficha guardada' : 'Paciente creado');
      onGuardado();
    } catch (error: unknown) {
      registrarError('Error guardando paciente', error);
      toast.error(mensajeErrorAlGuardar('No se pudo guardar el paciente.', error));
      setGuardando(false);
    }
  };

  const renderCampo = (def: DefCampo) => (
    <CampoTextoPaciente key={def.campo} def={def} valor={form[def.campo]} onCambiar={(v) => cambiar(def.campo, v)} />
  );

  const pie = (
    <>
      {paciente && (
        <button type="button" onClick={() => onEliminar(paciente)} aria-label="Eliminar paciente"
          className="md:mr-auto h-11 w-11 md:w-auto md:px-4 shrink-0 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-lg border border-red-200 transition-colors duration-150">
          <Trash2 size={16} />
          <span className="hidden md:inline">Eliminar paciente</span>
        </button>
      )}
      <button type="button" onClick={onCerrar} className={BOTON_PIE_SECUNDARIO}>Cancelar</button>
      <button type="submit" form="form-paciente" disabled={guardando} className={BOTON_PIE_PRIMARIO}>
        <Save size={16} /> Guardar
      </button>
    </>
  );

  return (
    <Modal
      titulo={paciente ? 'Editar ficha' : 'Nuevo paciente'}
      subtitulo="Datos personales y antecedentes clínicos"
      onCerrar={onCerrar}
      pie={pie}
      ancho="2xl"
      pantallaCompleta
    >
      <form id="form-paciente" onSubmit={handleSubmit} className="p-4 md:p-6 space-y-6">
        <section className="space-y-4">
          <h3 className={CLASE_SECCION}><User size={16} className="text-teal-600" /> Información personal</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="paciente-nombre" className={CLASE_LABEL}>Nombre completo *</label>
              <input id="paciente-nombre" type="text" required autoComplete="off" value={form.nombre}
                placeholder="Ej: Juan Pérez" onChange={(e) => cambiar('nombre', e.target.value)} className={CLASE_CAMPO} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="paciente-nacimiento" className={CLASE_LABEL}>Fecha de nacimiento</label>
              <input id="paciente-nacimiento" type="date" min="1900-01-01" max={hoy} value={form.fecha_nacimiento}
                onChange={(e) => cambiar('fecha_nacimiento', e.target.value)} className={CLASE_CAMPO} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="paciente-edad" className={CLASE_LABEL}>Edad</label>
              <input id="paciente-edad" type="number" inputMode="numeric" min={0} value={edadCalculada ?? form.edad}
                disabled={edadCalculada !== null} aria-describedby={edadCalculada !== null ? 'paciente-edad-ayuda' : undefined}
                placeholder="Ej: 32" onChange={(e) => cambiar('edad', e.target.value)}
                className={`${CLASE_CAMPO} disabled:bg-stone-50 disabled:text-stone-600`} />
              {edadCalculada !== null && <p id="paciente-edad-ayuda" className="text-xs text-stone-500">Se calcula con la fecha.</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {DATOS_PERSONALES.map(renderCampo)}
            <CampoActividades valor={form.actividades} onCambiar={(actividades) => setForm((prev) => ({ ...prev, actividades }))} />
          </div>
        </section>

        <section className="space-y-4">
          <h3 className={CLASE_SECCION}><FileText size={16} className="text-teal-600" /> Historia clínica</h3>
          {DATOS_CLINICOS.map(renderCampo)}
        </section>
      </form>
    </Modal>
  );
}
