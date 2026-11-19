"use client";

import { useCallback, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cargarHoy } from '@/lib/queries';
import { conMayuscula, hoyArgentina } from '@/lib/pagos';
import { clasesDelDia } from '@/lib/tpa';
import { useAhora } from '@/hooks/useAhora';
import { useDatos } from '@/hooks/useDatos';
import { useDatosClaseTPA } from '@/hooks/useDatosClaseTPA';
import { EstadoCarga } from '@/components/ui/EstadoCarga';
import { HistoriaClinicaModal } from '@/components/pacientes/HistoriaClinicaModal';
import { TurnoModal } from '@/components/rpg/TurnoModal';
import { TpaClaseModal } from '@/components/tpa/TpaClaseModal';
import type { SesionRPG } from '@/types';
import { HoyClases } from './HoyClases';
import { HoyCumpleanios } from './HoyCumpleanios';
import { HoyTurnos } from './HoyTurnos';

interface ClaseAbierta {
  clave: string;
  abrirOcupar: boolean;
}

// Entrada de la app: cumpleaños, turnos individuales y clases de TPA de hoy
// (hora argentina). Si queda abierta de un día para el otro, pasa sola al día nuevo.
export function PantallaHoy() {
  const ahora = useAhora();
  if (!ahora) {
    return (
      <div className="space-y-6 md:space-y-8">
        <h1 className="text-2xl font-semibold text-stone-900">Hoy</h1>
        <EstadoCarga cargando error={null} onReintentar={() => undefined} />
      </div>
    );
  }
  return <ContenidoHoy ahora={ahora} />;
}

function ContenidoHoy({ ahora }: { ahora: Date }) {
  const hoy = hoyArgentina(ahora);
  const [turnoAbierto, setTurnoAbierto] = useState<{ turno: SesionRPG | null } | null>(null);
  const [claseAbierta, setClaseAbierta] = useState<ClaseAbierta | null>(null);
  const [pacienteHistoria, setPacienteHistoria] = useState<string | null>(null);

  const cargar = useCallback(() => cargarHoy(hoy), [hoy]);
  const { datos, cargando, error, recargar } = useDatos(hoy, cargar, 'No se pudo cargar la pantalla de hoy.');
  const apoyo = useDatosClaseTPA(ahora);
  const recargarApoyo = apoyo.recargar;
  const recargarTodo = useCallback(() => { recargar(); recargarApoyo(); }, [recargar, recargarApoyo]);

  const clases = useMemo(() => (datos ? clasesDelDia(hoy, datos.semana) : []), [datos, hoy]);
  // Se busca en los datos actuales: al recargar, el modal ve los cambios sin perder lo marcado.
  const celdaAbierta = claseAbierta ? clases.find((c) => c.clave === claseAbierta.clave) ?? null : null;

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Hoy</h1>
        <p className="text-stone-600 mt-1 text-sm">{conMayuscula(format(parseISO(hoy), "EEEE d 'de' MMMM", { locale: es }))}</p>
      </div>

      {!datos ? (
        <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} />
      ) : (
        <>
          <HoyCumpleanios pacientes={datos.pacientes} hoy={hoy} onAbrirPaciente={setPacienteHistoria} />
          <HoyTurnos
            sesiones={datos.sesiones}
            onNuevoTurno={() => setTurnoAbierto({ turno: null })}
            onEditarTurno={(turno) => setTurnoAbierto({ turno })}
            onAbrirPaciente={setPacienteHistoria}
          />
          <HoyClases
            clases={clases}
            ahora={ahora}
            onAbrir={(c) => setClaseAbierta({ clave: c.clave, abrirOcupar: false })}
            onOcupar={(c) => setClaseAbierta({ clave: c.clave, abrirOcupar: true })}
            onAbrirPaciente={setPacienteHistoria}
            alertaDe={apoyo.alertaDe}
          />
        </>
      )}

      {turnoAbierto && (
        <TurnoModal
          onClose={() => setTurnoAbierto(null)}
          turno={turnoAbierto.turno}
          selectedDate={parseISO(hoy)}
          onSave={recargar}
        />
      )}

      {celdaAbierta && claseAbierta && (
        <TpaClaseModal
          key={celdaAbierta.clave}
          celda={celdaAbierta}
          datosRec={apoyo.datosRec}
          filasAlertas={apoyo.filasAlertas}
          abrirOcupar={claseAbierta.abrirOcupar}
          onClose={() => setClaseAbierta(null)}
          onGuardado={recargarTodo}
        />
      )}

      <HistoriaClinicaModal
        isOpen={pacienteHistoria !== null}
        onClose={() => setPacienteHistoria(null)}
        pacienteId={pacienteHistoria}
        onCambioPaciente={recargarTodo}
      />
    </div>
  );
}
