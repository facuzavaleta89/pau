"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, Save } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cambiarCancelacionTPA, getPacientesActivos, guardarClasesTPA } from "@/lib/queries";
import { mensajeError, mensajeErrorAlGuardar, registrarError } from "@/lib/errores";
import { esClaseFutura, sugerirAviso } from "@/lib/avisos";
import { MOTIVOS_CANCELACION } from "@/lib/estados";
import { contarLugares, textoLugares } from "@/lib/tpa";
import { calcularRecuperaciones, type DatosRecuperaciones } from "@/lib/recuperaciones";
import { cambiosParaGuardar, enlacesCambio } from "@/lib/clase-tpa";
import type { CeldaTPA, MotivoCancelacionTPA, Paciente } from "@/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal, BOTON_PIE_PRIMARIO, BOTON_PIE_SECUNDARIO } from "@/components/ui/Modal";
import { TpaAsistenciaLista } from "./TpaAsistenciaLista";
import { TpaInscripcion } from "./TpaInscripcion";
import { TpaOcuparSelector } from "./TpaOcuparSelector";
import { TpaCancelarDialog } from "./TpaCancelarDialog";
import { useBorradorClase, type OcupanteInicial } from "./useBorradorClase";

interface TpaClaseModalProps {
  celda: CeldaTPA;
  /** Historial para saldos y cambios de horario (null mientras carga). */
  datosRec: DatosRecuperaciones | null;
  /** Abrir directamente "Ocupar lugar" (desde "+ Ocupar" en la card). */
  abrirOcupar?: boolean;
  /** Alguien ya elegido para ocupar un lugar (desde "Buscar lugar"). */
  ocupanteInicial?: OcupanteInicial | null;
  onClose: () => void;
  onGuardado: () => void; // recarga la semana y las recuperaciones
}

type Pestania = 'asistencia' | 'inscripcion';
const BOTON_CANCELAR_CLASE =
  "h-11 px-4 flex items-center justify-center gap-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg disabled:opacity-50 disabled:pointer-events-none";

// Se monta al abrir (con key = celda.clave), así que el estado arranca limpio
// cada vez. Si la semana se recarga con el modal abierto (por ejemplo, al
// inscribir), `celda` cambia pero la pestaña y las marcas sin guardar se conservan.
export function TpaClaseModal({ celda, datosRec, abrirOcupar = false, ocupanteInicial = null, onClose, onGuardado }: TpaClaseModalProps) {
  const toast = useToast();
  const motivo = celda.clase?.motivo_cancelacion ?? null;
  const [pestania, setPestania] = useState<Pestania>('asistencia');
  // Selector "Ocupar lugar": undefined = cerrado; null = lugar libre; si no, el fijo.
  const [ocupando, setOcupando] = useState<string | null | undefined>(abrirOcupar && !motivo ? null : undefined);
  const [saving, setSaving] = useState(false);
  const [eligiendoMotivo, setEligiendoMotivo] = useState(false);
  const [confirmandoReactivar, setConfirmandoReactivar] = useState(false);
  const [cambiandoCancelacion, setCambiandoCancelacion] = useState(false);
  const [todosPacientes, setTodosPacientes] = useState<Paciente[]>([]);
  // Momento en que se abrió: define si la clase es futura y la sugerencia C.T./S.T.
  const [abiertoEn] = useState(() => new Date());

  useEffect(() => {
    getPacientesActivos()
      .then(setTodosPacientes)
      .catch((err: unknown) => {
        registrarError("Error cargando pacientes en el modal TPA", err);
        toast.error(`No se pudo cargar la lista de pacientes. ${mensajeError(err)}`);
      });
  }, [toast]);

  const historial = useMemo(() => datosRec?.asistencias ?? [], [datosRec]);
  const enlaces = useMemo(() => enlacesCambio(celda, historial), [celda, historial]);
  const b = useBorradorClase(celda, enlaces, ocupanteInicial);
  const enLaClase = useMemo(() => new Set(b.filas.map((f) => f.pacienteId)), [b.filas]);
  // Saldos del mes de esta clase (para el selector).
  const saldos = useMemo(
    () => (datosRec ? calcularRecuperaciones(celda.fecha.slice(0, 7), datosRec, format(abiertoEn, 'yyyy-MM-dd')) : []),
    [datosRec, celda.fecha, abiertoEn]
  );

  const hayCambios = cambiosParaGuardar(celda, b.borrador, abiertoEn).length > 0;
  const claseFutura = esClaseFutura(celda.fecha, celda.hora, abiertoEn);
  const sugerencia = sugerirAviso(celda.fecha, celda.hora, abiertoEn);
  const lugares = contarLugares(b.filas, celda.cupo, motivo !== null);

  const handleGuardar = async () => {
    if (!hayCambios || b.hayPreguntas) return;
    setSaving(true);
    try {
      await guardarClasesTPA(cambiosParaGuardar(celda, b.borrador, new Date()));
      toast.exito('Asistencia guardada');
      onGuardado();
      onClose();
    } catch (error: unknown) {
      registrarError("Error guardando asistencia TPA", error);
      // Una sola transacción: si falló, no se guardó nada (salvo corte por tiempo).
      toast.error(mensajeErrorAlGuardar("No se pudo guardar la asistencia.", error));
    } finally {
      setSaving(false);
    }
  };

  const cambiarCancelacion = async (nuevo: MotivoCancelacionTPA | null) => {
    setCambiandoCancelacion(true);
    try {
      await cambiarCancelacionTPA(celda.fecha, [celda.hora], nuevo);
      toast.exito(nuevo ? MOTIVOS_CANCELACION[nuevo] : 'Clase reactivada');
      setEligiendoMotivo(false);
      setConfirmandoReactivar(false);
      onGuardado();
    } catch (error: unknown) {
      registrarError("Error cambiando la cancelación de una clase TPA", error);
      toast.error(mensajeErrorAlGuardar(nuevo ? "No se pudo cancelar la clase." : "No se pudo reactivar la clase.", error));
    } finally {
      setCambiandoCancelacion(false);
    }
  };

  const diaLabel = format(parseISO(celda.fecha), "EEEE d 'de' MMMM", { locale: es });
  const resumenLugares = motivo ? MOTIVOS_CANCELACION[motivo] : textoLugares(lugares, celda.cupo);
  const nombreDe = (pacienteId: string) => b.filas.find((f) => f.pacienteId === pacienteId)?.nombre ?? null;

  const pestanias = (
    <div role="tablist" className="flex gap-6 px-4 md:px-6 border-b border-stone-200">
      {([['asistencia', 'Asistencia'], ['inscripcion', `Alumnos fijos (${celda.fijosActuales.length})`]] as const).map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={pestania === id}
          onClick={() => setPestania(id)}
          className={cn(
            "h-11 text-sm font-semibold border-b-2 transition-colors duration-150",
            pestania === id ? "border-teal-600 text-teal-700" : "border-transparent text-stone-500 hover:text-stone-800"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const botonCancelarClase = (clase: string) => !motivo && (
    <button
      type="button"
      onClick={() => setEligiendoMotivo(true)}
      disabled={hayCambios}
      title={hayCambios ? 'Guardá o descartá los cambios antes de cancelar la clase.' : undefined}
      className={cn(BOTON_CANCELAR_CLASE, clase)}
    >
      <Ban size={16} /> Cancelar clase
    </button>
  );

  const pie = pestania === 'asistencia' ? (
    <>
      {botonCancelarClase("hidden md:flex md:mr-auto")}
      <button type="button" onClick={onClose} className={BOTON_PIE_SECUNDARIO}>Cancelar</button>
      <button type="button" onClick={handleGuardar} disabled={saving || !hayCambios || b.hayPreguntas} className={BOTON_PIE_PRIMARIO}>
        {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
        {hayCambios ? 'Guardar' : 'Sin cambios'}
      </button>
    </>
  ) : (
    <button type="button" onClick={onClose} className={BOTON_PIE_SECUNDARIO}>Cerrar</button>
  );

  return (
    <Modal
      titulo={`Clase de las ${celda.hora}`}
      subtitulo={<><span className="capitalize">{diaLabel}</span> · {resumenLugares}</>}
      onCerrar={onClose}
      debajoDelTitulo={pestanias}
      pie={pie}
      ancho="2xl"
      pantallaCompleta
    >
      {pestania === 'inscripcion' ? (
        <TpaInscripcion celda={celda} todosPacientes={todosPacientes} onCambio={onGuardado} />
      ) : ocupando !== undefined ? (
        <TpaOcuparSelector
          celda={celda}
          enLaClase={enLaClase}
          lugarDe={ocupando ? nombreDe(ocupando) : null}
          saldos={saldos}
          pacientes={todosPacientes}
          horarios={datosRec?.horarios ?? []}
          historial={historial}
          ahora={abiertoEn}
          completa={lugares.libres === 0}
          onElegir={(opcion, avisoOrigen) => { b.agregar(opcion, ocupando, avisoOrigen); setOcupando(undefined); }}
          onVolver={() => setOcupando(undefined)}
        />
      ) : (
        <>
          <TpaAsistenciaLista
            filas={b.filas}
            lugares={lugares}
            cupo={celda.cupo}
            claseFutura={claseFutura}
            sugerencia={sugerencia}
            motivoCancelacion={motivo}
            enlaces={enlaces}
            preguntas={b.preguntas}
            onCambiar={b.cambiarEstado}
            onOcupar={setOcupando}
            onQuitar={b.quitar}
            onCambiarTipo={b.cambiarTipo}
            onResolver={b.resolver}
            onIrAInscripcion={() => setPestania('inscripcion')}
            onReactivar={() => setConfirmandoReactivar(true)}
          />
          {/* En el celular, "Cancelar clase" va al final de la lista (el pie solo tiene Cancelar y Guardar). */}
          <div className="px-4 pb-4 md:hidden">{botonCancelarClase("w-full")}</div>
        </>
      )}

      {eligiendoMotivo && (
        <TpaCancelarDialog
          titulo={`¿Cancelar la clase de las ${celda.hora}?`}
          subtitulo={diaLabel}
          cargando={cambiandoCancelacion}
          onElegir={cambiarCancelacion}
          onCerrar={() => setEligiendoMotivo(false)}
        />
      )}
      <ConfirmDialog
        abierto={confirmandoReactivar}
        titulo={`¿Reactivar la clase de las ${celda.hora}?`}
        mensaje={<p>La clase vuelve a darse: las asistencias que estaban cargadas vuelven a contar y deja de generar recuperaciones.</p>}
        textoConfirmar="Reactivar clase"
        cargando={cambiandoCancelacion}
        onConfirmar={() => cambiarCancelacion(null)}
        onCancelar={() => setConfirmandoReactivar(false)}
      />
    </Modal>
  );
}
