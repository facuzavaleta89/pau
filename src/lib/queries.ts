import { supabase } from './supabase';
import { ErrorApp } from './errores';
import { normalizarHora } from './horas';
import type { DatosSemanaTPA } from './tpa';
import type { DatosRecuperaciones } from './recuperaciones';
import type { ClaseAGuardar } from './clase-tpa';
import { format } from 'date-fns';
import type { FilaAlerta } from './alertas';
import { TABLAS_COPIA, type TablaCopia } from './copia';
import type { AsistenciaSuelta, DatosPagosMes, Mes } from './pagos';
import { moverMes, primerDia, ultimoDia } from './pagos';
import type {
  Paciente, SesionRPG, HorarioTPA, ClaseTPA, AsistenciaTPA, AsistenciaConClase, DiaSemana, MotivoCancelacionTPA,
  NotaEvolucion, PagoTPA, PreciosMes, MedioPago,
} from '@/types';

// Con RLS, una escritura que la base no permite (sesión vencida, usuario no
// autorizado) puede no dar error: simplemente afecta 0 filas. Por eso toda
// escritura pide las filas afectadas con .select() y las verifica acá, en
// lugar de usar .single() (que con 0 filas da un error críptico).
function exigirUnaFila<T>(data: T[] | null, mensaje: string): T {
  if (!data || data.length !== 1) throw new ErrorApp(mensaje);
  return data[0];
}

// Alta con un id generado en el navegador al abrir el formulario (nuevoId()).
// Si la respuesta de un guardado anterior se perdió (corte de conexión) y Pau
// vuelve a tocar Guardar, la base responde 23505 por el mismo id: ya estaba
// guardado. Se le aplican los datos actuales (pudo corregir algo antes de
// reintentar) y se devuelve la fila, sin duplicarla.
async function insertarSinDuplicar<T>(tabla: string, fila: { id: string }, mensaje: string): Promise<T> {
  const { data, error } = await supabase.from(tabla).insert([fila]).select();
  if (error?.code !== '23505') {
    if (error) throw error;
    return exigirUnaFila(data as T[] | null, mensaje);
  }

  const { data: existente, error: errorUpdate } = await supabase
    .from(tabla)
    .update(fila)
    .eq('id', fila.id)
    .select();

  if (errorUpdate) throw errorUpdate;
  // Sin fila con ese id: el 23505 era por otro dato repetido.
  if (!existente || existente.length !== 1) throw error;
  return existente[0] as T;
}

// PostgREST devuelve como mucho 1000 filas por consulta: para tablas que
// crecen (historial de asistencias), se lee de a páginas hasta el final.
const TAMANO_PAGINA = 1000;
async function leerTodo<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await consulta(desde, desde + TAMANO_PAGINA - 1);
    if (error) throw error;
    filas.push(...((data ?? []) as T[]));
    if (!data || data.length < TAMANO_PAGINA) return filas;
  }
}

// Postgres devuelve las columnas `time` como "HH:mm:ss"; la app usa "HH:mm".
// Toda fila con hora que sale de este archivo pasa por acá.
function conHora<T extends { hora: string }>(fila: T): T {
  return { ...fila, hora: normalizarHora(fila.hora) };
}

// ==========================================
// PACIENTES
// ==========================================

// Todos los pacientes, también los dados de baja (pantalla Pacientes: activos y archivados).
export async function getPacientes() {
  const { data, error } = await supabase
    .from('pacientes')
    .select('*')
    .order('nombre', { ascending: true });

  if (error) throw error;
  return data as Paciente[];
}

// Solo los activos: para todas las listas donde se elige un paciente (turno
// RPG, inscribir fijo, ocupar lugar). Los dados de baja no aparecen.
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

// `id` generado al abrir el formulario (nuevoId()): reintentar no duplica.
export async function createSesionRPG(sesion: Partial<SesionRPG> & { id: string }) {
  return conHora(await insertarSinDuplicar<SesionRPG>('sesiones_rpg', sesion, 'No se pudo crear el turno.'));
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
// PAGOS (datos personales: nunca a la consola). Diseño: docs/DISENO_PAGOS.md.
// La tabla vieja `pagos` ya no se lee ni se escribe.
// ==========================================

export async function getPreciosMes() {
  const { data, error } = await supabase.from('precios_mes').select('*').order('mes', { ascending: true });
  if (error) throw error;
  return (data || []) as PreciosMes[];
}

// Upsert sobre la clave natural (mes): guardar de nuevo no duplica.
export async function guardarPreciosMes(precios: PreciosMes) {
  const { data, error } = await supabase
    .from('precios_mes')
    .upsert([precios], { onConflict: 'mes' })
    .select();

  if (error) throw error;
  return exigirUnaFila(data as PreciosMes[] | null, 'No se pudieron guardar los precios.');
}

// Todo lo que muestran /pagos y la pestaña Calendario de TPA para un mes ('yyyy-MM').
export async function cargarPagosMes(mes: Mes): Promise<DatosPagosMes> {
  const desde = primerDia(mes);
  const hasta = ultimoDia(mes);
  const [precios, horarios, pagos, sueltas, sesiones] = await Promise.all([
    getPreciosMes(),
    getHorariosTPA(),
    leerTodo<PagoTPA>((d, h) =>
      supabase.from('pagos_tpa').select('*, pacientes (nombre)')
        .gte('mes', primerDia(moverMes(mes, -3))).lte('mes', desde)
        .order('id').range(d, h)),
    leerTodo<AsistenciaSuelta>((d, h) =>
      supabase.from('asistencia_tpa')
        .select('paciente_id, tipo, estado, pacientes (nombre), clases_tpa!inner (fecha, hora, motivo_cancelacion)')
        .eq('tipo', 'suelta')
        .gte('clases_tpa.fecha', desde)
        .lte('clases_tpa.fecha', hasta)
        .order('id').range(d, h)),
    getSesionesRPGPorRango(desde, hasta),
  ]);
  return {
    mes,
    precios,
    horarios,
    pagos,
    sueltas: sueltas.map((a) => ({ ...a, clases_tpa: conHora(a.clases_tpa) })),
    sesiones,
  };
}

export type PagoTPANuevo = Omit<PagoTPA, 'created_at' | 'updated_at' | 'pacientes'>;

// Alta de un pago con `id` generado al abrir el panel (nuevoId()): tocar
// Guardar de nuevo después de un corte no lo duplica. Una cuota repetida
// (otro pago de la cuota del mismo alumno y mes, por ejemplo desde otra
// pestaña) choca con el índice único parcial: se avisa en lugar de duplicar.
export async function crearPagoTPA(pago: PagoTPANuevo) {
  try {
    return await insertarSinDuplicar<PagoTPA>('pagos_tpa', pago, 'No se pudo guardar el pago.');
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === '23505') {
      throw new ErrorApp('Ya hay un pago de la cuota de ese mes para este alumno. Recargá la pantalla para verlo.');
    }
    throw err;
  }
}

export async function actualizarPagoTPA(id: string, cambios: Partial<PagoTPANuevo>) {
  const { data, error } = await supabase
    .from('pagos_tpa')
    .update(cambios)
    .eq('id', id)
    .select();

  if (error) throw error;
  return exigirUnaFila(data as PagoTPA[] | null, 'No se pudo guardar el pago.');
}

// "Deshacer el pago": vuelve a quedar pendiente.
export async function borrarPagoTPA(id: string) {
  const { data, error } = await supabase
    .from('pagos_tpa')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) throw error;
  exigirUnaFila(data, 'No se pudo deshacer el pago.');
}

// Pago de una sesión de RPG. Con `null` vuelve a pendiente (la base limpia
// importe, fecha y medio sola: trigger de la migración 20261113000001).
export async function cambiarPagoSesionRPG(
  id: string,
  pago: { importe: number; pagado_el: string; medio_pago: MedioPago } | null,
) {
  const cambios = pago ? { estado_pago: 'pagado' as const, ...pago } : { estado_pago: 'pendiente' as const };
  return updateSesionRPG(id, cambios);
}

// ==========================================
// TPA (TERAPIA POSTURAL ACTIVA)
// ==========================================

// Todos los horarios, activos e inactivos: para armar una semana pasada hace
// falta saber quién era fijo en esa fecha (ver eraFijoEn en src/lib/tpa.ts).
// Con `pacienteId`, solo los de ese alumno.
export async function getHorariosTPA(pacienteId?: string) {
  let consulta = supabase
    .from('horarios_tpa')
    .select(`
      *,
      pacientes (nombre, telefono)
    `);
  if (pacienteId) consulta = consulta.eq('paciente_id', pacienteId);
  const { data, error } = await consulta.order('hora', { ascending: true });

  if (error) throw error;
  return ((data || []) as HorarioTPA[]).map(conHora);
}

// Todo lo necesario para armar una semana de TPA (armarSemanaTPA).
export async function cargarSemanaTPA(desde: string, hasta: string): Promise<DatosSemanaTPA> {
  const [horarios, clases] = await Promise.all([
    getHorariosTPA(),
    getClasesTPAPorRango(desde, hasta),
  ]);
  const ids = clases.map((c) => c.id);
  const [asistencias, notas] = await Promise.all([getAsistenciasTPA(ids), getNotasDeClases(ids)]);
  return { horarios, clases, asistencias, notas };
}

// `fecha_alta` = desde qué fecha es fijo (por defecto hoy, la elige Pau al inscribir).
export async function createHorarioTPA(horario: {
  paciente_id: string; dia_semana: DiaSemana; hora: string; fecha_alta: string;
}) {
  const { data, error } = await supabase
    .from('horarios_tpa')
    .insert([{ ...horario, activo: true }])
    .select();

  // 23505 = ya es fijo activo de ese horario (índice único parcial): pasa al
  // reintentar después de un corte. Ya estaba inscripto: se devuelve esa fila.
  if (error?.code === '23505') {
    const { data: existente, error: errorLectura } = await supabase
      .from('horarios_tpa')
      .select()
      .eq('paciente_id', horario.paciente_id)
      .eq('dia_semana', horario.dia_semana)
      .eq('hora', horario.hora)
      .eq('activo', true);

    if (errorLectura) throw errorLectura;
    return conHora(exigirUnaFila(existente as HorarioTPA[] | null, 'No se pudo inscribir al alumno.'));
  }

  if (error) throw error;
  return conHora(exigirUnaFila(data as HorarioTPA[] | null, 'No se pudo inscribir al alumno.'));
}

// Desinscribe guardando la fecha de baja (sigue siendo fijo en las fechas
// anteriores). Si el alta era a futuro, la baja queda en la fecha de alta:
// nunca llegó a ser fijo (la base exige fecha_baja >= fecha_alta).
export async function deactivateHorarioTPA(horario: Pick<HorarioTPA, 'id' | 'fecha_alta'>) {
  const hoy = format(new Date(), 'yyyy-MM-dd');
  const { data, error } = await supabase
    .from('horarios_tpa')
    .update({ activo: false, fecha_baja: hoy > horario.fecha_alta ? hoy : horario.fecha_alta })
    .eq('id', horario.id)
    .select();

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

// Guarda una o varias clases (un cambio de horario toca dos) en UNA
// transacción de la base (guardar_clase_tpa, migración 20261023000001): crea
// la clase si hace falta, aplica los cambios en el orden correcto y borra la
// clase si quedó vacía (salvo cancelada). Reintentable: no duplica.
export async function guardarClasesTPA(clases: ClaseAGuardar[]) {
  const { error } = await supabase.rpc('guardar_clase_tpa', { p_clases: clases });
  if (error) throw error;
}

// Cancela (motivo) o reactiva (null) las clases de una fecha en esas horas:
// una clase o el día entero. Crea las que falten. No borra asistencias.
export async function cambiarCancelacionTPA(fecha: string, horas: string[], motivo: MotivoCancelacionTPA | null) {
  const { data, error } = await supabase.rpc('cambiar_cancelacion_tpa', { p_fecha: fecha, p_horas: horas, p_motivo: motivo });
  if (error) throw error;
  if (typeof data !== 'number' || data === 0) throw new ErrorApp('No se pudo cambiar la clase.');
  return data;
}

// Lo que necesita calcularRecuperaciones: todos los horarios, las clases
// canceladas y las filas que cuentan (avisos, "No avisó" y quienes ocupan un
// lugar) de TODO el historial (las de Pau no vencen). Las "Presente" de los
// fijos no hacen falta y no se traen. Con `pacienteId`, solo lo de ese alumno
// (historia clínica): su saldo da igual que con todos.
export async function cargarDatosRecuperaciones(pacienteId?: string): Promise<DatosRecuperaciones> {
  const [horarios, clasesCanceladas, asistencias] = await Promise.all([
    getHorariosTPA(pacienteId),
    leerTodo<ClaseTPA>((desde, hasta) =>
      supabase.from('clases_tpa').select('*').not('motivo_cancelacion', 'is', null).order('id').range(desde, hasta)),
    leerTodo<AsistenciaConClase>((desde, hasta) => {
      let consulta = supabase
        .from('asistencia_tpa')
        .select('*, pacientes (nombre), clases_tpa (fecha, hora, motivo_cancelacion)')
        .or('tipo.neq.fijo,estado.in.(aviso_con_tiempo,aviso_sin_tiempo,falto_sin_avisar)');
      if (pacienteId) consulta = consulta.eq('paciente_id', pacienteId);
      return consulta.order('id').range(desde, hasta);
    }),
  ]);
  return {
    horarios,
    clasesCanceladas: clasesCanceladas.map(conHora),
    asistencias: asistencias.map((a) => ({ ...a, clases_tpa: conHora(a.clases_tpa) })),
  };
}

// Para la alerta de 2 faltas seguidas sin avisar (alertasDeFaltas en
// src/lib/alertas.ts): las filas de los fijos, en cualquier estado, de las
// clases entre `desde` y `hasta` ('yyyy-MM-dd'). La de un alumno puntual
// (historia clínica) sale de todo su historial con getAsistenciasTPAPorPaciente.
export async function cargarDatosAlertas(desde: string, hasta: string): Promise<FilaAlerta[]> {
  const filas = await leerTodo<FilaAlerta>((d, h) =>
    supabase
      .from('asistencia_tpa')
      .select('paciente_id, tipo, estado, clases_tpa!inner (fecha, hora, motivo_cancelacion)')
      .eq('tipo', 'fijo')
      .gte('clases_tpa.fecha', desde)
      .lte('clases_tpa.fecha', hasta)
      .order('id')
      .range(d, h));
  return filas.map((f) => ({ ...f, clases_tpa: conHora(f.clases_tpa) }));
}

// ==========================================
// NOTAS DE EVOLUCIÓN (datos de salud: nunca a la consola ni en un mensaje)
// ==========================================

// Notas de esas clases, con el nombre (el modal muestra también las de quien ya no está en la clase).
export async function getNotasDeClases(claseIds: string[]) {
  if (claseIds.length === 0) return [];
  const { data, error } = await supabase
    .from('notas_evolucion')
    .select('*, pacientes (nombre)')
    .in('clase_tpa_id', claseIds);

  if (error) throw error;
  return (data || []) as NotaEvolucion[];
}

// Todas las notas de un alumno (de clase y libres), con la fecha y hora de su clase.
export async function getNotasPaciente(pacienteId: string) {
  const { data, error } = await supabase
    .from('notas_evolucion')
    .select('*, clases_tpa (fecha, hora)')
    .eq('paciente_id', pacienteId)
    .order('fecha', { ascending: false });

  if (error) throw error;
  return ((data || []) as NotaEvolucion[]).map((n) => (n.clases_tpa ? { ...n, clases_tpa: conHora(n.clases_tpa) } : n));
}

// Nota libre (sin clase), desde la historia clínica. `id` generado al abrir el
// formulario (nuevoId()): reintentar no duplica. Las notas de una clase se
// crean con guardarClasesTPA, junto con la asistencia.
export async function crearNotaLibre(nota: { id: string; paciente_id: string; fecha: string; texto: string }) {
  const fila = { ...nota, clase_tpa_id: null };
  return insertarSinDuplicar<NotaEvolucion>('notas_evolucion', fila, 'No se pudo guardar la nota.');
}

// Editar una nota (de clase o libre). La fecha solo se cambia en las libres:
// la de una nota de clase es la de su clase.
export async function actualizarNota(id: string, cambios: { texto: string; fecha?: string }) {
  const { data, error } = await supabase
    .from('notas_evolucion')
    .update(cambios)
    .eq('id', id)
    .select();

  if (error) throw error;
  return exigirUnaFila(data as NotaEvolucion[] | null, 'No se pudo guardar la nota.');
}

export async function borrarNota(id: string) {
  const { data, error } = await supabase
    .from('notas_evolucion')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) throw error;
  exigirUnaFila(data, 'No se pudo borrar la nota.');
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

// Todo el historial de TPA de un alumno, con su clase (incluye si se canceló).
// Lo ordena la línea de tiempo (src/lib/evolucion.ts).
export async function getAsistenciasTPAPorPaciente(pacienteId: string) {
  const filas = await leerTodo<AsistenciaConClase>((desde, hasta) =>
    supabase
      .from('asistencia_tpa')
      .select('*, clases_tpa (fecha, hora, motivo_cancelacion)')
      .eq('paciente_id', pacienteId)
      .order('id')
      .range(desde, hasta));
  return filas.map((a) => ({ ...a, clases_tpa: conHora(a.clases_tpa) }));
}

export interface HistoriaClinica {
  paciente: Paciente;
  sesiones: SesionRPG[];
  asistencias: AsistenciaConClase[];
  notas: NotaEvolucion[];
  /** Solo de este alumno: para su saldo del mes (calcularRecuperaciones). */
  recuperaciones: DatosRecuperaciones;
}

// Todo lo que muestra la historia clínica de un paciente.
export async function cargarHistoriaClinica(pacienteId: string): Promise<HistoriaClinica> {
  const [paciente, sesiones, asistencias, notas, recuperaciones] = await Promise.all([
    getPacienteById(pacienteId),
    getSesionesRPGPorPaciente(pacienteId),
    getAsistenciasTPAPorPaciente(pacienteId),
    getNotasPaciente(pacienteId),
    cargarDatosRecuperaciones(pacienteId),
  ]);
  return { paciente, sesiones, asistencias, notas, recuperaciones };
}

// `id` generado al abrir el formulario (nuevoId()): reintentar no duplica.
export async function createPaciente(paciente: Partial<Paciente> & { id: string }) {
  return insertarSinDuplicar<Paciente>('pacientes', paciente, 'No se pudo crear el paciente.');
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

// Baja lógica (migración 20261114000001): en una transacción de la base, el
// paciente queda inactivo con su fecha de baja y sus horarios fijos de TPA se
// cierran en esa fecha (no debe la cuota de los meses siguientes). Su
// historia y sus pagos quedan. Devuelve cuántos horarios cerró.
export async function darDeBajaPaciente(id: string, fecha: string) {
  const { data, error } = await supabase.rpc('dar_de_baja_paciente', { p_paciente: id, p_fecha: fecha });
  if (error) throw error;
  if (typeof data !== 'number') throw new ErrorApp('No se pudo dar de baja al paciente.');
  return data;
}

// Vuelve a las listas. Sus horarios fijos no se reabren: se inscribe de nuevo
// desde TPA → Calendario. La base limpia fecha_baja sola (trigger).
export async function reactivarPaciente(id: string) {
  return updatePaciente(id, { activo: true, fecha_baja: null });
}

// Borrado REAL, solo para un paciente sin ningún dato (cargado por error).
// Desde la migración 20261114000001 las FK son ON DELETE RESTRICT: si tiene
// historial, la base no lo deja borrar (23503) y se ofrece dar de baja.
export async function eliminarPaciente(id: string) {
  const { data, error } = await supabase
    .from('pacientes')
    .delete()
    .eq('id', id)
    .select('id');

  if (error?.code === '23503') {
    throw new ErrorApp('Tiene historial guardado, así que no se puede eliminar. Podés darlo de baja.');
  }
  if (error) throw error;
  exigirUnaFila(data, 'No se pudo eliminar el paciente.');
}

export interface DatosPaciente {
  turnos: number;
  asistencias: number;
  notas: number;
  pagos: number;
  horarios: number;
  listaEspera: number;
}

// Cuántos datos tiene guardados (diálogo "Eliminar"): con alguno, no se puede
// borrar (FK RESTRICT) y se ofrece dar de baja.
export async function contarDatosPaciente(id: string): Promise<DatosPaciente> {
  const contar = async (tabla: string) => {
    const { count, error } = await supabase
      .from(tabla)
      .select('id', { count: 'exact', head: true })
      .eq('paciente_id', id);

    if (error) throw error;
    return count ?? 0;
  };

  const [turnos, asistencias, notas, pagos, horarios, listaEspera] = await Promise.all([
    contar('sesiones_rpg'),
    contar('asistencia_tpa'),
    contar('notas_evolucion'),
    contar('pagos_tpa'),
    contar('horarios_tpa'),
    contar('lista_espera'),
  ]);

  return { turnos, asistencias, notas, pagos, horarios, listaEspera };
}

// ==========================================
// COPIA DE SEGURIDAD (datos de salud: el archivo va solo a la compu de Pau,
// nunca a la consola ni al repo). Formato en src/lib/copia.ts.
// ==========================================

// Todas las filas de todas las tablas, de a páginas (PostgREST corta en 1000).
export async function leerTablasParaCopia(): Promise<Record<TablaCopia, unknown[]>> {
  const leidas = await Promise.all(TABLAS_COPIA.map(async ({ tabla, orden }) => {
    const filas = await leerTodo<unknown>((desde, hasta) =>
      supabase.from(tabla).select('*').order(orden).range(desde, hasta));
    return [tabla, filas] as const;
  }));
  return Object.fromEntries(leidas) as Record<TablaCopia, unknown[]>;
}
