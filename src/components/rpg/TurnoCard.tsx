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
        return { color: 'text-emerald-500 bg-emerald-50 border-emerald-200', icon: CheckCircle2 };
      case 'cancelada':
        return { color: 'text-red-500 bg-red-50 border-red-200', icon: XCircle };
      default:
        return { color: 'text-blue-500 bg-blue-50 border-blue-200', icon: Clock };
    }
  };

  const statusConfig = getSessionStatusConfig(turno.estado_sesion);
  const StatusIcon = statusConfig.icon;

  return (
    <div 
      onClick={onClick}
      className={cn(
        "group relative flex flex-col p-3 rounded-xl border transition-all duration-200 cursor-pointer hover:shadow-md",
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
            isPagado ? "bg-emerald-400" : "bg-red-400"
          )}
          title={isPagado ? "Mes pagado" : "Mes pendiente"}
        />
      </div>
      
      <div 
        onClick={(e) => {
          e.stopPropagation();
          onPacienteClick(e);
        }}
        className="text-sm font-medium truncate hover:underline hover:text-blue-700 transition-colors"
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
