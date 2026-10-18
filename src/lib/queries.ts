import { supabase } from './supabase';
import { ErrorApp } from './errores';
import { normalizarHora } from './horas';
import type { DatosSemanaTPA } from './tpa';
import { format } from 'date-fns';
import type { Paciente, SesionRPG, Pago, HorarioTPA, ClaseTPA, AsistenciaTPA } from '@/types';

// Con RLS, una escritura que la base no permite (sesión vencida, usuario no
// autorizado) puede no dar error: simplemente afecta 0 filas. Por eso toda
// escritura pide las filas afectadas con .select() y las verifica acá, en
// lugar de usar .single() (que con 0 filas da un error críptico).
function exigirUnaFila<T>(data: T[] | null, mensaje: string): T {
  if (!data || data.length !== 1) throw new ErrorApp(mensaje);
  return data[0];
}

// Postgres devuelve las columnas `time` como "HH:mm:ss"; la app usa "HH:mm".
// Toda fila con hora que sale de este archivo pasa por acá.
function conHora<T extends { hora: string }>(fila: T): T {
  return { ...fila, hora: normalizarHora(fila.hora) };
}

// ==========================================
// PACIENTES
// ==========================================

export async function getPacientesActivos() {
  const { data, error } = await supabase
    .from('pacientes')
    .select('*')
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (error) throw error;
  return data as Paciente[];
}

export async function getPacienteById(id: string) {
  const { data, error } = await supabase
    .from('pacientes')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Paciente;
}

// ==========================================
// SESIONES RPG
// ==========================================

export async function getSesionesRPGPorRango(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('sesiones_rpg')
    .select(`
      *,
      pacientes (nombre, telefono)
    `)
    .gte('fecha', startDate)
    .lte('fecha', endDate)
    .order('fecha', { ascending: true })
    .order('hora', { ascending: true });

  if (error) throw error;
  return (data as SesionRPG[]).map(conHora);
}

export async function createSesionRPG(sesion: Partial<SesionRPG>) {
  const { data, error } = await supabase
    .from('sesiones_rpg')
    .insert([sesion])
    .select();

  if (error) throw error;
  return conHora(exigirUnaFila(data as SesionRPG[] | null, 'No se pudo crear el turno.'));
}

export async function updateSesionRPG(id: string, updates: Partial<SesionRPG>) {
  const { data, error } = await supabase
    .from('sesiones_rpg')
    .update(updates)
    .eq('id', id)
    .select();

  if (error) throw error;
  return conHora(exigirUnaFila(data as SesionRPG[] | null, 'No se pudo guardar el turno.'));
}

export async function deleteSesionRPG(id: string) {
  const { data, error } = await supabase
    .from('sesiones_rpg')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) throw error;
  exigirUnaFila(data, 'No se pudo eliminar el turno.');
}

// ==========================================
// PAGOS
// ==========================================

export async function getPagosMesActual(mes: number, año: number) {
  const { data, error } = await supabase
    .from('pagos')
    .select('*')
    .eq('mes', mes)
    .eq('año', año);

  if (error) throw error;
  return data as Pago[];
}

// ==========================================
// TPA (TERAPIA POSTURAL ACTIVA)
// ==========================================

// Todos los horarios, activos e inactivos: para armar una semana pasada hace
// falta saber quién era fijo en esa fecha (ver eraFijoEn en src/lib/tpa.ts).
export async function getHorariosTPA() {
  const { data, error } = await supabase
    .from('horarios_tpa')
    .select(`
      *,
      pacientes (nombre, telefono)
    `)
    .order('hora', { ascending: true });

  if (error) throw error;
  return ((data || []) as HorarioTPA[]).map(conHora);
}

// Todo lo necesario para armar una semana de TPA (armarSemanaTPA).
export async function cargarSemanaTPA(desde: string, hasta: string): Promise<DatosSemanaTPA> {
  const [horarios, clases] = await Promise.all([
    getHorariosTPA(),
    getClasesTPAPorRango(desde, hasta),
  ]);
  const asistencias = await getAsistenciasTPA(clases.map((c) => c.id));
  return { horarios, clases, asistencias };
}

export async function createHorarioTPA(horario: { paciente_id: string; dia_semana: 'lunes' | 'miercoles' | 'viernes'; hora: string }) {
  const { data, error } = await supabase
    .from('horarios_tpa')
    .insert([{ ...horario, activo: true }])
    .select();

  if (error) throw error;
  return conHora(exigirUnaFila(data as HorarioTPA[] | null, 'No se pudo inscribir al alumno.'));
}

// Desinscribe guardando la fecha de baja (sigue siendo fijo en las fechas anteriores).
export async function deactivateHorarioTPA(id: string) {
  const desactivar = (cambios: { activo: false; fecha_baja?: string }) => supabase
    .from('horarios_tpa')
    .update(cambios)
    .eq('id', id)
    .select();

  let { data, error } = await desactivar({ activo: false, fecha_baja: format(new Date(), 'yyyy-MM-dd') });
  // PGRST204 = la columna no existe: la migración 20261019000001 todavía no está
  // aplicada. Se desinscribe igual, sin fecha. Borrar este fallback cuando esté aplicada.
  if (error?.code === 'PGRST204') ({ data, error } = await desactivar({ activo: false }));

  if (error) throw error;
  return conHora(exigirUnaFila(data as HorarioTPA[] | null, 'No se pudo desinscribir al alumno.'));
}

export async function getClasesTPAPorRango(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('clases_tpa')
    .select('*')
    .gte('fecha', startDate)
    .lte('fecha', endDate);

  if (error) throw error;
  return ((data || []) as ClaseTPA[]).map(conHora);
}

export async function getAsistenciasTPA(claseIds: string[]) {
  if (claseIds.length === 0) return [];
  const { data, error } = await supabase
    .from('asistencia_tpa')
    .select(`
      *,
      pacientes (nombre)
    `)
    .in('clase_id', claseIds);

  if (error) throw error;
  return (data || []) as AsistenciaTPA[];
}

export async function upsertAsistenciaTPA(asistencia: Partial<AsistenciaTPA>) {
  const { data, error } = await supabase
    .from('asistencia_tpa')
    .upsert([asistencia], { onConflict: 'clase_id, paciente_id' })
    .select();

  if (error) throw error;
  return exigirUnaFila(data as AsistenciaTPA[] | null, 'No se pudo guardar la asistencia.');
}

export async function createClaseTPA(clase: Partial<ClaseTPA>) {
  const { data, error } = await supabase
    .from('clases_tpa')
    .insert([clase])
    .select();

  if (error) throw error;
  return conHora(exigirUnaFila(data as ClaseTPA[] | null, 'No se pudo crear la clase.'));
}

// Vuelve a un alumno a "sin marcar": "sin marcar" es no tener fila de asistencia.
export async function deleteAsistenciaTPA(claseId: string, pacienteId: string) {
  const { data, error } = await supabase
    .from('asistencia_tpa')
    .delete()
    .eq('clase_id', claseId)
    .eq('paciente_id', pacienteId)
    .select('id');

  if (error) throw error;
  exigirUnaFila(data, 'No se pudo desmarcar la asistencia.');
}

// Borra la clase si quedó sin ninguna asistencia (todos "sin marcar"),
// para no dejar clases vacías. Devuelve true si la borró.
export async function eliminarClaseTPASiVacia(claseId: string): Promise<boolean> {
  const { count, error: errorCount } = await supabase
    .from('asistencia_tpa')
    .select('id', { count: 'exact', head: true })
    .eq('clase_id', claseId);

  if (errorCount) throw errorCount;
  if ((count ?? 0) > 0) return false;

  const { data, error } = await supabase
    .from('clases_tpa')
    .delete()
    .eq('id', claseId)
    .select('id');

  if (error) throw error;
  exigirUnaFila(data, 'No se pudo borrar la clase vacía.');
  return true;
}

// ==========================================
// CONSULTAS HISTORIAL Y GENERALES
// ==========================================

export async function getSesionesRPGPorPaciente(pacienteId: string) {
  const { data, error } = await supabase
    .from('sesiones_rpg')
    .select('*')
    .eq('paciente_id', pacienteId)
    .order('fecha', { ascending: false })
    .order('hora', { ascending: false });

  if (error) throw error;
  return ((data || []) as SesionRPG[]).map(conHora);
}

export async function getAsistenciasTPAPorPaciente(pacienteId: string) {
  const { data, error } = await supabase
    .from('asistencia_tpa')
    .select(`
      *,
      clases_tpa (fecha, hora)
    `)
    .eq('paciente_id', pacienteId);

  if (error) throw error;
  
  // Sort manually by date-time descending
  const asistencias = ((data || []) as AsistenciaTPA[]).map((a) =>
    a.clases_tpa ? { ...a, clases_tpa: conHora(a.clases_tpa) } : a
  );
  return asistencias.sort((a, b) => {
    const dateA = a.clases_tpa?.fecha ? new Date(a.clases_tpa.fecha + 'T' + (a.clases_tpa.hora || '00:00')) : new Date(0);
    const dateB = b.clases_tpa?.fecha ? new Date(b.clases_tpa.fecha + 'T' + (b.clases_tpa.hora || '00:00')) : new Date(0);
    return dateB.getTime() - dateA.getTime();
  }) as AsistenciaTPA[];
}

export async function getPacientesConPagos(mes: number, año: number) {
  const { data: pacientes, error: errPacientes } = await supabase
    .from('pacientes')
    .select('*')
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (errPacientes) throw errPacientes;

  const { data: pagos, error: errPagos } = await supabase
    .from('pagos')
    .select('*')
    .eq('mes', mes)
    .eq('año', año);

  if (errPagos) throw errPagos;

  return (pacientes || []).map(paciente => {
    const pago = (pagos || []).find(p => p.paciente_id === paciente.id);
    return {
      ...paciente,
      pago: pago || null
    };
  });
}

export async function upsertPago(pago: Partial<Pago>) {
  const { data, error } = await supabase
    .from('pagos')
    .upsert([pago])
    .select();

  if (error) throw error;
  return exigirUnaFila(data as Pago[] | null, 'No se pudo guardar el pago.');
}

export async function createPaciente(paciente: Partial<Paciente>) {
  const { data, error } = await supabase
    .from('pacientes')
    .insert([paciente])
    .select();

  if (error) throw error;
  return exigirUnaFila(data as Paciente[] | null, 'No se pudo crear el paciente.');
}

export async function updatePaciente(id: string, updates: Partial<Paciente>) {
  const { data, error } = await supabase
    .from('pacientes')
    .update(updates)
    .eq('id', id)
    .select();

  if (error) throw error;
  return exigirUnaFila(data as Paciente[] | null, 'No se pudo guardar el paciente.');
}

// Único punto de borrado de pacientes.
// Hoy: borrado REAL. Las FK son ON DELETE CASCADE, así que se borran también
// sus turnos, horarios, asistencias, pagos y lista de espera.
// 🔴 Antes de la carga real se cambia a baja lógica (activo = false) + FK
// ON DELETE RESTRICT, cambiando solo esta función (ver PENDIENTES.md).
export async function eliminarPaciente(id: string) {
  const { data, error } = await supabase
    .from('pacientes')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) throw error;
  exigirUnaFila(data, 'No se pudo eliminar el paciente.');
}

export interface DatosPaciente {
  turnos: number;
  asistencias: number;
  pagos: number;
  horarios: number;
}

// Cuántos registros se borrarían junto con el paciente (para el diálogo de confirmación).
export async function contarDatosPaciente(id: string): Promise<DatosPaciente> {
  const contar = async (tabla: string) => {
    const { count, error } = await supabase
      .from(tabla)
      .select('id', { count: 'exact', head: true })
      .eq('paciente_id', id);

    if (error) throw error;
    return count ?? 0;
  };

  const [turnos, asistencias, pagos, horarios] = await Promise.all([
    contar('sesiones_rpg'),
    contar('asistencia_tpa'),
    contar('pagos'),
    contar('horarios_tpa'),
  ]);

  return { turnos, asistencias, pagos, horarios };
}
