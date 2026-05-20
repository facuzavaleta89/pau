export type TipoClase = 'RPG' | 'TPA' | 'ambos';
export type EstadoPago = 'pagado' | 'pendiente';
export type EstadoSesionRPG = 'realizada' | 'cancelada' | 'pendiente';
export type DiaSemana = 'lunes' | 'miercoles' | 'viernes';
export type EstadoAsistenciaTPA = 
  | 'presente'
  | 'aviso_ausencia'
  | 'falto_sin_avisar'
  | 'recupera'
  | 'vino_otra_clase'
  | 'cancelado'
  | 'pendiente';

export interface Paciente {
  id: string;
  nombre: string;
  edad: number | null;
  telefono: string | null;
  telefono_emergencia: string | null;
  direccion: string | null;
  profesion: string | null;
  actividad_fisica: string | null;
  antecedentes_clinicos: string | null;
  estudios_imagenologicos: string | null;
  motivo_consulta: string | null;
  evaluacion_inicial: string | null;
  objetivo_tratamiento: string | null;
  tipo_clase: TipoClase | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface SesionRPG {
  id: string;
  paciente_id: string;
  fecha: string;
  hora: string;
  tipo_sesion: string | null;
  estado_pago: EstadoPago;
  estado_sesion: EstadoSesionRPG;
  nota: string | null;
  created_at: string;
  // Relación opcional para consultas
  pacientes?: Pick<Paciente, 'nombre' | 'telefono'>;
}

export interface HorarioTPA {
  id: string;
  paciente_id: string;
  dia_semana: DiaSemana;
  hora: string;
  activo: boolean;
  created_at: string;
  // Relación opcional
  pacientes?: Pick<Paciente, 'nombre'>;
}

export interface ClaseTPA {
  id: string;
  fecha: string;
  hora: string;
  created_at: string;
}

export interface AsistenciaTPA {
  id: string;
  clase_id: string;
  paciente_id: string;
  estado: EstadoAsistenciaTPA;
  nota: string | null;
  created_at: string;
  // Relaciones opcionales
  pacientes?: Pick<Paciente, 'nombre'>;
  clases_tpa?: Pick<ClaseTPA, 'fecha' | 'hora'>;
}

export interface Pago {
  id: string;
  paciente_id: string;
  mes: number;
  año: number;
  plan: string | null;
  precio: number | null;
  estado: EstadoPago;
  fecha_pago: string | null;
  created_at: string;
  // Relación opcional
  pacientes?: Pick<Paciente, 'nombre'>;
}

export interface ListaEspera {
  id: string;
  paciente_id: string;
  tipo_clase: 'RPG' | 'TPA' | null;
  horario_preferido: string | null;
  fecha_ingreso: string;
  created_at: string;
  // Relación opcional
  pacientes?: Pick<Paciente, 'nombre'>;
}
