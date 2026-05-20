"use client";

import { Clock, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import type { SesionRPG } from '@/types';
import { cn } from '@/components/layout/Navigation';

interface TurnoCardProps {
  turno: SesionRPG;
  onClick: () => void;
  onPacienteClick: (e: React.MouseEvent) => void;
}

export function TurnoCard({ turno, onClick, onPacienteClick }: TurnoCardProps) {
  const isPagado = turno.estado_pago === 'pagado';
  
  const getSessionStatusConfig = (status: string) => {
    switch (status) {
      case 'realizada':
        return { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 };
      case 'cancelada':
        return { color: 'text-zinc-500 bg-zinc-700/40 border-zinc-600/30', icon: XCircle };
      default:
        return { color: 'text-zinc-300 bg-zinc-800 border-zinc-700 hover:border-zinc-600', icon: Clock };
    }
  };

  const statusConfig = getSessionStatusConfig(turno.estado_sesion);
  const StatusIcon = statusConfig.icon;

  return (
    <div 
      onClick={onClick}
      className={cn(
        "group relative flex flex-col p-3 rounded-xl border transition-colors cursor-pointer",
        statusConfig.color
      )}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center space-x-1.5 text-sm font-semibold">
          <StatusIcon className="w-4 h-4" />
          <span>{turno.hora.substring(0, 5)}</span>
        </div>
        <div 
          className={cn(
            "w-2.5 h-2.5 rounded-full shadow-sm",
            isPagado ? "bg-emerald-400" : "bg-amber-400"
          )}
          title={isPagado ? "Mes pagado" : "Mes pendiente"}
        />
      </div>
      
      <div 
        onClick={(e) => {
          e.stopPropagation();
          onPacienteClick(e);
        }}
        className="text-sm font-medium truncate hover:underline hover:text-violet-400 transition-colors"
      >
        {turno.pacientes?.nombre || 'Paciente sin nombre'}
      </div>
      
      {turno.tipo_sesion && (
        <div className="text-xs mt-1 opacity-80 truncate">
          {turno.tipo_sesion}
        </div>
      )}
    </div>
  );
}
