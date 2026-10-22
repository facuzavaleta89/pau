"use client";

import { AlertTriangle, ClipboardCheck, Clock, CornerDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CLASES_CANCELADA, ICONO_CANCELADA, LUGAR_LIBRE, MOTIVOS_CANCELACION, TIPOS_OCUPANTE,
  estadoAsistencia, etiquetaAsistencia,
} from '@/lib/estados';
import type { CeldaTPA } from '@/types';

interface TpaHorarioCardProps {
  celda: CeldaTPA;
  onAbrir: (celda: CeldaTPA) => void;
  onAbrirPaciente: (pacienteId: string) => void;
}

const FILA = 'w-full min-h-11 md:min-h-9 flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm md:text-xs font-medium';

// Un horario de TPA en una fecha: hora, lugares, alumnos coloreados por estado
// y los lugares libres. La usan la grilla de la compu y la lista del celular.
export function TpaHorarioCard({ celda, onAbrir, onAbrirPaciente }: TpaHorarioCardProps) {
  const { lugares } = celda;
  const motivo = celda.clase?.motivo_cancelacion;
  const IconoLibre = LUGAR_LIBRE.icono;
  const IconoCancelada = ICONO_CANCELADA;

  return (
    <div
      className={cn(
        'border rounded-xl p-3 md:p-4 shadow-sm hover:shadow-md transition-all duration-150 flex flex-col gap-3',
        motivo ? 'bg-stone-50 border-stone-300' : 'bg-white border-stone-200 hover:border-stone-300'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
          <Clock size={16} className="text-stone-400" />
          {celda.hora}
          {!celda.enHorarioHabitual && (
            <span className="text-xs font-medium text-stone-500">(fuera de horario)</span>
          )}
        </span>
        {motivo ? (
          <span className={cn('flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border', CLASES_CANCELADA)}>
            <IconoCancelada size={12} aria-hidden="true" /> {MOTIVOS_CANCELACION[motivo]}
          </span>
        ) : (
          <span
            className={cn(
              'flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border',
              lugares.excedidos > 0 ? 'bg-amber-50 text-amber-800 border-amber-200'
                : lugares.libres === 0 ? 'bg-teal-50 text-teal-700 border-teal-200'
                : 'bg-stone-50 text-stone-600 border-stone-200'
            )}
            title={lugares.excedidos > 0 ? 'Hay más personas que lugares' : undefined}
            aria-label={`${lugares.ocupados} de ${celda.cupo} lugares ocupados`}
          >
            {lugares.excedidos > 0 && <AlertTriangle size={12} aria-hidden="true" />}
            {lugares.ocupados}/{celda.cupo}
          </span>
        )}
      </div>

      {celda.alumnos.length > 0 || lugares.libres > 0 ? (
        <ul className={cn('flex flex-col gap-1.5', motivo && 'opacity-60')}>
          {celda.alumnos.map((alumno) => {
            const estado = estadoAsistencia(alumno.estado);
            const Icono = estado.icono;
            const etiqueta = etiquetaAsistencia(alumno.estado, alumno.tipo);
            const ocupante = alumno.tipo === 'fijo' ? null : TIPOS_OCUPANTE[alumno.tipo];
            const enLugarDeUnFijo = Boolean(alumno.asistencia?.ocupa_lugar_de);
            // Qué es + estado si viene a ocupar un lugar; el estado si es fijo y ya está marcado.
            const detalle = ocupante
              ? (alumno.estado === 'pendiente' ? ocupante.label : `${ocupante.label} · ${etiqueta}`)
              : (alumno.estado === 'pendiente' ? null : etiqueta);
            return (
              <li key={alumno.pacienteId} className={cn(enLugarDeUnFijo && 'pl-4')}>
                <button
                  type="button"
                  onClick={() => onAbrirPaciente(alumno.pacienteId)}
                  title={`${alumno.nombre}: ${detalle ?? etiqueta}`}
                  className={cn(FILA, 'text-left transition-shadow duration-150 hover:shadow-sm', estado.clases)}
                >
                  {enLugarDeUnFijo
                    ? <CornerDownRight size={14} className="shrink-0" aria-hidden="true" />
                    : <Icono size={14} className="shrink-0" aria-hidden="true" />}
                  <span className="truncate flex-1">{alumno.nombre}</span>
                  {detalle && <span className="shrink-0 text-xs opacity-80">{detalle}</span>}
                  <span className="sr-only">{detalle ?? etiqueta}</span>
                </button>
              </li>
            );
          })}
          {/* Lugares sin nadie. "+ Ocupar" llega en la entrega 3. */}
          {Array.from({ length: lugares.libres }, (_, i) => (
            <li key={`libre-${i}`} className={cn(FILA, 'justify-center', LUGAR_LIBRE.clases)}>
              <IconoLibre size={14} className="shrink-0" aria-hidden="true" />
              {LUGAR_LIBRE.label}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm md:text-xs text-stone-500 border border-dashed border-stone-200 rounded-lg px-3 py-2 text-center">
          Sin alumnos
        </p>
      )}

      <button
        type="button"
        onClick={() => onAbrir(celda)}
        className="h-11 md:h-9 flex items-center justify-center gap-2 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors duration-150"
      >
        <ClipboardCheck size={16} />
        {celda.clase ? 'Ver asistencia' : 'Registrar asistencia'}
      </button>
    </div>
  );
}
