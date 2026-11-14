"use client";

import { useCallback, useMemo, useState } from 'react';
import { cargarPagosMes } from '@/lib/queries';
import {
  calcularPagosDelMes, calendarioDelMes, conMayuscula, formatoPesos, hoyArgentina, medioSugerido, moverMes, nombreMes,
  primerDia, type CeldaCalendario,
} from '@/lib/pagos';
import { DIAS_TPA, diaTPAInicial } from '@/lib/tpa';
import type { DiaSemana } from '@/types';
import { cn } from '@/lib/utils';
import { useDatos } from '@/hooks/useDatos';
import { SemanaNav } from '@/components/ui/SemanaNav';
import { EstadoCarga } from '@/components/ui/EstadoCarga';
import { AvisoPrecios } from '@/components/pagos/AvisoPrecios';
import { CobrarCuota } from '@/components/pagos/CobrarCuota';
import { TpaCalendarioCelda } from './TpaCalendarioCelda';
import { TpaInscribirFijo } from './TpaInscribirFijo';

interface TpaCalendarioProps {
  onAbrirPaciente: (pacienteId: string) => void;
  /** Se inscribió o desinscribió un fijo: recargar también la semana. */
  onCambioFijos: () => void;
}

// Calendario general del mes (diseño 4.2): Lun / Mié / Vie × horarios × 4
// lugares, con los fijos en verde (pagó) o rosa (no pagó) y los libres con
// "+ Inscribir fijo". Compu: grilla; celular: selector de día + cards.
export function TpaCalendario({ onAbrirPaciente, onCambioFijos }: TpaCalendarioProps) {
  const [hoy] = useState(() => hoyArgentina(new Date()));
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [dia, setDia] = useState<DiaSemana>(() => diaTPAInicial(new Date()).dia);
  const [cobrando, setCobrando] = useState<string | null>(null);
  const [inscribiendo, setInscribiendo] = useState<{ dia: DiaSemana; hora: string } | null>(null);

  const cargar = useCallback(() => cargarPagosMes(mes), [mes]);
  const { datos, cargando, error, recargar } = useDatos(`calendario_${mes}`, cargar, 'No se pudo cargar el calendario.');
  const calculo = useMemo(() => (datos ? calcularPagosDelMes(datos, hoy) : null), [datos, hoy]);
  const filas = useMemo(() => (datos && calculo ? calendarioDelMes(datos.horarios, calculo.cuotas, mes) : null), [datos, calculo, mes]);

  // Se buscan en los datos actuales: al recargar, los modales ven los cambios.
  const cuota = calculo?.cuotas.find((c) => c.pacienteId === cobrando) ?? null;
  const celdaInscribir = inscribiendo && filas
    ? filas.find((f) => f.hora === inscribiendo.hora)?.celdas[inscribiendo.dia] ?? null
    : null;

  const fijos = calculo?.cuotas.filter((c) => c.fijo) ?? [];
  const pagaron = fijos.filter((c) => c.pago).length;
  const faltaCobrar = fijos.reduce((n, c) => n + c.importePendiente, 0);
  const celda = (c: CeldaCalendario | null, conHora = false) => c && (
    <TpaCalendarioCelda celda={c} conHora={conHora} onCobrar={setCobrando} onInscribir={(x) => setInscribiendo({ dia: x.dia, hora: x.hora })} />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="md:w-80">
          <SemanaNav
            etiqueta={conMayuscula(nombreMes(mes))}
            onAnterior={() => setMes(moverMes(mes, -1))}
            onHoy={() => setMes(hoy.slice(0, 7))}
            onSiguiente={() => setMes(moverMes(mes, 1))}
            textoAnterior="Mes anterior"
            textoSiguiente="Mes siguiente"
          />
        </div>
        {calculo && (
          <p className="text-sm text-stone-600">
            Pagaron <span className="font-semibold text-stone-900">{pagaron} de {fijos.length}</span>
            {' · '}Falta cobrar <span className="font-semibold text-pink-700">{formatoPesos(faltaCobrar)}</span>
          </p>
        )}
      </div>

      {!calculo || !filas ? (
        <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} />
      ) : (
        <>
          <AvisoPrecios mes={mes} vigentes={calculo.vigentes} onGuardado={recargar} />

          {/* Compu: grilla horarios × días. */}
          <div className="hidden md:grid grid-cols-[4rem_repeat(3,minmax(0,1fr))] gap-3 lg:gap-4">
            <div />
            {DIAS_TPA.map((d) => (
              <div key={d.id} className="text-center pb-1.5 border-b-2 border-stone-200 text-base font-semibold text-stone-900">
                {d.label}
              </div>
            ))}
            {filas.map((fila) => (
              <div key={fila.hora} className="contents">
                <div className="pt-3 text-right text-sm font-semibold text-stone-700">{fila.hora}</div>
                {DIAS_TPA.map((d) => (
                  <div key={d.id}>
                    {celda(fila.celdas[d.id]) ?? (
                      <div className="h-full min-h-16 rounded-xl border border-dashed border-stone-200 flex items-center justify-center text-xs text-stone-400">Sin clase</div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Celular: selector de día + cards. */}
          <div className="md:hidden space-y-3">
            <div role="tablist" aria-label="Día" className="grid grid-cols-3 gap-2">
              {DIAS_TPA.map((d) => (
                <button key={d.id} type="button" role="tab" aria-selected={d.id === dia} onClick={() => setDia(d.id)}
                  className={cn('h-11 rounded-lg border text-sm font-semibold transition-colors duration-150',
                    d.id === dia ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-stone-200 text-stone-600')}>
                  {d.corto}
                </button>
              ))}
            </div>
            {filas.map((fila) => fila.celdas[dia] && <div key={fila.hora}>{celda(fila.celdas[dia], true)}</div>)}
          </div>
        </>
      )}

      {cuota && (
        <CobrarCuota
          key={cuota.pacienteId}
          cuota={cuota}
          mes={mes}
          precios={calculo?.vigentes?.precios ?? null}
          medioSugerido={medioSugerido(datos?.pagos ?? [], cuota.pacienteId)}
          onCerrar={() => setCobrando(null)}
          onGuardado={recargar}
          onAbrirPaciente={(id) => { setCobrando(null); onAbrirPaciente(id); }}
        />
      )}
      {celdaInscribir && (
        <TpaInscribirFijo
          celda={celdaInscribir}
          fechaAltaInicial={primerDia(mes)}
          onCerrar={() => setInscribiendo(null)}
          onCambio={() => { recargar(); onCambioFijos(); }}
        />
      )}
    </div>
  );
}
