"use client";

import { useState } from 'react';
import { Save, Undo2 } from 'lucide-react';
import { borrarPagoTPA, crearPagoTPA } from '@/lib/queries';
import { mensajeErrorAlGuardar, registrarError } from '@/lib/errores';
import {
  MEDIOS_PAGO, diaYMes, formatoPesos, hoyArgentina, nombreMes, primerDia, textoSueltas, type Mes, type SueltasDelMes,
} from '@/lib/pagos';
import type { MedioPago, PagoTPA, PreciosMes } from '@/types';
import { nuevoId } from '@/lib/utils';
import { useToast } from '@/components/ui/ToastProvider';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal, BOTON_PIE_PRIMARIO, BOTON_PIE_SECUNDARIO } from '@/components/ui/Modal';
import { CamposPago, ETIQUETA_PAGO, INPUT_PAGO, type ValoresPago } from './CamposPago';

interface CobrarSueltasProps {
  sueltas: SueltasDelMes;
  mes: Mes;
  precios: PreciosMes | null;
  medioSugerido: MedioPago;
  onCerrar: () => void;
  onGuardado: () => void;
}

// Clases sueltas de una persona en el mes: cada pago es una fila nueva
// (decisión de Facu, 13/11/2026), con su "Deshacer".
export function CobrarSueltas({ sueltas, mes, precios, medioSugerido, onCerrar, onGuardado }: CobrarSueltasProps) {
  const toast = useToast();
  const [idNuevo] = useState(() => nuevoId());
  const inicial = Math.max(1, sueltas.pendientes);
  const [clases, setClases] = useState<number | ''>(inicial);
  const [valores, setValores] = useState<ValoresPago>(() => ({
    importe: precios ? inicial * precios.tpa_suelta : '',
    medio: medioSugerido,
    pagadoEl: hoyArgentina(new Date()),
    nota: '',
  }));
  const [guardando, setGuardando] = useState(false);
  const [aDeshacer, setADeshacer] = useState<PagoTPA | null>(null);
  const [deshaciendo, setDeshaciendo] = useState(false);

  const cambiarClases = (valor: number | '') => {
    setClases(valor);
    if (precios && valor !== '') setValores((v) => ({ ...v, importe: valor * precios.tpa_suelta }));
  };
  const listo = clases !== '' && clases >= 1 && valores.importe !== '' && Boolean(valores.pagadoEl);

  const guardar = async () => {
    if (clases === '' || valores.importe === '' || !listo) return;
    setGuardando(true);
    try {
      await crearPagoTPA({
        id: idNuevo, paciente_id: sueltas.pacienteId, mes: primerDia(mes), concepto: 'sueltas', veces_por_semana: null,
        modalidad: null, clases, importe: valores.importe, pagado_el: valores.pagadoEl, medio: valores.medio,
        nota: valores.nota.trim() || null,
      });
      toast.exito(`Pago guardado: ${sueltas.nombre} · ${formatoPesos(valores.importe)}`);
      onGuardado();
      onCerrar();
    } catch (err: unknown) {
      registrarError('Error guardando clases sueltas', err);
      toast.error(mensajeErrorAlGuardar('No se pudo guardar el pago.', err));
    } finally {
      setGuardando(false);
    }
  };

  const deshacer = async () => {
    if (!aDeshacer) return;
    setDeshaciendo(true);
    try {
      await borrarPagoTPA(aDeshacer.id);
      toast.exito('Pago deshecho');
      setADeshacer(null);
      onGuardado();
      onCerrar();
    } catch (err: unknown) {
      registrarError('Error deshaciendo pago de sueltas', err);
      toast.error(mensajeErrorAlGuardar('No se pudo deshacer el pago.', err));
    } finally {
      setDeshaciendo(false);
    }
  };

  return (
    <Modal
      titulo={sueltas.nombre}
      subtitulo={`Clases sueltas de ${nombreMes(mes, false)}: ${textoSueltas(sueltas)}`}
      onCerrar={onCerrar}
      ancho="md"
      pie={(
        <>
          <button type="button" onClick={onCerrar} className={BOTON_PIE_SECUNDARIO}>Cancelar</button>
          <button type="button" onClick={guardar} disabled={guardando || !listo} className={BOTON_PIE_PRIMARIO}>
            <Save size={16} /> Guardar pago
          </button>
        </>
      )}
    >
      <div className="p-4 md:p-6 space-y-5">
        {sueltas.pagos.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Pagos de este mes</h3>
            <ul className="space-y-2">
              {sueltas.pagos.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 pl-3 rounded-lg border border-emerald-200 bg-emerald-50 text-sm text-emerald-800">
                  <span>{diaYMes(p.pagado_el)} · {p.clases} {p.clases === 1 ? 'clase' : 'clases'} · {formatoPesos(p.importe)} · {MEDIOS_PAGO[p.medio]}</span>
                  <button type="button" onClick={() => setADeshacer(p)} aria-label="Deshacer este pago"
                    className="h-11 w-11 flex items-center justify-center text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Undo2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-4">
          <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
            {sueltas.pendientes > 0 ? `Cobrar (le ${sueltas.pendientes === 1 ? 'falta pagar 1 clase' : `faltan pagar ${sueltas.pendientes} clases`})` : 'Cobrar otro pago'}
          </h3>
          <label className={ETIQUETA_PAGO}>
            Clases
            <input type="number" inputMode="numeric" min={1} step={1} value={clases}
              onChange={(e) => cambiarClases(e.target.value === '' ? '' : Math.max(1, Math.round(Number(e.target.value))))}
              className={`${INPUT_PAGO} sm:w-32`} />
          </label>
          <CamposPago
            valores={valores}
            onCambiar={(c) => setValores((v) => ({ ...v, ...c }))}
            debajoDelImporte={precios && clases !== '' && (
              <p className="text-sm text-stone-600">{clases} × {formatoPesos(precios.tpa_suelta)} (clase suelta)</p>
            )}
          />
        </section>
      </div>

      <ConfirmDialog
        abierto={aDeshacer !== null}
        titulo="¿Deshacer este pago?"
        mensaje={<p>Esas clases vuelven a quedar pendientes de pago.</p>}
        textoConfirmar="Deshacer el pago"
        peligroso
        cargando={deshaciendo}
        onConfirmar={deshacer}
        onCancelar={() => setADeshacer(null)}
      />
    </Modal>
  );
}
