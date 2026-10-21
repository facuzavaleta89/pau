"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  createClaseTPA, upsertAsistenciaTPA, deleteAsistenciaTPA, eliminarClaseTPASiVacia, getPacientesActivos,
} from "@/lib/queries";
import { mensajeError, mensajeErrorAlGuardar, registrarError } from "@/lib/errores";
import type { AlumnoCeldaTPA, CeldaTPA, EstadoAsistenciaTPA, Paciente } from "@/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/ToastProvider";
import { Modal, BOTON_PIE_PRIMARIO, BOTON_PIE_SECUNDARIO } from "@/components/ui/Modal";
import { TpaAsistenciaLista } from "./TpaAsistenciaLista";
import { TpaInscripcion } from "./TpaInscripcion";

interface TpaClaseModalProps {
  celda: CeldaTPA;
  onClose: () => void;
  onGuardado: () => void; // recarga la semana
}

type Pestania = 'asistencia' | 'inscripcion';

// Se monta al abrir (con key = celda.clave), así que el estado arranca limpio
// cada vez. Si la semana se recarga con el modal abierto (por ejemplo, al
// inscribir), `celda` cambia pero la pestaña y las marcas sin guardar se conservan.
export function TpaClaseModal({ celda, onClose, onGuardado }: TpaClaseModalProps) {
  const toast = useToast();
  const [pestania, setPestania] = useState<Pestania>('asistencia');
  const [saving, setSaving] = useState(false);
  // Solo lo que Pau cambió y todavía no guardó, por paciente.
  const [ediciones, setEdiciones] = useState<Record<string, EstadoAsistenciaTPA>>({});
  const [todosPacientes, setTodosPacientes] = useState<Paciente[]>([]);

  useEffect(() => {
    getPacientesActivos()
      .then(setTodosPacientes)
      .catch((err: unknown) => {
        registrarError("Error cargando pacientes en el modal TPA", err);
        toast.error(`No se pudo cargar la lista de pacientes. ${mensajeError(err)}`);
      });
  }, [toast]);

  const estadoActual = (a: AlumnoCeldaTPA): EstadoAsistenciaTPA => ediciones[a.pacienteId] ?? a.estado;
  const aMarcar = celda.alumnos.filter(a => estadoActual(a) !== a.estado && estadoActual(a) !== 'pendiente');
  const aDesmarcar = celda.alumnos.filter(a => estadoActual(a) !== a.estado && estadoActual(a) === 'pendiente');
  const hayCambios = aMarcar.length + aDesmarcar.length > 0;

  // "Sin marcar" (pendiente) = no tener fila de asistencia. Al guardar:
  // - se marcan (upsert) los que pasan a un estado;
  // - se desmarcan (delete) los que vuelven a "Sin marcar";
  // - no se crea la clase si nadie quedó marcado, y se borra si quedó vacía.
  const handleGuardar = async () => {
    if (!hayCambios) return;
    setSaving(true);
    try {
      let claseId = celda.clase?.id;
      if (!claseId && aMarcar.length > 0) {
        claseId = (await createClaseTPA({ fecha: celda.fecha, hora: celda.hora })).id;
      }
      if (claseId) {
        const idClase = claseId;
        await Promise.all([
          ...aMarcar.map(a => upsertAsistenciaTPA({ clase_id: idClase, paciente_id: a.pacienteId, estado: estadoActual(a) })),
          ...aDesmarcar.map(a => deleteAsistenciaTPA(idClase, a.pacienteId)),
        ]);
        if (aDesmarcar.length > 0) await eliminarClaseTPASiVacia(idClase);
      }
      toast.exito('Asistencia guardada');
      onGuardado();
      onClose();
    } catch (error: unknown) {
      registrarError("Error guardando asistencia TPA", error);
      toast.error(mensajeErrorAlGuardar("No se pudo guardar la asistencia.", error));
      onGuardado(); // pudo guardarse una parte: recargar para mostrar lo que quedó
    } finally {
      setSaving(false);
    }
  };

  const diaLabel = format(parseISO(celda.fecha), "EEEE d 'de' MMMM", { locale: es });

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

  const pie = pestania === 'asistencia' ? (
    <>
      <button type="button" onClick={onClose} className={BOTON_PIE_SECUNDARIO}>Cancelar</button>
      <button type="button" onClick={handleGuardar} disabled={saving || !hayCambios} className={BOTON_PIE_PRIMARIO}>
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
      subtitulo={<span className="capitalize">{diaLabel}</span>}
      onCerrar={onClose}
      debajoDelTitulo={pestanias}
      pie={pie}
      pantallaCompleta
    >
      {pestania === 'asistencia' ? (
        <TpaAsistenciaLista
          alumnos={celda.alumnos}
          estadoActual={estadoActual}
          onCambiar={(pacienteId, estado) => setEdiciones(prev => ({ ...prev, [pacienteId]: estado }))}
          onIrAInscripcion={() => setPestania('inscripcion')}
        />
      ) : (
        <TpaInscripcion celda={celda} todosPacientes={todosPacientes} onCambio={onGuardado} />
      )}
    </Modal>
  );
}
