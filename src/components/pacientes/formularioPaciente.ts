import { actividadesDe } from '@/lib/pacientes';
import type { Actividad, Paciente } from '@/types';

// Ficha del paciente (PacienteFormModal): campos, valores iniciales y qué se guarda.

export type CampoTexto =
  | 'nombre' | 'telefono' | 'telefono_emergencia' | 'direccion' | 'profesion' | 'actividad_fisica'
  | 'motivo_consulta' | 'antecedentes_clinicos' | 'estudios_imagenologicos' | 'evaluacion_inicial' | 'objetivo_tratamiento';

export type Formulario = Record<CampoTexto, string> & { edad: string; fecha_nacimiento: string; actividades: Actividad[] };

export interface DefCampo {
  campo: CampoTexto;
  label: string;
  placeholder: string;
  filas?: number; // textarea
  tipo?: 'tel';
}

export const DATOS_PERSONALES: DefCampo[] = [
  { campo: 'telefono', label: 'Teléfono', placeholder: 'Ej: 11223344', tipo: 'tel' },
  { campo: 'telefono_emergencia', label: 'Contacto de emergencia', placeholder: 'Nombre y teléfono' },
  { campo: 'direccion', label: 'Dirección', placeholder: 'Ej: Av. Rivadavia 1234' },
  { campo: 'profesion', label: 'Profesión', placeholder: 'Ej: Administrativo' },
  { campo: 'actividad_fisica', label: 'Actividad física', placeholder: 'Ej: Gimnasio 2 veces/sem' },
];

export const DATOS_CLINICOS: DefCampo[] = [
  { campo: 'motivo_consulta', label: 'Motivo de consulta', placeholder: 'Dolor lumbar, cervicalgia, etc.', filas: 2 },
  { campo: 'antecedentes_clinicos', label: 'Antecedentes clínicos', placeholder: 'Cirugías, fracturas, diabetes, hipertensión…', filas: 3 },
  { campo: 'estudios_imagenologicos', label: 'Estudios imagenológicos', placeholder: 'RX cervical (hernia C5-C6), RMN, etc.', filas: 3 },
  { campo: 'evaluacion_inicial', label: 'Evaluación inicial', placeholder: 'Limitación de rotación, dolor a la flexión…', filas: 3 },
  { campo: 'objetivo_tratamiento', label: 'Objetivo del tratamiento', placeholder: 'Reducir dolor, mejorar postura…', filas: 2 },
];

export const CLASE_CAMPO =
  'w-full bg-white border border-stone-200 text-stone-900 text-base md:text-sm px-3 py-2.5 rounded-lg placeholder:text-stone-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';
export const CLASE_LABEL = 'text-xs font-medium text-stone-600';

export function formularioInicial(p: Paciente | null): Formulario {
  return {
    nombre: p?.nombre ?? '',
    edad: p?.edad != null ? String(p.edad) : '',
    fecha_nacimiento: p?.fecha_nacimiento ?? '',
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
    actividades: p ? actividadesDe(p) : ['RPG'],
  };
}

/** Lo que se guarda. `edadCalculada`: la de la fecha de nacimiento, si hay una válida. */
export function datosAGuardar(form: Formulario, edadCalculada: number | null): Partial<Paciente> {
  const texto = (v: string) => v.trim() || null;
  return {
    nombre: form.nombre.trim(),
    // Con fecha se guarda también la edad de hoy: la sigue leyendo la app de main.
    edad: edadCalculada ?? (form.edad === '' ? null : Number(form.edad)),
    fecha_nacimiento: form.fecha_nacimiento || null,
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
    // tipo_clase lo mantiene la base (trigger de la migración 20261118000001).
    actividades: form.actividades,
  };
}
