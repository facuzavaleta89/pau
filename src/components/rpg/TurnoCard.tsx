"use client";

import type { SesionRPG } from '@/types';
import { cn } from '@/lib/utils';
import { ESTADOS_PAGO, ESTADOS_SESION_RPG } from '@/lib/estados';

interface TurnoCardProps {
  turno: SesionRPG;
  onClick: () => void;
  onPacienteClick: (e: React.MouseEvent) => void;
}

export function TurnoCard({ turno, onClick, onPacienteClick }: TurnoCardProps) {
  const pago = ESTADOS_PAGO[turno.estado_pago ?? 'pendiente'];
  const sesion = ESTADOS_SESION_RPG[turno.estado_sesion ?? 'pendiente'];
  const StatusIcon = sesion.icono;

  return (
    <div 
      onClick={onClick}
      className={cn(
        "group relative flex flex-col p-3 rounded-xl border transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md",
        sesion.clases
      )}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center space-x-1.5 text-xs font-semibold">
          <StatusIcon className="w-3.5 h-3.5" aria-label={sesion.label} />
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
      
      {turno.tipo_sesion && (
        <div className="text-xs mt-1 text-stone-500 truncate font-medium">
          {turno.tipo_sesion}
        </div>
      )}
    </div>
  );
}
