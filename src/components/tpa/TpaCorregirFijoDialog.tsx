"use client";

import { useCallback, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { borrarHorarioTPA, cargarDatosHorarios, deactivateHorarioTPA, deshacerBajaHorarioTPA } from '@/lib/queries';
import { conflictoAlReactivar, motivosParaNoBorrar, textoHorario } from '@/lib/horarios';
import { hoyArgentina, diaYMes } from '@/lib/pagos';
import { CUPO_TPA } from '@/lib/tpa';
import { mensajeErrorAlGuardar, registrarError } from '@/lib/errores';
import { cn } from '@/lib/utils';
import type { HorarioTPA } from '@/types';
import { useDatos } from '@/hooks/useDatos';
import { useToast } from '@/components/ui/ToastProvider';
import { Modal, BOTON_PIE_PRIMARIO, BOTON_PIE_SECUNDARIO } from '@/components/ui/Modal';
import { EstadoCarga } from '@/components/ui/EstadoCarga';
import { OpcionCorregir, type Opcion } from './OpcionCorregir';

interface TpaCorregirFijoDialogProps {
  horario: HorarioTPA;
  onCerrar: () => void;
  /** Se guardó: recargar. */
  onHecho: () => void;
}

type Accion = 'baja' | 'borrar' | 'deshacer';

const BOTON: Record<Accion, string> = {
  baja: 'Dar de baja desde hoy',
  borrar: 'Borrar el horario',
  deshacer: 'Deshacer la baja',
};

const EXITO: Record<Accion, string> = {
  baja: 'Alumno desinscripto',
  borrar: 'Horario borrado',
  deshacer: 'Baja deshecha: vuelve a ser fijo',
};

// Quitar un fijo (activo): "Deja de venir" (baja desde hoy) o "Lo cargué por
// error" (borrar). Un horario dado de baja: "Deshacer la baja" o "Lo cargué
// por error". Lo que no se puede, deshabilitado y con el motivo
// (src/lib/horarios.ts). Se monta al abrir.
export function TpaCorregirFijoDialog({ horario, onCerrar, onHecho }: TpaCorregirFijoDialogProps) {
  const toast = useToast();
  const [hoy] = useState(() => hoyArgentina(new Date()));
  const cargar = useCallback(() => cargarDatosHorarios(horario.paciente_id, [horario.hora]), [horario.paciente_id, horario.hora]);
  const { datos, cargando, error, recargar } = useDatos(`corregir_${horario.id}`, cargar, 'No se pudo revisar el horario.');
  const [elegida, setElegida] = useState<Accion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);

  const nombre = horario.pacientes?.nombre ?? 'este alumno';
  const opciones = useMemo<Opcion<Accion>[] | null>(() => {
    if (!datos) return null;
    const borrar: Opcion<Accion> = {
      id: 'borrar',
      titulo: 'Lo cargué por error',
      detalle: 'Se borra el horario como si nunca hubiera existido: no aparece en ninguna semana ni en el calendario.',
      noSePuede: motivosParaNoBorrar(horario, datos, hoy),
      peligroso: true,
    };
    if (horario.activo) {
      return [{
        id: 'baja',
        titulo: 'Deja de venir',
        detalle: 'Deja de ser fijo desde hoy. Sus asistencias ya registradas no se borran.',
        noSePuede: [],
      }, borrar];
    }
    const conflicto = conflictoAlReactivar(horario, datos, { cupo: CUPO_TPA, hoy, pacienteActivo: horario.pacientes?.activo !== false });
    return [{
      id: 'deshacer',
      titulo: 'Deshacer la baja',
      detalle: `Vuelve a ser fijo ${textoHorario(horario)}, como si la baja del ${diaYMes(horario.fecha_baja ?? '')} no hubiera existido.`,
      noSePuede: conflicto ? [conflicto] : [],
    }, borrar];
  }, [datos, horario, hoy]);

  const seleccion = elegida && opciones?.find((o) => o.id === elegida && o.noSePuede.length === 0) ? elegida : null;

  const confirmar = async () => {
    if (!seleccion) return;
    setGuardando(true);
    setErrorGuardar(null);
    try {
      if (seleccion === 'baja') await deactivateHorarioTPA(horario);
      else if (seleccion === 'borrar') await borrarHorarioTPA(horario.id);
      else await deshacerBajaHorarioTPA(horario.id);
      toast.exito(EXITO[seleccion]);
      onHecho();
      onCerrar();
    } catch (err: unknown) {
      registrarError('Error corrigiendo un horario fijo', err);
      setErrorGuardar(mensajeErrorAlGuardar('No se pudo guardar el cambio.', err));
      recargar();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      titulo={`${nombre}: ${textoHorario(horario)}`}
      subtitulo={horario.activo ? '¿Qué pasó?' : `Dado de baja el ${diaYMes(horario.fecha_baja ?? '')}`}
      onCerrar={() => !guardando && onCerrar()}
      ancho="lg"
      capa={60}
      pie={
        <>
          <button type="button" onClick={onCerrar} disabled={guardando} className={BOTON_PIE_SECUNDARIO}>Cancelar</button>
          <button type="button" onClick={confirmar} disabled={!seleccion || guardando}
            className={cn(BOTON_PIE_PRIMARIO, seleccion === 'borrar' && 'bg-red-600 hover:bg-red-700')}>
            {guardando && <Loader2 size={16} className="animate-spin" />}
            {seleccion ? BOTON[seleccion] : 'Elegí una opción'}
          </button>
        </>
      }
    >
      <div className="p-4 md:p-6 space-y-3">
        {!opciones ? (
          <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} />
        ) : (
          <fieldset className="space-y-2">
            <legend className="sr-only">Qué hacer con el horario</legend>
            {opciones.map((o) => (
              <OpcionCorregir key={o.id} opcion={o} elegida={seleccion === o.id} onElegir={() => setElegida(o.id)} />
            ))}
          </fieldset>
        )}
        {errorGuardar && (
          <p role="alert" className="text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">{errorGuardar}</p>
        )}
      </div>
    </Modal>
  );
}
