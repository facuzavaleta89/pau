"use client";

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Pencil, Trash2 } from 'lucide-react';
import type { ItemEvolucion } from '@/lib/evolucion';
import {
  ESTADOS_PAGO, ESTADOS_SESION_RPG, ICONO_NOTA, MOTIVOS_CANCELACION, TIPOS_OCUPANTE, estadoAsistencia, etiquetaAsistencia,
} from '@/lib/estados';
import type { NotaEvolucion } from '@/types';
import { cn } from '@/lib/utils';
import { NotaEvolucionForm } from './NotaEvolucionForm';

interface EvolucionItemProps {
  item: ItemEvolucion;
  /** Esta nota se está editando. */
  editando: boolean;
  guardando: boolean;
  onEditar: (nota: NotaEvolucion) => void;
  onGuardar: (nota: NotaEvolucion, texto: string, fecha: string | null) => void;
  onCancelar: () => void;
  onBorrar: (nota: NotaEvolucion) => void;
}

const CHIP = 'px-2.5 py-0.5 rounded-full text-xs font-semibold border';
const BOTON_ICONO = 'h-11 w-11 md:h-9 md:w-9 flex items-center justify-center rounded-lg text-stone-400 transition-colors duration-150';

function fechaLarga(fecha: string): string {
  return format(parseISO(fecha), "EEE d 'de' MMMM yyyy", { locale: es });
}

// Una entrada de la línea de tiempo: clase de TPA (asistencia + nota), nota libre o sesión de RPG.
export function EvolucionItem({ item, editando, guardando, onEditar, onGuardar, onCancelar, onBorrar }: EvolucionItemProps) {
  const IconoNota = ICONO_NOTA;
  const nota = item.tipo === 'rpg' ? null : item.nota;

  return (
    <li className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <span className="text-sm font-bold text-stone-900 capitalize">{fechaLarga(item.fecha)}</span>
        {item.hora && <span className="text-xs text-stone-600 bg-stone-50 border border-stone-200 px-2 py-0.5 rounded">{item.hora} hs</span>}
        <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
          {item.tipo === 'tpa' ? 'TPA' : item.tipo === 'rpg' ? (item.sesion.tipo_sesion || 'RPG') : 'Nota'}
        </span>
        <span className="flex-1" />
        {item.tipo === 'tpa' && <EstadoTPA item={item} />}
        {item.tipo === 'rpg' && (
          <>
            <span className={cn(CHIP, ESTADOS_SESION_RPG[item.sesion.estado_sesion ?? 'pendiente'].clases)}>
              {ESTADOS_SESION_RPG[item.sesion.estado_sesion ?? 'pendiente'].label}
            </span>
            <span className={cn(CHIP, ESTADOS_PAGO[item.sesion.estado_pago ?? 'pendiente'].clases)}>
              {ESTADOS_PAGO[item.sesion.estado_pago ?? 'pendiente'].label}
            </span>
          </>
        )}
      </div>

      {item.tipo === 'rpg' && item.sesion.nota && (
        <p className="text-sm text-stone-700 bg-stone-50 border border-stone-100 rounded-lg px-3 py-2 whitespace-pre-line break-words">
          {item.sesion.nota}
        </p>
      )}

      {nota && (editando ? (
        <NotaEvolucionForm
          textoInicial={nota.texto}
          fechaInicial={item.tipo === 'nota_libre' ? nota.fecha : null}
          guardando={guardando}
          onGuardar={(texto, fecha) => onGuardar(nota, texto, fecha)}
          onCancelar={onCancelar}
        />
      ) : (
        <div className="flex items-start gap-2 bg-teal-50/40 border border-teal-100 rounded-lg pl-3 py-1">
          <IconoNota size={16} className="shrink-0 mt-2 text-teal-600" aria-label="Nota de evolución" />
          <p className="flex-1 min-w-0 py-1.5 text-sm text-stone-800 whitespace-pre-line break-words">{nota.texto}</p>
          <button type="button" onClick={() => onEditar(nota)} aria-label="Editar la nota" className={cn(BOTON_ICONO, 'hover:text-teal-700 hover:bg-teal-50')}>
            <Pencil size={16} />
          </button>
          <button type="button" onClick={() => onBorrar(nota)} aria-label="Borrar la nota" className={cn(BOTON_ICONO, 'hover:text-red-600 hover:bg-red-50')}>
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </li>
  );
}

function EstadoTPA({ item }: { item: Extract<ItemEvolucion, { tipo: 'tpa' }> }) {
  const a = item.asistencia;
  if (!a) return <span className={cn(CHIP, estadoAsistencia('pendiente').clases)}>Sin marcar</span>;
  const estado = estadoAsistencia(a.estado);
  const motivo = a.clases_tpa.motivo_cancelacion;
  return (
    <>
      {a.tipo !== 'fijo' && <span className="text-xs text-stone-500">{TIPOS_OCUPANTE[a.tipo].label}</span>}
      {motivo && <span className="text-xs text-stone-500">{MOTIVOS_CANCELACION[motivo]}</span>}
      <span className={cn(CHIP, estado.clases, motivo && 'opacity-60')}>{etiquetaAsistencia(a.estado, a.tipo)}</span>
    </>
  );
}
