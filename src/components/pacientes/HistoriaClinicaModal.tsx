"use client";

import { useCallback, useMemo, useState } from 'react';
import { NotebookPen, User, X } from 'lucide-react';
import { cargarHistoriaClinica } from '@/lib/queries';
import { alertasDeFaltas, textoAlertaFaltas } from '@/lib/alertas';
import { ALERTA_FALTAS } from '@/lib/estados';
import { cn } from '@/lib/utils';
import { useDatos } from '@/hooks/useDatos';
import { EstadoCarga } from '@/components/ui/EstadoCarga';
import { HistoriaFicha } from './HistoriaFicha';
import { HistoriaEvolucion } from './HistoriaEvolucion';

interface HistoriaClinicaModalProps {
  isOpen: boolean;
  onClose: () => void;
  pacienteId?: string | null;
}

type Pestania = 'ficha' | 'evolucion';

const PESTANIAS: { id: Pestania; label: string; icono: typeof User }[] = [
  { id: 'ficha', label: 'Ficha del paciente', icono: User },
  { id: 'evolucion', label: 'Evolución', icono: NotebookPen },
];

// Historia clínica: Ficha y Evolución (notas, asistencias de TPA y sesiones de
// RPG en una línea de tiempo, con la alerta de faltas y el resumen del mes).
// Se monta cada vez que se abre (y por paciente): siempre carga datos frescos
// y arranca en "Ficha".
export function HistoriaClinicaModal({ isOpen, onClose, pacienteId }: HistoriaClinicaModalProps) {
  if (!isOpen || !pacienteId) return null;
  return <HistoriaClinicaAbierta key={pacienteId} pacienteId={pacienteId} onClose={onClose} />;
}

function HistoriaClinicaAbierta({ pacienteId, onClose }: { pacienteId: string; onClose: () => void }) {
  const [activa, setActiva] = useState<Pestania>('ficha');
  const [ahora] = useState(() => new Date());

  const cargar = useCallback(() => cargarHistoriaClinica(pacienteId), [pacienteId]);
  const { datos: historia, cargando, error, recargar } = useDatos(pacienteId, cargar, 'No se pudo cargar la historia clínica.');
  const alerta = useMemo(
    () => (historia ? alertasDeFaltas(historia.asistencias, ahora).get(historia.paciente.id) ?? null : null),
    [historia, ahora]
  );
  const IconoAlerta = ALERTA_FALTAS.icono;

  return (
    <div className="fixed inset-0 z-[60] flex md:items-center justify-center md:p-4 bg-stone-900/50 backdrop-blur-sm">
      {/* Celular: pantalla completa. Compu: modal centrado. */}
      <div role="dialog" aria-modal="true" aria-label="Historia clínica" className="bg-white w-full h-[100dvh] md:h-[85vh] md:max-w-4xl md:border md:border-stone-200 md:rounded-2xl shadow-xl overflow-hidden flex flex-col text-stone-900">
        <div className="px-4 md:px-6 pb-3 md:py-5 pt-[max(0.75rem,env(safe-area-inset-top))] border-b border-stone-200 flex items-start justify-between gap-3 bg-white">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-lg md:text-xl font-bold text-stone-900 tracking-tight">
                {historia ? historia.paciente.nombre : 'Historia clínica'}
              </h2>
              {alerta && (
                <button
                  type="button"
                  onClick={() => setActiva('evolucion')}
                  className={cn('flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-semibold', ALERTA_FALTAS.clases)}
                >
                  <IconoAlerta className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
                  {textoAlertaFaltas(alerta)}
                </button>
              )}
            </div>
            {historia && (
              <p className="text-xs text-stone-600 mt-1">
                Clase: <span className="font-semibold text-teal-600 uppercase">{historia.paciente.tipo_clase || 'No asignada'}</span> • Edad: {historia.paciente.edad || 'No registrada'} años
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 -mr-2 h-11 w-11 flex items-center justify-center text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!historia ? (
          <div className="flex-1 flex items-center justify-center bg-stone-50 p-4">
            <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-stone-50">
            <div role="tablist" aria-label="Historia clínica" className="shrink-0 w-full md:w-56 bg-white border-b md:border-b-0 md:border-r border-stone-200 flex md:flex-col p-2 gap-1">
              {PESTANIAS.map(({ id: pid, label, icono: Icono }) => (
                <button
                  key={pid}
                  type="button"
                  role="tab"
                  aria-selected={activa === pid}
                  onClick={() => setActiva(pid)}
                  className={cn(
                    'flex-1 md:flex-none flex items-center justify-center md:justify-start gap-2.5 px-4 min-h-11 rounded-lg text-sm font-semibold transition-colors duration-150 md:w-full whitespace-nowrap',
                    activa === pid ? 'bg-teal-600 text-white shadow-sm' : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900'
                  )}
                >
                  <Icono className="w-4 h-4" />
                  {label}
                  {pid === 'evolucion' && alerta && activa !== pid && (
                    <span className="w-2 h-2 bg-red-500 rounded-full" aria-label="Tiene una alerta" />
                  )}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] bg-stone-50">
              {activa === 'ficha'
                ? <HistoriaFicha paciente={historia.paciente} />
                : <HistoriaEvolucion historia={historia} alerta={alerta} onCambio={recargar} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
