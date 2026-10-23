"use client";

import { useCallback, useMemo, useState } from 'react';
import { addDays, addWeeks, format, parseISO, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { RotateCcw } from 'lucide-react';
import { cambiarCancelacionTPA, cargarDatosRecuperaciones, cargarSemanaTPA } from '@/lib/queries';
import { armarSemanaTPA, DIAS_TPA, diaTPAInicial, inicioDeSemana } from '@/lib/tpa';
import { calcularRecuperaciones } from '@/lib/recuperaciones';
import { mensajeErrorAlGuardar, registrarError } from '@/lib/errores';
import { MOTIVOS_CANCELACION } from '@/lib/estados';
import { cn } from '@/lib/utils';
import { useDatos } from '@/hooks/useDatos';
import { useEsCelular } from '@/hooks/useEsCelular';
import { useToast } from '@/components/ui/ToastProvider';
import { SemanaNav } from '@/components/ui/SemanaNav';
import { EstadoCarga } from '@/components/ui/EstadoCarga';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { HistoriaClinicaModal } from '@/components/pacientes/HistoriaClinicaModal';
import type { CeldaTPA, DiaSemana, MotivoCancelacionTPA } from '@/types';
import { TpaGrillaSemana } from './TpaGrillaSemana';
import { TpaListaDia } from './TpaListaDia';
import { TpaClaseModal } from './TpaClaseModal';
import { TpaCancelarDialog } from './TpaCancelarDialog';
import { TpaRecuperaciones } from './TpaRecuperaciones';
import type { AccionesSemanaTPA } from './TpaAccionesDia';
import type { OcupanteInicial } from './useBorradorClase';

type Pestania = 'semana' | 'recuperaciones';

interface ClaseAbierta {
  clave: string;
  abrirOcupar?: boolean;
  ocupante?: OcupanteInicial;
}

// Agenda TPA: pestañas Semana (grilla en la compu, lista por día en el
// celular) y Recuperaciones. El modal de la clase y cancelar el día viven acá.
export function TpaAgenda() {
  const toast = useToast();
  const esCelular = useEsCelular();
  const inicial = useMemo(() => diaTPAInicial(new Date()), []);
  const [hoy] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [pestania, setPestania] = useState<Pestania>('semana');
  const [semanaInicio, setSemanaInicio] = useState(inicial.semana);
  const [dia, setDia] = useState<DiaSemana>(inicial.dia);
  const [abierta, setAbierta] = useState<ClaseAbierta | null>(null);
  const [pacienteHistoria, setPacienteHistoria] = useState<string | null>(null);
  const [aCancelar, setACancelar] = useState<CeldaTPA[] | null>(null);
  const [aReactivar, setAReactivar] = useState<CeldaTPA[] | null>(null);
  const [procesandoDia, setProcesandoDia] = useState(false);

  const desde = format(semanaInicio, 'yyyy-MM-dd');
  const cargar = useCallback(
    () => cargarSemanaTPA(desde, format(addDays(semanaInicio, 6), 'yyyy-MM-dd')),
    [desde, semanaInicio]
  );
  const { datos, cargando, error, recargar } = useDatos(desde, cargar, 'No se pudo cargar la agenda TPA.');
  const rec = useDatos('recuperaciones', cargarDatosRecuperaciones, 'No se pudieron cargar las recuperaciones.');
  const recargarRec = rec.recargar;
  const recargarTodo = useCallback(() => { recargar(); recargarRec(); }, [recargar, recargarRec]);

  const semana = useMemo(() => (datos ? armarSemanaTPA(semanaInicio, datos) : null), [datos, semanaInicio]);
  const pendientes = useMemo(
    () => (rec.datos ? calcularRecuperaciones(hoy.slice(0, 7), rec.datos, hoy).reduce((n, s) => n + s.pendientes.length, 0) : 0),
    [rec.datos, hoy]
  );

  // La celda abierta se busca en la semana actual: si se recargan los datos,
  // el modal ve los cambios sin perder su estado (pestaña, marcas sin guardar).
  const celdaAbierta = useMemo(() => {
    if (!semana || !abierta) return null;
    for (const d of DIAS_TPA) {
      const celda = semana[d.id].find((c) => c.clave === abierta.clave);
      if (celda) return celda;
    }
    return null;
  }, [semana, abierta]);

  const irAHoy = () => {
    const h = diaTPAInicial(new Date());
    setSemanaInicio(h.semana);
    setDia(h.dia);
  };

  const cambiarDia = async (celdas: CeldaTPA[], motivo: MotivoCancelacionTPA | null) => {
    if (celdas.length === 0) return;
    setProcesandoDia(true);
    try {
      await cambiarCancelacionTPA(celdas[0].fecha, celdas.map((c) => c.hora), motivo);
      toast.exito(motivo ? `Día cancelado: ${MOTIVOS_CANCELACION[motivo]}` : 'Día reactivado');
      setACancelar(null);
      setAReactivar(null);
      recargarTodo();
    } catch (err: unknown) {
      registrarError('Error cambiando la cancelación del día TPA', err);
      toast.error(mensajeErrorAlGuardar(motivo ? 'No se pudo cancelar el día.' : 'No se pudo reactivar el día.', err));
    } finally {
      setProcesandoDia(false);
    }
  };

  const acciones: AccionesSemanaTPA = {
    onAbrir: (c) => setAbierta({ clave: c.clave }),
    onOcupar: (c) => setAbierta({ clave: c.clave, abrirOcupar: true }),
    onAbrirPaciente: setPacienteHistoria,
    onCancelarDia: setACancelar,
    onReactivarDia: setAReactivar,
  };

  // "Buscar lugar": ir a la semana de esa clase y abrirla con la persona ya agregada.
  const elegirLugar = (celda: CeldaTPA, persona: OcupanteInicial) => {
    setPestania('semana');
    setSemanaInicio(inicioDeSemana(parseISO(celda.fecha)));
    setDia(celda.dia);
    setAbierta({ clave: celda.clave, ocupante: persona });
  };

  const etiqueta = `${format(semanaInicio, 'd MMM', { locale: es })} – ${format(addDays(semanaInicio, 6), 'd MMM yyyy', { locale: es })}`;
  const fechaDia = (celdas: CeldaTPA[] | null) =>
    celdas?.[0] ? format(parseISO(celdas[0].fecha), "EEEE d 'de' MMMM", { locale: es }) : '';

  return (
    <div className="space-y-4 md:space-y-6">
      <div role="tablist" aria-label="Vista de TPA" className="flex gap-6 border-b border-stone-200">
        {([['semana', 'Semana'], ['recuperaciones', `Recuperaciones${pendientes ? ` (${pendientes})` : ''}`]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={pestania === id}
            onClick={() => setPestania(id)}
            className={cn(
              'h-11 text-sm font-semibold border-b-2 transition-colors duration-150',
              pestania === id ? 'border-teal-600 text-teal-700' : 'border-transparent text-stone-500 hover:text-stone-800'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {pestania === 'recuperaciones' ? (
        <TpaRecuperaciones
          datos={rec.datos}
          cargando={rec.cargando}
          error={rec.error}
          onReintentar={rec.recargar}
          hoy={hoy}
          onElegirLugar={elegirLugar}
          onAbrirPaciente={setPacienteHistoria}
        />
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="md:w-md">
              <SemanaNav
                etiqueta={etiqueta}
                onAnterior={() => setSemanaInicio(subWeeks(semanaInicio, 1))}
                onHoy={irAHoy}
                onSiguiente={() => setSemanaInicio(addWeeks(semanaInicio, 1))}
              />
            </div>
            {pendientes > 0 && (
              <button
                type="button"
                onClick={() => setPestania('recuperaciones')}
                className="self-start md:self-auto min-h-11 md:min-h-9 px-3 flex items-center gap-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-full"
              >
                <RotateCcw size={16} /> {pendientes} {pendientes === 1 ? 'pendiente' : 'pendientes'} de recuperar
              </button>
            )}
          </div>

          {!semana || esCelular === null ? (
            <EstadoCarga cargando={cargando || esCelular === null} error={error} onReintentar={recargar} />
          ) : esCelular ? (
            <TpaListaDia semana={semana} dia={dia} onCambiarDia={setDia} acciones={acciones} />
          ) : (
            <TpaGrillaSemana semana={semana} acciones={acciones} />
          )}
        </>
      )}

      {celdaAbierta && abierta && (
        <TpaClaseModal
          key={celdaAbierta.clave}
          celda={celdaAbierta}
          datosRec={rec.datos}
          abrirOcupar={abierta.abrirOcupar}
          ocupanteInicial={abierta.ocupante ?? null}
          onClose={() => setAbierta(null)}
          onGuardado={recargarTodo}
        />
      )}

      {aCancelar && (
        <TpaCancelarDialog
          titulo={`¿Cancelar el ${fechaDia(aCancelar)}?`}
          subtitulo={`${aCancelar.length} ${aCancelar.length === 1 ? 'clase' : 'clases'}: ${aCancelar.map((c) => c.hora).join(', ')}`}
          cargando={procesandoDia}
          onElegir={(motivo) => cambiarDia(aCancelar, motivo)}
          onCerrar={() => setACancelar(null)}
        />
      )}
      <ConfirmDialog
        abierto={aReactivar !== null}
        titulo={`¿Reactivar el ${fechaDia(aReactivar)}?`}
        mensaje={<p>Las {aReactivar?.length} clases canceladas vuelven a darse: lo que estaba cargado vuelve a contar y dejan de generar recuperaciones.</p>}
        textoConfirmar="Reactivar el día"
        cargando={procesandoDia}
        onConfirmar={() => aReactivar && cambiarDia(aReactivar, null)}
        onCancelar={() => setAReactivar(null)}
      />

      <HistoriaClinicaModal
        isOpen={pacienteHistoria !== null}
        onClose={() => setPacienteHistoria(null)}
        pacienteId={pacienteHistoria}
      />
    </div>
  );
}
