import { supabase } from './supabase';
import type { Paciente, SesionRPG, Pago, HorarioTPA, ClaseTPA, AsistenciaTPA } from '@/types';

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
  return data as SesionRPG[];
}

export async function createSesionRPG(sesion: Partial<SesionRPG>) {
  const { data, error } = await supabase
    .from('sesiones_rpg')
    .insert([sesion])
    .select()
    .single();

  if (error) throw error;
  return data as SesionRPG;
}

export async function updateSesionRPG(id: string, updates: Partial<SesionRPG>) {
  const { data, error } = await supabase
    .from('sesiones_rpg')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as SesionRPG;
}

export async function deleteSesionRPG(id: string) {
  const { error } = await supabase
    .from('sesiones_rpg')
    .delete()
    .eq('id', id);

  if (error) throw error;
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

export async function getHorariosTPA() {
  const { data, error } = await supabase
    .from('horarios_tpa')
    .select(`
      *,
      pacientes (nombre, telefono)
    `)
    .eq('activo', true)
    .order('hora', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createHorarioTPA(horario: { paciente_id: string; dia_semana: 'lunes' | 'miercoles' | 'viernes'; hora: string }) {
  const { data, error } = await supabase
    .from('horarios_tpa')
    .insert([{ ...horario, activo: true }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deactivateHorarioTPA(id: string) {
  const { data, error } = await supabase
    .from('horarios_tpa')
    .update({ activo: false })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getClasesTPAPorRango(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('clases_tpa')
    .select('*')
    .gte('fecha', startDate)
    .lte('fecha', endDate);

  if (error) throw error;
  return data || [];
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
  return data || [];
}

export async function upsertAsistenciaTPA(asistencia: Partial<AsistenciaTPA>) {
  const { data, error } = await supabase
    .from('asistencia_tpa')
    .upsert([asistencia], { onConflict: 'clase_id, paciente_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createClaseTPA(clase: Partial<ClaseTPA>) {
  const { data, error } = await supabase
    .from('clases_tpa')
    .insert([clase])
    .select()
    .single();

  if (error) throw error;
  return data;
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
  return data || [];
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
  return (data || []).sort((a: any, b: any) => {
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
    .select()
    .single();

  if (error) throw error;
  return data as Pago;
}

export async function createPaciente(paciente: Partial<Paciente>) {
  const { data, error } = await supabase
    .from('pacientes')
    .insert([paciente])
    .select()
    .single();

  if (error) throw error;
  return data as Paciente;
}

export async function updatePaciente(id: string, updates: Partial<Paciente>) {
  const { data, error } = await supabase
    .from('pacientes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Paciente;
}

