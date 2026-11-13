"use client";

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Pencil, Save, Undo2 } from 'lucide-react';
import { cambiarPagoSesionRPG } from '@/lib/queries';
import { mensajeErrorAlGuardar, registrarError } from '@/lib/errores';
import { formatoPesos, hoyArgentina, type SesionDelMes } from '@/lib/pagos';
import type { MedioPago } from '@/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/ToastProvider';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal, BOTON_PIE_PRIMARIO, BOTON_PIE_SECUNDARIO } from '@/components/ui/Modal';
import { CamposPago, type ValoresPago } from './CamposPago';
import { ResumenPagoGuardado } from './ResumenPagoGuardado';

interface CobrarSesionRPGProps {
  item: SesionDelMes;
  medioSugerido: MedioPago;
  onCerrar: () => void;
  onGuardado: () => void;
}

// Pago de una sesión de RPG (importe, fecha y medio). Pendiente ↔ pagada.
export function CobrarSesionRPG({ item, medioSugerido, onCerrar, onGuardado }: CobrarSesionRPGProps) {
  const toast = useToast();
  const { sesion } = item;
  const [editando, setEditando] = useState(!item.pagada);
  const [valores, setValores] = useState<ValoresPago>(() => ({
    importe: item.importe || '',
    medio: sesion.medio_pago ?? medioSugerido,
    pagadoEl: sesion.pagado_el ?? (sesion.fecha <= hoyArgentina(new Date()) ? sesion.fecha : hoyArgentina(new Date())),
    nota: '',
  }));
  const [guardando, setGuardando] = useState(false);
  const [aPendiente, setAPendiente] = useState(false);

  const cambiarPago = async (pagado: boolean) => {
    if (pagado && (valores.importe === '' || !valores.pagadoEl)) return;
    setGuardando(true);
    try {
      await cambiarPagoSesionRPG(sesion.id, pagado && valores.importe !== ''
        ? { importe: valores.importe, pagado_el: valores.pagadoEl, medio_pago: valores.medio }
        : null);
      toast.exito(pagado ? `Sesión cobrada: ${item.nombre} · ${formatoPesos(Number(valores.importe))}` : 'La sesión vuelve a pendiente');
      onGuardado();
      onCerrar();
    } catch (err: unknown) {
      registrarError('Error guardando el pago de una sesión RPG', err);
      toast.error(mensajeErrorAlGuardar('No se pudo guardar el pago de la sesión.', err));
      setGuardando(false);
    }
  };

  const pie = editando ? (
    <>
      <button type="button" onClick={item.pagada ? () => setEditando(false) : onCerrar} className={BOTON_PIE_SECUNDARIO}>Cancelar</button>
      <button type="button" onClick={() => cambiarPago(true)} disabled={guardando || valores.importe === '' || !valores.pagadoEl} className={BOTON_PIE_PRIMARIO}>
        <Save size={16} /> Guardar
      </button>
    </>
  ) : (
    <>
      <button type="button" onClick={() => setAPendiente(true)} className={cn(BOTON_PIE_SECUNDARIO, 'text-red-600 md:mr-auto flex items-center justify-center gap-2')}>
        <Undo2 size={16} /> Deshacer
      </button>
      <button type="button" onClick={() => setEditando(true)} className={cn(BOTON_PIE_SECUNDARIO, 'flex items-center justify-center gap-2')}>
        <Pencil size={16} /> Editar
      </button>
    </>
  );

  return (
    <Modal
      titulo={item.nombre}
      subtitulo={<span className="capitalize">{format(parseISO(sesion.fecha), "EEEE d 'de' MMMM", { locale: es })} · {sesion.hora} · {sesion.tipo_sesion ?? 'RPG'}</span>}
      onCerrar={onCerrar}
      ancho="md"
      pie={pie}
    >
      <div className="p-4 md:p-6 space-y-4">
        {!editando ? (
          <ResumenPagoGuardado
            pago={{ importe: item.importe, pagadoEl: sesion.pagado_el ?? null, medio: sesion.medio_pago ?? null }}
            importeEstimado={item.importeEstimado}
          />
        ) : (
          <>
            {item.futura && <p className="text-sm text-stone-600">La sesión todavía no se hizo: se puede cobrar por adelantado.</p>}
            <CamposPago valores={valores} onCambiar={(c) => setValores((v) => ({ ...v, ...c }))} conNota={false} />
          </>
        )}
      </div>

      <ConfirmDialog
        abierto={aPendiente}
        titulo="¿Deshacer el pago?"
        mensaje={<p>La sesión vuelve a quedar pendiente de pago.</p>}
        textoConfirmar="Deshacer el pago"
        peligroso
        cargando={guardando}
        onConfirmar={() => cambiarPago(false)}
        onCancelar={() => setAPendiente(false)}
      />
    </Modal>
  );
}
