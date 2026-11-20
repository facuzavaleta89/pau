"use client";

import { useCallback, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { borrarHorarioTPA, cambiarHorarioTPA, cargarDatosHorarios, deactivateHorarioTPA, deshacerBajaHorarioTPA } from '@/lib/queries';
import { conflictoAlReactivar, motivosParaNoBorrar, textoHorario } from '@/lib/horarios';
import { hoyArgentina, diaYMes } from '@/lib/pagos';
import { CUPO_TPA } from '@/lib/tpa';
import { mensajeErrorAlGuardar, registrarError } from '@/lib/errores';
import { cn, nuevoId } from '@/lib/utils';
import type { HorarioTPA } from '@/types';
import { useDatos } from '@/hooks/useDatos';
import { useToast } from '@/components/ui/ToastProvider';
import { Modal, BOTON_PIE_PRIMARIO, BOTON_PIE_SECUNDARIO } from '@/components/ui/Modal';
import { EstadoCarga } from '@/components/ui/EstadoCarga';
import { OpcionCorregir, type Opcion } from './OpcionCorregir';
import { TpaCambiarHorario, leerDestino, type ValorCambio } from './TpaCambiarHorario';

interface TpaCorregirFijoDialogProps {
  horario: HorarioTPA;
  onCerrar: () => void;
  /** Se guardó: recargar. */
  onHecho: () => void;
}

type Accion = 'baja' | 'cambiar' | 'borrar' | 'deshacer';

const BOTON: Record<Accion, string> = {
  baja: 'Dar de baja desde hoy',
  cambiar: 'Cambiar de horario',
  borrar: 'Borrar el horario',
  deshacer: 'Deshacer la baja',
};

const EXITO: Record<Accion, string> = {
  baja: 'Alumno desinscripto',
  cambiar: 'Horario cambiado',
  borrar: 'Horario borrado',
  deshacer: 'Baja deshecha: vuelve a ser fijo',
};

// Quitar un fijo (activo): "Deja de venir" (baja desde hoy), "Cambiar de
// horario" (desde una fecha, a otro con lugar: TpaCambiarHorario) o "Lo cargué
// por error" (borrar). Un horario dado de baja: "Deshacer la baja" o "Lo cargué
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
  const [cambio, setCambio] = useState<{ valor: ValorCambio; listo: boolean }>({ valor: { desde: hoy, destino: '' }, listo: false });
  // Id del horario nuevo, generado al abrir: reintentar después de un corte no duplica.
  const [idNuevo] = useState(nuevoId);

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
      }, {
        id: 'cambiar',
        titulo: 'Cambiar de horario',
        detalle: 'Pasa a otro día u hora (por ejemplo, porque se liberó un lugar) desde la fecha que elijas. Hasta esa fecha sigue en este.',
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
  const destino = leerDestino(cambio.valor.destino);
  const puedeConfirmar = seleccion !== null && (seleccion !== 'cambiar' || (cambio.listo && destino !== null));

  const confirmar = async () => {
    if (!seleccion || !puedeConfirmar) return;
    setGuardando(true);
    setErrorGuardar(null);
    try {
      if (seleccion === 'baja') await deactivateHorarioTPA(horario);
      else if (seleccion === 'cambiar' && destino) await cambiarHorarioTPA(horario.id, idNuevo, destino, cambio.valor.desde);
      else if (seleccion === 'borrar') await borrarHorarioTPA(horario.id);
      else await deshacerBajaHorarioTPA(horario.id);
      toast.exito(seleccion === 'cambiar' && destino
        ? `${EXITO.cambiar}: desde el ${diaYMes(cambio.valor.desde)}, ${textoHorario({ dia_semana: destino.dia, hora: destino.hora })}`
        : EXITO[seleccion]);
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
          <button type="button" onClick={confirmar} disabled={!puedeConfirmar || guardando}
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
        {opciones && seleccion === 'cambiar' && (
          <TpaCambiarHorario horario={horario} valor={cambio.valor} onCambiar={(valor, listo) => setCambio({ valor, listo })} />
        )}
        {errorGuardar && (
          <p role="alert" className="text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">{errorGuardar}</p>
        )}
      </div>
    </Modal>
  );
}
