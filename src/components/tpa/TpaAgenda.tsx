"use client";

import { useCallback, useMemo, useState } from 'react';
import { addDays, addWeeks, format, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { cargarSemanaTPA } from '@/lib/queries';
import { armarSemanaTPA, DIAS_TPA, diaTPAInicial } from '@/lib/tpa';
import { useDatos } from '@/hooks/useDatos';
import { useEsCelular } from '@/hooks/useEsCelular';
import { SemanaNav } from '@/components/ui/SemanaNav';
import { EstadoCarga } from '@/components/ui/EstadoCarga';
import { HistoriaClinicaModal } from '@/components/pacientes/HistoriaClinicaModal';
import type { DiaSemana } from '@/types';
import { TpaGrillaSemana } from './TpaGrillaSemana';
import { TpaListaDia } from './TpaListaDia';
import { TpaClaseModal } from './TpaClaseModal';

// Agenda TPA: carga la semana una vez y la muestra como grilla (compu) o
// como lista por día (celular). El modal de la clase también vive acá.
export function TpaAgenda() {
  const esCelular = useEsCelular();
  const inicial = useMemo(() => diaTPAInicial(new Date()), []);
  const [semanaInicio, setSemanaInicio] = useState(inicial.semana);
  const [dia, setDia] = useState<DiaSemana>(inicial.dia);
  const [claveAbierta, setClaveAbierta] = useState<string | null>(null);
  const [pacienteHistoria, setPacienteHistoria] = useState<string | null>(null);

  const desde = format(semanaInicio, 'yyyy-MM-dd');
  const cargar = useCallback(
    () => cargarSemanaTPA(desde, format(addDays(semanaInicio, 6), 'yyyy-MM-dd')),
    [desde, semanaInicio]
  );
  const { datos, cargando, error, recargar } = useDatos(desde, cargar, 'No se pudo cargar la agenda TPA.');

  const semana = useMemo(() => (datos ? armarSemanaTPA(semanaInicio, datos) : null), [datos, semanaInicio]);

  // La celda abierta se busca en la semana actual: si se recargan los datos,
  // el modal ve los cambios sin perder su estado (pestaña, marcas sin guardar).
  const celdaAbierta = useMemo(() => {
    if (!semana || !claveAbierta) return null;
    for (const d of DIAS_TPA) {
      const celda = semana[d.id].find((c) => c.clave === claveAbierta);
      if (celda) return celda;
    }
    return null;
  }, [semana, claveAbierta]);

  const irAHoy = () => {
    const hoy = diaTPAInicial(new Date());
    setSemanaInicio(hoy.semana);
    setDia(hoy.dia);
  };

  const etiqueta = `${format(semanaInicio, 'd MMM', { locale: es })} – ${format(addDays(semanaInicio, 6), 'd MMM yyyy', { locale: es })}`;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="md:max-w-md">
        <SemanaNav
          etiqueta={etiqueta}
          onAnterior={() => setSemanaInicio(subWeeks(semanaInicio, 1))}
          onHoy={irAHoy}
          onSiguiente={() => setSemanaInicio(addWeeks(semanaInicio, 1))}
        />
      </div>

      {!semana || esCelular === null ? (
        <EstadoCarga cargando={cargando || esCelular === null} error={error} onReintentar={recargar} />
      ) : esCelular ? (
        <TpaListaDia
          semana={semana}
          dia={dia}
          onCambiarDia={setDia}
          onAbrir={(c) => setClaveAbierta(c.clave)}
          onAbrirPaciente={setPacienteHistoria}
        />
      ) : (
        <TpaGrillaSemana semana={semana} onAbrir={(c) => setClaveAbierta(c.clave)} onAbrirPaciente={setPacienteHistoria} />
      )}

      {celdaAbierta && (
        <TpaClaseModal
          key={celdaAbierta.clave}
          celda={celdaAbierta}
          onClose={() => setClaveAbierta(null)}
          onGuardado={recargar}
        />
      )}

      <HistoriaClinicaModal
        isOpen={pacienteHistoria !== null}
        onClose={() => setPacienteHistoria(null)}
        pacienteId={pacienteHistoria}
      />
    </div>
  );
}
