export type TipoClase = 'RPG' | 'TPA' | 'ambos';
export type EstadoPago = 'pagado' | 'pendiente';
export type EstadoSesionRPG = 'realizada' | 'cancelada' | 'pendiente';
export type DiaSemana = 'lunes' | 'miercoles' | 'viernes';
/**
 * Estado de una fila de asistencia_tpa (ver docs/DISENO_ASISTENCIA_TPA.md, 2.2).
 * Fijo: presente | aviso_con_tiempo | aviso_sin_tiempo | falto_sin_avisar
 * (sin marcar = sin fila). Quien ocupa un lugar: pendiente | presente | falto_sin_avisar.
 */
export type EstadoAsistenciaTPA =
  | 'presente'
  | 'aviso_con_tiempo'
  | 'aviso_sin_tiempo'
  | 'falto_sin_avisar'
  | 'pendiente';
/** fijo = fijo de este horario; el resto viene a ocupar un lugar solo en esa clase. */
export type TipoAsistenciaTPA = 'fijo' | 'recupera' | 'cambio' | 'suelta';
export type MotivoCancelacionTPA = 'feriado' | 'cancelada_por_pau';

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
  /** false = dado de baja (archivado): no aparece en las listas para elegir; su historia queda. */
  activo: boolean;
  /** Desde qué día está dado de baja (migración 20261114000001); null si está activo. */
  fecha_baja?: string | null;
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
  /** Pago de la sesión (migración 20261113000001): solo si está pagada; null = sin dato. */
  importe?: number | null;
  pagado_el?: string | null;
  medio_pago?: MedioPago | null;
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
  /** Desde qué fecha es fijo ('yyyy-MM-dd', inclusive). */
  fecha_alta: string;
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
  /** null = la clase se da. */
  motivo_cancelacion: MotivoCancelacionTPA | null;
  created_at: string;
}

export interface AsistenciaTPA {
  id: string;
  clase_id: string;
  paciente_id: string;
  estado: EstadoAsistenciaTPA;
  tipo: TipoAsistenciaTPA;
  /** Fila del fijo (misma clase, que avisó) cuyo lugar ocupa. null = lugar libre. */
  ocupa_lugar_de: string | null;
  /** Cuándo se cargó el aviso; solo en avisos. */
  avisado_at: string | null;
  /** Solo en tipo 'cambio': fila del aviso del mismo alumno en su horario de origen. */
  cambio_de: string | null;
  created_at: string;
  updated_at: string;
  // Relaciones opcionales
  pacientes?: Pick<Paciente, 'nombre'>;
  clases_tpa?: Pick<ClaseTPA, 'fecha' | 'hora'>;
}

/**
 * Nota de evolución (datos de salud): una por alumno por clase de TPA, o
 * libre (clase_tpa_id null, cargada desde la historia clínica).
 */
export interface NotaEvolucion {
  id: string;
  paciente_id: string;
  /** 'yyyy-MM-dd'; en una nota de clase, la fecha de la clase. */
  fecha: string;
  texto: string;
  clase_tpa_id: string | null;
  created_at: string;
  updated_at: string;
  // Relaciones opcionales
  pacientes?: Pick<Paciente, 'nombre'>;
  clases_tpa?: Pick<ClaseTPA, 'fecha' | 'hora'> | null;
}

export type MedioPago = 'efectivo' | 'transferencia';
export type ConceptoPagoTPA = 'cuota' | 'sueltas';
/** Cuota: plan (del 1 al 10) o por clase. */
export type ModalidadCuota = 'plan' | 'por_clase';

/** Precios de un mes (precios_mes). Pesos enteros. */
export interface PreciosMes {
  /** Primer día del mes: 'yyyy-MM-01'. */
  mes: string;
  tpa_1_vez: number;
  tpa_2_veces: number;
  tpa_3_veces: number;
  tpa_suelta: number;
  rpg_sesion: number;
}

/** Un pago de TPA ya hecho (pagos_tpa). Sin fila = pendiente. */
export interface PagoTPA {
  id: string;
  paciente_id: string;
  /** Primer día del mes que paga: 'yyyy-MM-01'. */
  mes: string;
  concepto: ConceptoPagoTPA;
  /** Solo cuota: 1, 2 o 3. */
  veces_por_semana: number | null;
  /** Solo cuota. */
  modalidad: ModalidadCuota | null;
  /** Por clase y sueltas: cuántas clases paga. */
  clases: number | null;
  importe: number;
  pagado_el: string;
  medio: MedioPago;
  nota: string | null;
  created_at: string;
  updated_at: string;
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
  /** 'fijo' si no tiene asistencia; si la tiene, el tipo de esa fila. */
  tipo: TipoAsistenciaTPA;
}

/** Lugares de una clase (contarLugares en src/lib/tpa.ts). */
export interface LugaresTPA {
  /** Fijos que no avisaron + quienes vienen a ocupar un lugar. */
  ocupados: number;
  libres: number;
  /** Personas de más (5/4 → 1). No se bloquea: solo se avisa. */
  excedidos: number;
  /** Clase cancelada: no tiene lugares. */
  cancelada: boolean;
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
  lugares: LugaresTPA;
  /** Fijos de HOY en este día y hora (para inscribir/desinscribir). */
  fijosActuales: HorarioTPA[];
  /** Notas de evolución de esta clase (de cualquiera, esté o no en la clase). */
  notas: NotaEvolucion[];
}

export type SemanaTPA = Record<DiaSemana, CeldaTPA[]>;

// ---------------------------------------------------------------------
// Recuperaciones (calculadas en src/lib/recuperaciones.ts, no son una tabla)
// ---------------------------------------------------------------------

/** Fila de asistencia con los datos de su clase (para el saldo de recuperaciones). */
export interface AsistenciaConClase extends AsistenciaTPA {
  clases_tpa: Pick<ClaseTPA, 'fecha' | 'hora' | 'motivo_cancelacion'>;
}

/** En orden de prioridad de Pau (a quién se le ofrece primero un lugar). */
export type OrigenRecuperacion = 'cancelada_por_pau' | 'aviso_con_tiempo' | 'aviso_sin_tiempo' | 'feriado';

export interface CreditoRecuperacion {
  /** `${origen}_${fecha}_${hora}`: único por alumno. */
  id: string;
  origen: OrigenRecuperacion;
  /** Clase que la generó ('yyyy-MM-dd', 'HH:mm'). */
  fecha: string;
  hora: string;
  /** Último día para usarla ('yyyy-MM-dd'); null = no vence (cancelada por Pau). */
  vence: string | null;
  /** Origen legible: "cancelé el mié 7", "avisó con tiempo el lun 12". */
  texto: string;
}

export interface UsoRecuperacion {
  asistenciaId: string;
  tipo: 'recupera' | 'cambio';
  fecha: string;
  hora: string;
  estado: EstadoAsistenciaTPA;
  /** Lo que consumió; null = sin crédito (adelantó). */
  credito: CreditoRecuperacion | null;
  /** Cambio de horario cuyo aviso es de otro mes: cuenta en el mes del aviso. */
  deOtroMes: boolean;
  texto: string;
}

export interface SinDerechoRecuperacion {
  /** no_es_fijo: clase que canceló Pau de alguien sin horario fijo vigente (vuelve si se reinscribe). */
  motivo: 'no_aviso' | 'tope' | 'vencio' | 'no_es_fijo';
  fecha: string;
  hora: string;
  texto: string;
}

export interface SaldoRecuperaciones {
  pacienteId: string;
  nombre: string;
  /** Veces por semana (horarios fijos): también es el tope del mes. */
  frecuencia: number;
  /** Lo que le queda, en orden de prioridad. */
  pendientes: CreditoRecuperacion[];
  usos: UsoRecuperacion[];
  /** Usos sin crédito: recuperó antes de faltar. */
  adelantos: UsoRecuperacion[];
  /** Usos que consumieron un aviso + usos sin crédito ("usó 1 de 2"). */
  topeUsado: number;
  sinDerecho: SinDerechoRecuperacion[];
  /** Mes cerrado con adelantos que ninguna falta cubrió: lo decide Pau. */
  adelantoSinFalta: boolean;
}
