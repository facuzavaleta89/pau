"use client";

import { useCallback, useMemo, useState } from 'react';
import { addDays, addMonths, addWeeks, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, CalendarRange, Clock, Plus } from 'lucide-react';
import { armarMesAgenda, armarSemanaAgenda, eventosEntre, rangoVista, type Vista } from '@/lib/agenda';
import { cargarAgenda } from '@/lib/queries';
import { hoyArgentina } from '@/lib/pagos';
import { cn } from '@/lib/utils';
import { useAhora } from '@/hooks/useAhora';
import { useDatos } from '@/hooks/useDatos';
import { useDatosClaseTPA } from '@/hooks/useDatosClaseTPA';
import { EstadoCarga } from '@/components/ui/EstadoCarga';
import { Pestanias } from '@/components/ui/Pestanias';
import { SemanaNav } from '@/components/ui/SemanaNav';
import type { AccionesAgenda } from './acciones';
import { AgendaDia } from './AgendaDia';
import { AgendaMes } from './AgendaMes';
import { AgendaModales, type ModalAgenda } from './AgendaModales';
import { AgendaSemana } from './AgendaSemana';

const MOVER: Record<Vista, (fecha: Date, n: number) => Date> = { dia: addDays, semana: addWeeks, mes: addMonths };
const TEXTO_NAV: Record<Vista, [string, string]> = {
  dia: ['Día anterior', 'Día siguiente'],
  semana: ['Semana anterior', 'Semana siguiente'],
  mes: ['Mes anterior', 'Mes siguiente'],
};

// Agenda (/agenda): turnos individuales y clases de TPA en Día | Semana | Mes.
// Arranca en Semana, en la fecha de hoy (hora argentina, nunca la del deploy).
export function PantallaAgenda() {
  const ahora = useAhora();
  if (!ahora) return <EstadoCarga cargando error={null} onReintentar={() => undefined} />;
  return <ContenidoAgenda ahora={ahora} />;
}

function ContenidoAgenda({ ahora }: { ahora: Date }) {
  const hoy = hoyArgentina(ahora);
  const [vista, setVista] = useState<Vista>('semana');
  const [fecha, setFecha] = useState(() => parseISO(hoy));
  const [abierto, setAbierto] = useState<ModalAgenda | null>(null);
  const [pacienteHistoria, setPacienteHistoria] = useState<string | null>(null);

  const { desde, hasta } = rangoVista(vista, fecha);
  const cargar = useCallback(() => cargarAgenda(desde, hasta), [desde, hasta]);
  const { datos, cargando, error, recargar } = useDatos(`${desde}_${hasta}`, cargar, 'No se pudo cargar la agenda.');
  const apoyo = useDatosClaseTPA(ahora);
  const recargarApoyo = apoyo.recargar;
  const recargarTodo = useCallback(() => { recargar(); recargarApoyo(); }, [recargar, recargarApoyo]);

  const eventos = useMemo(() => (datos ? eventosEntre(desde, hasta, datos) : []), [datos, desde, hasta]);
  const semana = useMemo(() => (datos && vista === 'semana' ? armarSemanaAgenda(fecha, datos) : null), [datos, vista, fecha]);
  const mes = useMemo(() => (datos && vista === 'mes' ? armarMesAgenda(fecha, datos) : null), [datos, vista, fecha]);
  const celdaAbierta = abierto?.tipo === 'clase'
    ? eventos.flatMap((e) => (e.tipo === 'clase' && e.clave === abierto.clave ? [e.celda] : []))[0] ?? null
    : null;

  const acciones: AccionesAgenda = {
    onNuevoTurno: (f, hora) => setAbierto({ tipo: 'turno', turno: null, fecha: f, hora }),
    onEditarTurno: (turno) => setAbierto({ tipo: 'turno', turno }),
    onAbrirClase: (celda, ocupar = false) => setAbierto({ tipo: 'clase', clave: celda.clave, ocupar }),
    onAbrirPaciente: setPacienteHistoria,
    onAbrirDia: (f) => { setFecha(parseISO(f)); setVista('dia'); },
    alertaDe: apoyo.alertaDe,
  };

  const etiqueta = vista === 'dia'
    ? format(fecha, "EEE d 'de' MMMM", { locale: es })
    : vista === 'semana'
      ? `${format(parseISO(desde), 'd MMM', { locale: es })} – ${format(parseISO(hasta), 'd MMM yyyy', { locale: es })}`
      : format(fecha, 'MMMM yyyy', { locale: es });

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <Pestanias
          etiqueta="Vista de la agenda"
          activa={vista}
          onCambiar={setVista}
          pestanias={[
            { id: 'dia', label: 'Día', icono: Clock },
            { id: 'semana', label: 'Semana', icono: CalendarRange },
            { id: 'mes', label: 'Mes', icono: CalendarDays },
          ]}
        />
        <div className="flex items-center gap-3 lg:flex-1">
          <div className="flex-1 md:flex-none md:w-md">
            <SemanaNav
              etiqueta={etiqueta}
              onAnterior={() => setFecha(MOVER[vista](fecha, -1))}
              onHoy={() => setFecha(parseISO(hoy))}
              onSiguiente={() => setFecha(MOVER[vista](fecha, 1))}
              textoAnterior={TEXTO_NAV[vista][0]}
              textoSiguiente={TEXTO_NAV[vista][1]}
            />
          </div>
          <button
            type="button"
            onClick={() => acciones.onNuevoTurno(vista === 'dia' ? desde : hoy)}
            aria-label="Nuevo turno"
            className="h-11 shrink-0 bg-teal-600 hover:bg-teal-700 text-white px-3 md:px-4 rounded-lg text-sm font-medium transition-colors duration-150 flex items-center gap-2 lg:ml-auto"
          >
            <Plus size={16} aria-hidden="true" /> <span className="hidden md:inline">Nuevo turno</span>
          </button>
        </div>
      </div>

      {!datos ? (
        <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} />
      ) : (
        <div className={cn('transition-opacity duration-150', cargando && 'opacity-60')} aria-busy={cargando}>
          {vista === 'dia' && <AgendaDia fecha={desde} eventos={eventos} acciones={acciones} />}
          {semana && <AgendaSemana semana={semana} hoy={hoy} acciones={acciones} />}
          {mes && <AgendaMes semanas={mes} hoy={hoy} acciones={acciones} />}
        </div>
      )}

      <AgendaModales
        abierto={abierto}
        celda={celdaAbierta}
        datosRec={apoyo.datosRec}
        filasAlertas={apoyo.filasAlertas}
        pacienteHistoria={pacienteHistoria}
        onCerrar={() => setAbierto(null)}
        onCerrarHistoria={() => setPacienteHistoria(null)}
        onGuardadoTurno={recargar}
        onGuardadoClase={recargarTodo}
      />
    </div>
  );
}
