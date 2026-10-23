"use client";

import { Search } from "lucide-react";
import { fechaVence } from "@/lib/recuperaciones";
import type { CreditoRecuperacion, SaldoRecuperaciones } from "@/types";

interface TpaPendientesGrupoProps {
  titulo: string;
  items: { saldo: SaldoRecuperaciones; credito: CreditoRecuperacion }[];
  /** null = no se puede buscar lugar (mes que ya cerró). */
  onBuscarLugar: ((saldo: SaldoRecuperaciones, credito: CreditoRecuperacion) => void) | null;
  onAbrirPaciente: (pacienteId: string) => void;
}

const usoTexto = (s: SaldoRecuperaciones) => `usó ${s.topeUsado} de ${s.frecuencia}`;

// Un grupo de pendientes (canceladas por Pau, C.T., S.T. o feriado): tabla en
// la compu, cards en el celular. Mismos datos en las dos vistas.
export function TpaPendientesGrupo({ titulo, items, onBuscarLugar, onAbrirPaciente }: TpaPendientesGrupoProps) {
  if (items.length === 0) return null;

  const boton = (saldo: SaldoRecuperaciones, credito: CreditoRecuperacion) => onBuscarLugar && (
    <button
      type="button"
      onClick={() => onBuscarLugar(saldo, credito)}
      className="min-h-11 md:min-h-9 px-3 flex items-center justify-center gap-1.5 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg"
    >
      <Search size={16} /> Buscar lugar
    </button>
  );
  const nombre = (s: SaldoRecuperaciones) => (
    <button type="button" onClick={() => onAbrirPaciente(s.pacienteId)} className="text-left font-semibold text-stone-900 hover:text-teal-700">
      {s.nombre}
    </button>
  );

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">{titulo} ({items.length})</h3>

      <table className="hidden md:table w-full text-sm bg-white border border-stone-200 rounded-xl overflow-hidden">
        <thead className="bg-stone-50 text-xs text-stone-500 text-left">
          <tr>
            <th className="px-4 py-2 font-medium">Alumno</th>
            <th className="px-4 py-2 font-medium">Origen</th>
            <th className="px-4 py-2 font-medium">Tope del mes</th>
            <th className="px-4 py-2 font-medium">Vence</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {items.map(({ saldo, credito }) => (
            <tr key={`${saldo.pacienteId}_${credito.id}`}>
              <td className="px-4 py-2">{nombre(saldo)}</td>
              <td className="px-4 py-2 text-stone-700">{credito.texto}</td>
              <td className="px-4 py-2 text-stone-600">{usoTexto(saldo)}</td>
              <td className="px-4 py-2 text-stone-600">{credito.vence ? `vence el ${fechaVence(credito.vence)}` : 'no vence'}</td>
              <td className="px-4 py-2 text-right"><div className="inline-flex">{boton(saldo, credito)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="md:hidden space-y-2">
        {items.map(({ saldo, credito }) => (
          <li key={`${saldo.pacienteId}_${credito.id}`} className="bg-white border border-stone-200 rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              {nombre(saldo)}
              <span className="text-xs text-stone-500 shrink-0">{usoTexto(saldo)}</span>
            </div>
            <p className="text-sm text-stone-700">
              {credito.texto} · <span className="text-stone-500">{credito.vence ? `vence el ${fechaVence(credito.vence)}` : 'no vence'}</span>
            </p>
            {boton(saldo, credito)}
          </li>
        ))}
      </ul>
    </section>
  );
}
