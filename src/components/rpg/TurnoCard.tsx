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
        return { color: 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100/50', icon: CheckCircle2 };
      case 'cancelada':
        return { color: 'text-stone-400 bg-stone-100 border-stone-200 hover:bg-stone-200/50', icon: XCircle };
      default:
        return { color: 'text-stone-700 bg-white border border-stone-200 hover:border-stone-300 shadow-sm hover:bg-stone-50/50', icon: Clock };
    }
  };

  const statusConfig = getSessionStatusConfig(turno.estado_sesion);
  const StatusIcon = statusConfig.icon;

  return (
    <div 
      onClick={onClick}
      className={cn(
        "group relative flex flex-col p-3 rounded-xl border transition-all duration-150 cursor-pointer shadow-sm",
        statusConfig.color
      )}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center space-x-1.5 text-xs font-semibold">
          <StatusIcon className="w-3.5 h-3.5" />
          <span>{turno.hora.substring(0, 5)}</span>
        </div>
        <div 
          className={cn(
            "w-2.5 h-2.5 rounded-full shadow-sm shrink-0",
            isPagado ? "bg-emerald-500" : "bg-amber-500"
          )}
          title={isPagado ? "Mes pagado" : "Mes pendiente"}
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
