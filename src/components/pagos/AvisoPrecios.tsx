"use client";

import { useState } from 'react';
import { AlertTriangle, Pencil } from 'lucide-react';
import { conMayuscula, formatoPesos, nombreMes, type Mes, type PreciosVigentes } from '@/lib/pagos';
import { PreciosMesModal } from './PreciosMesModal';

interface AvisoPreciosProps {
  mes: Mes;
  vigentes: PreciosVigentes | null;
  onGuardado: () => void;
  /** Además del aviso, la línea con los precios y "Editar" (en /pagos). */
  conLinea?: boolean;
}

const BOTON =
  'min-h-11 md:min-h-9 px-3 flex items-center justify-center gap-1.5 text-sm font-medium rounded-lg border shrink-0';

// Aviso si el mes no tiene precios propios ("se usan los de octubre ·
// Cargar precios de noviembre") y, en /pagos, la línea de precios con "Editar".
export function AvisoPrecios({ mes, vigentes, onGuardado, conLinea = false }: AvisoPreciosProps) {
  const [editando, setEditando] = useState(false);
  const p = vigentes?.precios;
  const mesCorto = nombreMes(mes, false);

  const aviso = !vigentes
    ? `${conMayuscula(nombreMes(mes))} no tiene precios cargados: los importes quedan en $0 hasta que los cargues.`
    : vigentes.heredadoDe
      ? `${conMayuscula(mesCorto)} sin precios: se usan los de ${nombreMes(vigentes.heredadoDe, false)}.`
      : null;

  return (
    <>
      {aviso && (
        <div role="status" className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">
          <span className="flex items-start gap-2 flex-1">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" /> {aviso}
          </span>
          <button type="button" onClick={() => setEditando(true)} className={`${BOTON} text-amber-800 bg-white hover:bg-amber-100 border-amber-200`}>
            Cargar precios de {mesCorto}
          </button>
        </div>
      )}

      {conLinea && p && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-stone-600">
          <p className="flex-1">
            <span className="font-semibold text-stone-900">Precios{vigentes?.heredadoDe ? ` (de ${nombreMes(vigentes.heredadoDe, false)})` : ''}:</span>{' '}
            1 vez {formatoPesos(p.tpa_1_vez)} · 2 veces {formatoPesos(p.tpa_2_veces)} · 3 veces {formatoPesos(p.tpa_3_veces)} ·
            suelta {formatoPesos(p.tpa_suelta)} · RPG {formatoPesos(p.rpg_sesion)}
          </p>
          {!vigentes?.heredadoDe && (
            <button type="button" onClick={() => setEditando(true)} className={`${BOTON} self-start text-stone-700 bg-white hover:bg-stone-50 border-stone-200`}>
              <Pencil size={14} /> Editar
            </button>
          )}
        </div>
      )}

      {editando && (
        <PreciosMesModal mes={mes} base={p ?? null} onCerrar={() => setEditando(false)} onGuardado={onGuardado} />
      )}
    </>
  );
}
