"use client";

import { ESTADOS_SESION_RPG, tipoTurno } from '@/lib/estados';
import { cn } from '@/lib/utils';
import type { SesionRPG } from '@/types';

interface LineaTurnoProps {
  turno: SesionRPG;
  onClick: () => void;
}

// Un turno en una sola línea (Semana y Mes): ícono y color del tipo, hora y
// nombre. Domicilio en violeta con la casita; cancelado, gris y tachado.
export function LineaTurno({ turno, onClick }: LineaTurnoProps) {
  const tipo = tipoTurno(turno.tipo_sesion);
  const cancelado = turno.estado_sesion === 'cancelada';
  const nombre = turno.pacientes?.nombre || 'Paciente sin nombre';
  const Icono = tipo.icono;
  const detalle = [tipo.label, cancelado && 'cancelado'].filter(Boolean).join(', ');

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${turno.hora} ${nombre} · ${detalle}`}
      className={cn(
        'w-full min-w-0 min-h-11 md:min-h-7 px-2 flex items-center gap-1.5 rounded-md border text-left text-sm md:text-xs',
        'transition-shadow duration-150 hover:shadow-sm',
        cancelado ? cn(ESTADOS_SESION_RPG.cancelada.clases, 'line-through') : tipo.clases,
      )}
    >
      <Icono size={12} className="shrink-0" aria-hidden="true" />
      <span className="shrink-0 font-semibold tabular-nums">{turno.hora}</span>
      <span className="truncate">{nombre}</span>
      <span className="sr-only">, {detalle}</span>
    </button>
  );
}
