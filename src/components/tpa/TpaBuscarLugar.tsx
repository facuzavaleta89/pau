"use client";

import { useCallback, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { cargarSemanaTPA } from "@/lib/queries";
import { celdasEntre, inicioDeSemana, textoLugares } from "@/lib/tpa";
import { claseCorta, lugaresParaRecuperar } from "@/lib/ocupar";
import { fechaVence } from "@/lib/recuperaciones";
import type { CeldaTPA, CreditoRecuperacion, SaldoRecuperaciones } from "@/types";
import { useDatos } from "@/hooks/useDatos";
import { EstadoCarga } from "@/components/ui/EstadoCarga";
import { Modal, BOTON_PIE_SECUNDARIO } from "@/components/ui/Modal";

interface TpaBuscarLugarProps {
  saldo: SaldoRecuperaciones;
  credito: CreditoRecuperacion;
  onElegir: (celda: CeldaTPA) => void;
  onCerrar: () => void;
}

// Lugares libres de esta semana y la siguiente donde puede recuperar (dentro
// del vencimiento; las de Pau no vencen). Elegir uno abre la clase con la
// persona ya agregada, para revisar y guardar.
export function TpaBuscarLugar({ saldo, credito, onElegir, onCerrar }: TpaBuscarLugarProps) {
  const [ahora] = useState(() => new Date());
  const hoy = format(ahora, 'yyyy-MM-dd');
  const hasta = format(addDays(inicioDeSemana(ahora), 13), 'yyyy-MM-dd'); // domingo de la semana siguiente
  const cargar = useCallback(() => cargarSemanaTPA(hoy, hasta), [hoy, hasta]);
  const { datos, cargando, error, recargar } = useDatos(`buscar_${hoy}`, cargar, 'No se pudieron cargar los lugares libres.');

  const lugares = useMemo(
    () => (datos ? lugaresParaRecuperar(celdasEntre(hoy, hasta, datos), saldo.pacienteId, credito, ahora) : null),
    [datos, hoy, hasta, saldo.pacienteId, credito, ahora]
  );

  return (
    <Modal
      titulo={`Buscar lugar para ${saldo.nombre}`}
      subtitulo={`${credito.texto}${credito.vence ? ` · vence el ${fechaVence(credito.vence)}` : ' · no vence'}`}
      onCerrar={onCerrar}
      ancho="lg"
      pie={<button type="button" onClick={onCerrar} className={BOTON_PIE_SECUNDARIO}>Cerrar</button>}
    >
      <div className="p-4 md:p-6">
        {!lugares ? (
          <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} />
        ) : lugares.length === 0 ? (
          <p className="text-sm text-stone-500 text-center py-8">
            No hay lugares libres esta semana ni la siguiente{credito.vence ? ' antes de que venza' : ''}.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100 border border-stone-200 rounded-xl">
            {lugares.map((c) => (
              <li key={c.clave} className="flex items-center gap-3 p-3">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-stone-900 capitalize">{claseCorta(c.fecha, c.hora)}</span>
                  <span className="block text-xs text-stone-500">{textoLugares(c.lugares, c.cupo)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onElegir(c)}
                  className="shrink-0 min-h-11 md:min-h-9 px-3 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg"
                >
                  Elegir
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
