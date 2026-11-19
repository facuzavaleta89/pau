import { tipoTurno } from '@/lib/estados';
import { cn } from '@/lib/utils';

interface TipoTurnoChipProps {
  tipo: string | null | undefined;
}

// Tipo de un turno con su color e ícono (la clase a domicilio, en violeta).
export function TipoTurnoChip({ tipo }: TipoTurnoChipProps) {
  const config = tipoTurno(tipo);
  const Icono = config.icono;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium whitespace-nowrap', config.clases)}>
      <Icono size={12} aria-hidden="true" /> {config.label}
    </span>
  );
}
