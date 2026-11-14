"use client";

import { useState } from 'react';
import { AlertTriangle, Pencil, Save, Undo2, User } from 'lucide-react';
import { actualizarPagoTPA, borrarPagoTPA, crearPagoTPA } from '@/lib/queries';
import { mensajeErrorAlGuardar, registrarError } from '@/lib/errores';
import {
  avisoPorClase, esDelUnoAlDiez, formatoPesos, hoyArgentina, nombreMes, precioPlan, primerDia, textoHorarios, textoVeces,
  type CuotaDelMes, type Mes,
} from '@/lib/pagos';
import type { MedioPago, ModalidadCuota, PreciosMes } from '@/types';
import { cn, nuevoId } from '@/lib/utils';
import { useToast } from '@/components/ui/ToastProvider';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal, BOTON_PIE_PRIMARIO, BOTON_PIE_SECUNDARIO } from '@/components/ui/Modal';
import { CamposPago, type ValoresPago } from './CamposPago';
import { ResumenPagoGuardado } from './ResumenPagoGuardado';

interface CobrarCuotaProps {
  cuota: CuotaDelMes;
  mes: Mes;
  precios: PreciosMes | null;
  /** El medio de su último pago (si no, transferencia). */
  medioSugerido: MedioPago;
  onCerrar: () => void;
  onGuardado: () => void;
  onAbrirPaciente?: (pacienteId: string) => void;
}

const LINK = 'font-semibold text-teal-700 hover:text-teal-800 underline underline-offset-2';

// Cobrar la cuota de TPA de un mes (diseño 4.1). Todo viene completo con lo
// sugerido (plan según veces por semana, medio de su último pago, hoy): en el
// caso normal es abrir → Guardar. Ya pagada: resumen, Editar y Deshacer.
export function CobrarCuota({ cuota, mes, precios, medioSugerido, onCerrar, onGuardado, onAbrirPaciente }: CobrarCuotaProps) {
  const toast = useToast();
  const { pago, fijo } = cuota;
  const [idNuevo] = useState(() => nuevoId());
  const [editando, setEditando] = useState(!pago);
  const [veces, setVeces] = useState(pago?.veces_por_semana ?? cuota.veces);
  const [modalidad, setModalidad] = useState<ModalidadCuota>(pago?.modalidad ?? 'plan');
  const [clases, setClases] = useState<number | null>(pago?.clases ?? null);
  const [valores, setValores] = useState<ValoresPago>(() => ({
    importe: pago?.importe ?? (precios ? precioPlan(precios, cuota.veces) : ''),
    medio: pago?.medio ?? medioSugerido,
    pagadoEl: pago?.pagado_el ?? hoyArgentina(new Date()),
    nota: pago?.nota ?? '',
  }));
  const [guardando, setGuardando] = useState(false);
  const [deshaciendo, setDeshaciendo] = useState<'preguntando' | 'borrando' | null>(null);

  const cambiar = (cambios: Partial<ValoresPago>) => setValores((v) => ({ ...v, ...cambios }));
  const usarPlan = (v: number) => {
    setVeces(v);
    setModalidad('plan');
    setClases(null);
    cambiar({ importe: precios ? precioPlan(precios, v) : valores.importe });
  };
  const aviso = precios && valores.pagadoEl
    ? avisoPorClase({ veces, precios, pagadoEl: valores.pagadoEl, mes, fijo })
    : null;

  const guardar = async () => {
    if (valores.importe === '' || !valores.pagadoEl) return;
    setGuardando(true);
    try {
      const fila = {
        paciente_id: cuota.pacienteId, mes: primerDia(mes), concepto: 'cuota' as const, veces_por_semana: veces,
        modalidad, clases: modalidad === 'plan' ? null : clases, importe: valores.importe, pagado_el: valores.pagadoEl,
        medio: valores.medio, nota: valores.nota.trim() || null,
      };
      if (pago) await actualizarPagoTPA(pago.id, fila);
      else await crearPagoTPA({ id: idNuevo, ...fila });
      toast.exito(`Pago guardado: ${cuota.nombre} · ${formatoPesos(valores.importe)}`);
      onGuardado();
      onCerrar();
    } catch (err: unknown) {
      registrarError('Error guardando la cuota TPA', err);
      toast.error(mensajeErrorAlGuardar('No se pudo guardar el pago.', err));
    } finally {
      setGuardando(false);
    }
  };

  const deshacer = async () => {
    if (!pago) return;
    setDeshaciendo('borrando');
    try {
      await borrarPagoTPA(pago.id);
      toast.exito(`${cuota.nombre}: la cuota de ${nombreMes(mes, false)} vuelve a pendiente`);
      onGuardado();
      onCerrar();
    } catch (err: unknown) {
      registrarError('Error deshaciendo la cuota TPA', err);
      toast.error(mensajeErrorAlGuardar('No se pudo deshacer el pago.', err));
      setDeshaciendo(null);
    }
  };

  const avisos = [
    !fijo && 'Ya no figura como fijo este mes.',
    fijo?.horariosDeMas && 'Tiene más de 3 horarios a la vez: se sugiere el plan de 3 veces.',
    fijo && veces !== fijo.vecesPorSemana && `Sus horarios son de ${textoVeces(fijo.vecesPorSemana)} y paga ${textoVeces(veces)}.`,
  ].filter((a): a is string => Boolean(a));

  const pie = editando ? (
    <>
      <button type="button" onClick={pago ? () => setEditando(false) : onCerrar} className={BOTON_PIE_SECUNDARIO}>Cancelar</button>
      <button type="button" onClick={guardar} disabled={guardando || valores.importe === '' || !valores.pagadoEl} className={BOTON_PIE_PRIMARIO}>
        <Save size={16} /> Guardar
      </button>
    </>
  ) : (
    <>
      <button type="button" onClick={() => setDeshaciendo('preguntando')} className={cn(BOTON_PIE_SECUNDARIO, 'text-red-600 md:mr-auto flex items-center justify-center gap-2')}>
        <Undo2 size={16} /> Deshacer
      </button>
      <button type="button" onClick={() => setEditando(true)} className={cn(BOTON_PIE_SECUNDARIO, 'flex items-center justify-center gap-2')}>
        <Pencil size={16} /> Editar
      </button>
    </>
  );

  return (
    <Modal
      titulo={cuota.nombre}
      subtitulo={`Cuota de ${nombreMes(mes, false)} · ${textoVeces(veces)}${fijo ? ` (${textoHorarios(fijo)})` : ''}`}
      onCerrar={onCerrar}
      ancho="md"
      pie={pie}
    >
      <div className="p-4 md:p-6 space-y-4">
        {avisos.map((a) => (
          <p key={a} className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" /> {a}
          </p>
        ))}

        {!editando && pago ? (
          <ResumenPagoGuardado pago={{ importe: pago.importe, pagadoEl: pago.pagado_el, medio: pago.medio, nota: pago.nota }}
            detalle={pago.modalidad === 'por_clase' ? `Por clase: ${pago.clases} clases` : `Plan ${textoVeces(pago.veces_por_semana ?? 1)}`} />
        ) : (
          <>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-stone-500">Plan</span>
              <div role="radiogroup" aria-label="Veces por semana" className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((v) => (
                  <button key={v} type="button" role="radio" aria-checked={veces === v} onClick={() => usarPlan(v)}
                    className={cn('h-11 rounded-lg border text-sm font-medium transition-colors duration-150',
                      veces === v ? 'bg-teal-50 border-teal-500 text-teal-800' : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300')}>
                    {v === 1 ? '1 vez' : `${v} veces`}
                  </button>
                ))}
              </div>
            </div>
            <CamposPago
              valores={valores}
              onCambiar={cambiar}
              debajoDelImporte={
                modalidad === 'por_clase' ? (
                  <p className="text-sm text-stone-600">
                    Por clase: {clases} {clases === 1 ? 'clase' : 'clases'} ·{' '}
                    <button type="button" onClick={() => usarPlan(veces)} className={LINK}>Volver al plan</button>
                  </p>
                ) : aviso ? (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {aviso.texto} ·{' '}
                    <button type="button" onClick={() => { setModalidad('por_clase'); setClases(aviso.clases); cambiar({ importe: aviso.importe }); }} className={LINK}>
                      Usar
                    </button>
                  </p>
                ) : (
                  <p className="text-sm text-stone-600">
                    Plan {textoVeces(veces)}{valores.pagadoEl && esDelUnoAlDiez(valores.pagadoEl, mes) ? ' (paga del 1 al 10)' : ''}.
                    {!precios && ' Sin precios cargados: escribí el importe.'}
                  </p>
                )
              }
            />
          </>
        )}

        {onAbrirPaciente && (
          <button type="button" onClick={() => onAbrirPaciente(cuota.pacienteId)} className="flex items-center gap-1.5 text-sm text-stone-600 hover:text-teal-700">
            <User size={16} /> Ver historia clínica
          </button>
        )}
      </div>

      <ConfirmDialog
        abierto={deshaciendo !== null}
        titulo="¿Deshacer el pago?"
        mensaje={<p>La cuota de {nombreMes(mes, false)} de {cuota.nombre} vuelve a quedar pendiente.</p>}
        textoConfirmar="Deshacer el pago"
        peligroso
        cargando={deshaciendo === 'borrando'}
        onConfirmar={deshacer}
        onCancelar={() => setDeshaciendo(null)}
      />
    </Modal>
  );
}
