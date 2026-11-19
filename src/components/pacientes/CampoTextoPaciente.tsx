"use client";

import { CLASE_CAMPO, CLASE_LABEL, type DefCampo } from './formularioPaciente';

interface CampoTextoPacienteProps {
  def: DefCampo;
  valor: string;
  onCambiar: (valor: string) => void;
}

// Un campo de texto de la ficha (input o textarea, según `def.filas`).
export function CampoTextoPaciente({ def: { campo, label, placeholder, filas, tipo }, valor, onCambiar }: CampoTextoPacienteProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={`paciente-${campo}`} className={CLASE_LABEL}>{label}</label>
      {filas ? (
        <textarea id={`paciente-${campo}`} rows={filas} value={valor} placeholder={placeholder}
          onChange={(e) => onCambiar(e.target.value)} className={`${CLASE_CAMPO} resize-none`} />
      ) : (
        <input id={`paciente-${campo}`} type={tipo ?? 'text'} inputMode={tipo === 'tel' ? 'tel' : undefined}
          value={valor} placeholder={placeholder} onChange={(e) => onCambiar(e.target.value)} className={CLASE_CAMPO} />
      )}
    </div>
  );
}
