import { supabase } from './supabase';
import type { Paciente, SesionRPG, Pago } from '@/types';

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
