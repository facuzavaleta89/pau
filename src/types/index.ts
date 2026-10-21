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
  /** Fecha de desinscripción ('yyyy-MM-dd'); null mientras está activo. */
  fecha_baja: string | null;
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

// ---------------------------------------------------------------------
// Modelo de la semana TPA (calculado en src/lib/tpa.ts, no es una tabla)
// ---------------------------------------------------------------------

export interface AlumnoCeldaTPA {
  pacienteId: string;
  nombre: string;
  /** Estado registrado; 'pendiente' si no tiene asistencia. */
  estado: EstadoAsistenciaTPA;
  asistencia: AsistenciaTPA | null;
  /** Era alumno fijo de este horario en esta fecha. */
  esFijo: boolean;
}

export interface CeldaTPA {
  /** `${fecha}_${hora}`: identifica la clase de esa fecha y hora. */
  clave: string;
  dia: DiaSemana;
  fecha: string; // 'yyyy-MM-dd'
  hora: string;  // 'HH:mm'
  /** Es uno de los horarios habituales de Pau (HORARIOS_TPA). */
  enHorarioHabitual: boolean;
  clase: ClaseTPA | null;
  /** Fijos de esa fecha + quienes tienen asistencia registrada (recupera, vino de otro horario…). */
  alumnos: AlumnoCeldaTPA[];
  cupo: number;
  /** Fijos de HOY en este día y hora (para inscribir/desinscribir). */
  fijosActuales: HorarioTPA[];
}

export type SemanaTPA = Record<DiaSemana, CeldaTPA[]>;
