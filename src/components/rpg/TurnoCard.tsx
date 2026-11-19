"use client";

import type { SesionRPG } from '@/types';
import { cn } from '@/lib/utils';
import { ESTADOS_PAGO, ESTADOS_SESION_RPG, esDomicilio, tipoTurno } from '@/lib/estados';

interface TurnoCardProps {
  turno: SesionRPG;
  onClick: () => void;
  onPacienteClick: (e: React.MouseEvent) => void;
}

// Un turno individual. El color de la card es el de su estado; la clase a
// domicilio va siempre en violeta (salvo cancelada, que se ve apagada) y su
// estado se lee en el ícono.
export function TurnoCard({ turno, onClick, onPacienteClick }: TurnoCardProps) {
  const estado = turno.estado_sesion ?? 'pendiente';
  const pago = ESTADOS_PAGO[turno.estado_pago ?? 'pendiente'];
  const sesion = ESTADOS_SESION_RPG[estado];
  const tipo = tipoTurno(turno.tipo_sesion);
  const domicilio = esDomicilio(turno.tipo_sesion) && estado !== 'cancelada';
  const StatusIcon = sesion.icono;
  const TipoIcon = tipo.icono;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex flex-col p-3 rounded-xl border transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md",
        domicilio ? tipo.clases : sesion.clases
      )}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center space-x-1.5 text-xs font-semibold">
          <StatusIcon
            className={cn("w-3.5 h-3.5", domicilio && estado === 'realizada' && "text-emerald-600")}
            aria-label={sesion.label}
          />
          <span>{turno.hora}</span>
        </div>
        <div
          className={cn(
            "w-2.5 h-2.5 rounded-full shadow-sm shrink-0",
            pago.punto
          )}
          title={`Sesión: ${pago.label.toLowerCase()}`}
          aria-label={`Sesión: ${pago.label.toLowerCase()}`}
        />
      </div>

      <div
        onClick={(e) => {
          e.stopPropagation();
          onPacienteClick(e);
        }}
        className="text-sm font-semibold truncate hover:underline hover:text-teal-600 transition-colors"
      >
        {turno.pacientes?.nombre || 'Paciente sin nombre'}
      </div>

      <div className={cn("text-xs mt-1 font-medium flex items-center gap-1 min-w-0", !domicilio && "text-stone-500")}>
        <TipoIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{tipo.label}</span>
      </div>
    </div>
  );
}
