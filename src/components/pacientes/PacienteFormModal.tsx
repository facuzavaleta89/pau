"use client";

import { useState } from 'react';
import { FileText, Save, Trash2, User } from 'lucide-react';
import { createPaciente, updatePaciente } from '@/lib/queries';
import { mensajeErrorAlGuardar, registrarError } from '@/lib/errores';
import { nuevoId } from '@/lib/utils';
import { useToast } from '@/components/ui/ToastProvider';
import { Modal, BOTON_PIE_PRIMARIO, BOTON_PIE_SECUNDARIO } from '@/components/ui/Modal';
import type { Paciente, TipoClase } from '@/types';

interface PacienteFormModalProps {
  /** null = paciente nuevo. */
  paciente: Paciente | null;
  onCerrar: () => void;
  onGuardado: () => void;
  onEliminar: (paciente: Paciente) => void;
}

type CampoTexto =
  | 'nombre' | 'telefono' | 'telefono_emergencia' | 'direccion' | 'profesion' | 'actividad_fisica'
  | 'motivo_consulta' | 'antecedentes_clinicos' | 'estudios_imagenologicos' | 'evaluacion_inicial' | 'objetivo_tratamiento';

type Formulario = Record<CampoTexto, string> & { edad: string; tipo_clase: TipoClase };

interface DefCampo {
  campo: CampoTexto;
  label: string;
  placeholder: string;
  filas?: number; // textarea
  tipo?: 'tel';
}

const DATOS_PERSONALES: DefCampo[] = [
  { campo: 'telefono', label: 'Teléfono', placeholder: 'Ej: 11223344', tipo: 'tel' },
  { campo: 'telefono_emergencia', label: 'Contacto de emergencia', placeholder: 'Nombre y teléfono' },
  { campo: 'direccion', label: 'Dirección', placeholder: 'Ej: Av. Rivadavia 1234' },
  { campo: 'profesion', label: 'Profesión', placeholder: 'Ej: Administrativo' },
  { campo: 'actividad_fisica', label: 'Actividad física', placeholder: 'Ej: Gimnasio 2 veces/sem' },
];

const DATOS_CLINICOS: DefCampo[] = [
  { campo: 'motivo_consulta', label: 'Motivo de consulta', placeholder: 'Dolor lumbar, cervicalgia, etc.', filas: 2 },
  { campo: 'antecedentes_clinicos', label: 'Antecedentes clínicos', placeholder: 'Cirugías, fracturas, diabetes, hipertensión…', filas: 3 },
  { campo: 'estudios_imagenologicos', label: 'Estudios imagenológicos', placeholder: 'RX cervical (hernia C5-C6), RMN, etc.', filas: 3 },
  { campo: 'evaluacion_inicial', label: 'Evaluación inicial', placeholder: 'Limitación de rotación, dolor a la flexión…', filas: 3 },
  { campo: 'objetivo_tratamiento', label: 'Objetivo del tratamiento', placeholder: 'Reducir dolor, mejorar postura…', filas: 2 },
];

const CLASE_CAMPO =
  'w-full bg-white border border-stone-200 text-stone-900 text-base md:text-sm px-3 py-2.5 rounded-lg placeholder:text-stone-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';
const CLASE_LABEL = 'text-xs font-medium text-stone-600';
const CLASE_SECCION = 'text-xs font-semibold text-stone-400 uppercase tracking-wider border-b border-stone-100 pb-2 flex items-center gap-2';

function formularioInicial(p: Paciente | null): Formulario {
  return {
    nombre: p?.nombre ?? '',
    edad: p?.edad != null ? String(p.edad) : '',
    telefono: p?.telefono ?? '',
    telefono_emergencia: p?.telefono_emergencia ?? '',
    direccion: p?.direccion ?? '',
    profesion: p?.profesion ?? '',
    actividad_fisica: p?.actividad_fisica ?? '',
    motivo_consulta: p?.motivo_consulta ?? '',
    antecedentes_clinicos: p?.antecedentes_clinicos ?? '',
    estudios_imagenologicos: p?.estudios_imagenologicos ?? '',
    evaluacion_inicial: p?.evaluacion_inicial ?? '',
    objetivo_tratamiento: p?.objetivo_tratamiento ?? '',
    tipo_clase: p?.tipo_clase ?? 'RPG',
  };
}

// Alta y edición de la ficha. En celular, pantalla completa con Guardar fijo abajo.
// Se monta al abrir, así que el formulario arranca con los datos del paciente.
export function PacienteFormModal({ paciente, onCerrar, onGuardado, onEliminar }: PacienteFormModalProps) {
  const toast = useToast();
  const [form, setForm] = useState<Formulario>(() => formularioInicial(paciente));
  const [guardando, setGuardando] = useState(false);
  // Id del paciente nuevo, fijo mientras el formulario está abierto: guardar de nuevo no lo duplica.
  const [idNuevo] = useState(nuevoId);

  const cambiar = (campo: keyof Formulario, valor: string) => setForm((prev) => ({ ...prev, [campo]: valor }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      toast.aviso('El nombre es obligatorio.');
      return;
    }

    const texto = (v: string) => v.trim() || null;
    const payload: Partial<Paciente> = {
      nombre: form.nombre.trim(),
      edad: form.edad === '' ? null : Number(form.edad),
      telefono: texto(form.telefono),
      telefono_emergencia: texto(form.telefono_emergencia),
      direccion: texto(form.direccion),
      profesion: texto(form.profesion),
      actividad_fisica: texto(form.actividad_fisica),
      motivo_consulta: texto(form.motivo_consulta),
      antecedentes_clinicos: texto(form.antecedentes_clinicos),
      estudios_imagenologicos: texto(form.estudios_imagenologicos),
      evaluacion_inicial: texto(form.evaluacion_inicial),
      objetivo_tratamiento: texto(form.objetivo_tratamiento),
      tipo_clase: form.tipo_clase,
      activo: true,
    };

    setGuardando(true);
    try {
      if (paciente) await updatePaciente(paciente.id, payload);
      else await createPaciente({ ...payload, id: idNuevo });
      toast.exito(paciente ? 'Ficha guardada' : 'Paciente creado');
      onGuardado();
    } catch (error: unknown) {
      registrarError('Error guardando paciente', error);
      toast.error(mensajeErrorAlGuardar('No se pudo guardar el paciente.', error));
      setGuardando(false);
    }
  };

  const renderCampo = ({ campo, label, placeholder, filas, tipo }: DefCampo) => (
    <div key={campo} className="space-y-1.5">
      <label htmlFor={`paciente-${campo}`} className={CLASE_LABEL}>{label}</label>
      {filas ? (
        <textarea id={`paciente-${campo}`} rows={filas} value={form[campo]} placeholder={placeholder}
          onChange={(e) => cambiar(campo, e.target.value)} className={`${CLASE_CAMPO} resize-none`} />
      ) : (
        <input id={`paciente-${campo}`} type={tipo ?? 'text'} inputMode={tipo === 'tel' ? 'tel' : undefined}
          value={form[campo]} placeholder={placeholder} onChange={(e) => cambiar(campo, e.target.value)} className={CLASE_CAMPO} />
      )}
    </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="paciente-nombre" className={CLASE_LABEL}>Nombre completo *</label>
              <input id="paciente-nombre" type="text" required autoComplete="off" value={form.nombre}
                placeholder="Ej: Juan Pérez" onChange={(e) => cambiar('nombre', e.target.value)} className={CLASE_CAMPO} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="paciente-edad" className={CLASE_LABEL}>Edad</label>
              <input id="paciente-edad" type="number" inputMode="numeric" min={0} value={form.edad}
                placeholder="Ej: 32" onChange={(e) => cambiar('edad', e.target.value)} className={CLASE_CAMPO} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {DATOS_PERSONALES.map(renderCampo)}
            <div className="space-y-1.5">
              <label htmlFor="paciente-tipo" className={CLASE_LABEL}>Clase asignada</label>
              <select id="paciente-tipo" value={form.tipo_clase} onChange={(e) => cambiar('tipo_clase', e.target.value)} className={CLASE_CAMPO}>
                <option value="RPG">RPG (individual)</option>
                <option value="TPA">TPA (grupal)</option>
                <option value="ambos">Ambos</option>
              </select>
            </div>
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
