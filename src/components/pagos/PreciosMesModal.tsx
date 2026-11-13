"use client";

import { useState } from 'react';
import { Save } from 'lucide-react';
import { guardarPreciosMes } from '@/lib/queries';
import { mensajeErrorAlGuardar, registrarError } from '@/lib/errores';
import { conMayuscula, nombreMes, primerDia, type Mes } from '@/lib/pagos';
import type { PreciosMes } from '@/types';
import { useToast } from '@/components/ui/ToastProvider';
import { Modal, BOTON_PIE_PRIMARIO, BOTON_PIE_SECUNDARIO } from '@/components/ui/Modal';
import { ETIQUETA_PAGO, INPUT_PAGO } from './CamposPago';

type CampoPrecio = Exclude<keyof PreciosMes, 'mes'>;

const CAMPOS: { campo: CampoPrecio; label: string }[] = [
  { campo: 'tpa_1_vez', label: 'TPA 1 vez por semana' },
  { campo: 'tpa_2_veces', label: 'TPA 2 veces por semana' },
  { campo: 'tpa_3_veces', label: 'TPA 3 veces por semana' },
  { campo: 'tpa_suelta', label: 'TPA clase suelta' },
  { campo: 'rpg_sesion', label: 'Sesión de RPG' },
];

interface PreciosMesModalProps {
  mes: Mes;
  /** Los vigentes (de este mes o del anterior): el formulario arranca con ellos. */
  base: PreciosMes | null;
  onCerrar: () => void;
  onGuardado: () => void;
}

// Cargar o editar los precios de un mes. Arranca con los del mes anterior:
// si cambió uno solo, se edita ese. Guardar de nuevo no duplica (upsert por mes).
export function PreciosMesModal({ mes, base, onCerrar, onGuardado }: PreciosMesModalProps) {
  const toast = useToast();
  const [valores, setValores] = useState<Record<CampoPrecio, number | ''>>(() => ({
    tpa_1_vez: base?.tpa_1_vez ?? '',
    tpa_2_veces: base?.tpa_2_veces ?? '',
    tpa_3_veces: base?.tpa_3_veces ?? '',
    tpa_suelta: base?.tpa_suelta ?? '',
    rpg_sesion: base?.rpg_sesion ?? '',
  }));
  const [guardando, setGuardando] = useState(false);
  const completos = CAMPOS.every(({ campo }) => typeof valores[campo] === 'number' && valores[campo] > 0);

  const guardar = async () => {
    if (!completos) return;
    setGuardando(true);
    try {
      await guardarPreciosMes({ mes: primerDia(mes), ...(valores as Record<CampoPrecio, number>) });
      toast.exito(`Precios de ${nombreMes(mes, false)} guardados`);
      onGuardado();
      onCerrar();
    } catch (err: unknown) {
      registrarError('Error guardando precios del mes', err);
      toast.error(mensajeErrorAlGuardar('No se pudieron guardar los precios.', err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      titulo={`Precios de ${nombreMes(mes)}`}
      subtitulo="En pesos. Lo que ya se cobró no cambia."
      onCerrar={onCerrar}
      ancho="md"
      pie={(
        <>
          <button type="button" onClick={onCerrar} className={BOTON_PIE_SECUNDARIO}>Cancelar</button>
          <button type="button" onClick={guardar} disabled={guardando || !completos} className={BOTON_PIE_PRIMARIO}>
            <Save size={16} /> Guardar
          </button>
        </>
      )}
    >
      <div className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CAMPOS.map(({ campo, label }) => (
          <label key={campo} className={ETIQUETA_PAGO}>
            {label}
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={valores[campo]}
              onChange={(e) => setValores((v) => ({ ...v, [campo]: e.target.value === '' ? '' : Math.max(0, Math.round(Number(e.target.value))) }))}
              className={INPUT_PAGO}
            />
          </label>
        ))}
        {!base && <p className="sm:col-span-2 text-xs text-stone-500">{conMayuscula(nombreMes(mes))}: no hay precios de meses anteriores para copiar.</p>}
      </div>
    </Modal>
  );
}
