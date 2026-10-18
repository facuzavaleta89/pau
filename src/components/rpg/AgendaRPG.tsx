"use client";

import { useCallback, useState } from 'react';
import {
  addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subMonths, subWeeks,
} from 'date-fns';
import { getSesionesRPGPorRango } from '@/lib/queries';
import { useDatos } from '@/hooks/useDatos';
import { useEsCelular } from '@/hooks/useEsCelular';
import { EstadoCarga } from '@/components/ui/EstadoCarga';
import { HistoriaClinicaModal } from '@/components/pacientes/HistoriaClinicaModal';
import type { SesionRPG } from '@/types';
import { CalendarMonthView } from './CalendarMonthView';
import { RpgSemanaLista } from './RpgSemanaLista';
import { TurnoModal } from './TurnoModal';

const SEMANA = { weekStartsOn: 1 } as const;

// Agenda RPG: calendario mensual en la compu, lista de la semana en el celular.
// Carga los turnos del rango visible y maneja los modales de turno e historia.
export function AgendaRPG() {
  const esCelular = useEsCelular();
  const [fecha, setFecha] = useState(new Date());
  const [turnoModal, setTurnoModal] = useState<{ turno: SesionRPG | null; fecha?: Date } | null>(null);
  const [pacienteHistoria, setPacienteHistoria] = useState<string | null>(null);

  // Rango visible: la semana (celular) o el mes completo con los días de relleno (compu).
  const desde = esCelular ? startOfWeek(fecha, SEMANA) : startOfWeek(startOfMonth(fecha), SEMANA);
  const hasta = esCelular ? addDays(desde, 6) : endOfWeek(endOfMonth(fecha), SEMANA);
  const desdeStr = format(desde, 'yyyy-MM-dd');
  const hastaStr = format(hasta, 'yyyy-MM-dd');

  const cargar = useCallback(() => getSesionesRPGPorRango(desdeStr, hastaStr), [desdeStr, hastaStr]);
  const { datos, cargando, error, recargar } = useDatos(
    esCelular === null ? null : `${desdeStr}_${hastaStr}`,
    cargar,
    'No se pudo cargar la agenda RPG.'
  );

  const acciones = {
    onNuevoTurno: (dia?: Date) => setTurnoModal({ turno: null, fecha: dia }),
    onEditarTurno: (turno: SesionRPG) => setTurnoModal({ turno }),
    onAbrirPaciente: setPacienteHistoria,
  };

  return (
    <>
      {esCelular === null || (!datos && (cargando || error)) ? (
        <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} />
      ) : esCelular ? (
        <RpgSemanaLista
          inicioSemana={desde}
          sesiones={datos ?? []}
          onAnterior={() => setFecha(subWeeks(fecha, 1))}
          onHoy={() => setFecha(new Date())}
          onSiguiente={() => setFecha(addWeeks(fecha, 1))}
          {...acciones}
        />
      ) : (
        <CalendarMonthView
          mes={fecha}
          sesiones={datos ?? []}
          cargando={cargando}
          onAnterior={() => setFecha(subMonths(fecha, 1))}
          onHoy={() => setFecha(new Date())}
          onSiguiente={() => setFecha(addMonths(fecha, 1))}
          {...acciones}
        />
      )}

      <TurnoModal
        isOpen={turnoModal !== null}
        onClose={() => setTurnoModal(null)}
        turno={turnoModal?.turno ?? null}
        selectedDate={turnoModal?.fecha}
        onSave={recargar}
      />

      <HistoriaClinicaModal
        isOpen={pacienteHistoria !== null}
        onClose={() => setPacienteHistoria(null)}
        pacienteId={pacienteHistoria}
      />
    </>
  );
}
