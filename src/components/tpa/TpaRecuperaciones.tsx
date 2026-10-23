"use client";

import { useMemo, useState } from "react";
import { addMonths, endOfMonth, format, parseISO, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, Copy } from "lucide-react";
import {
  calcularRecuperaciones, ORDEN_ORIGENES, pendientesPorOrigen, textoListaRecuperaciones, TITULOS_ORIGENES,
  type DatosRecuperaciones,
} from "@/lib/recuperaciones";
import type { CeldaTPA, CreditoRecuperacion, SaldoRecuperaciones } from "@/types";
import { useToast } from "@/components/ui/ToastProvider";
import { SemanaNav } from "@/components/ui/SemanaNav";
import { EstadoCarga } from "@/components/ui/EstadoCarga";
import { Modal, BOTON_PIE_SECUNDARIO } from "@/components/ui/Modal";
import { TpaPendientesGrupo } from "./TpaPendientesGrupo";
import { TpaBuscarLugar } from "./TpaBuscarLugar";

interface TpaRecuperacionesProps {
  datos: DatosRecuperaciones | null;
  cargando: boolean;
  error: boolean;
  onReintentar: () => void;
  /** 'yyyy-MM-dd' */
  hoy: string;
  /** "Buscar lugar" → elegir una clase: abre la clase con la persona ya agregada. */
  onElegirLugar: (celda: CeldaTPA, persona: { pacienteId: string; nombre: string }) => void;
  onAbrirPaciente: (pacienteId: string) => void;
}

// Pestaña "Recuperaciones" (diseño 7.4): por mes, pendientes en el orden de
// prioridad de Pau, adelantos y sin derecho; "Copiar lista" para WhatsApp.
export function TpaRecuperaciones({ datos, cargando, error, onReintentar, hoy, onElegirLugar, onAbrirPaciente }: TpaRecuperacionesProps) {
  const toast = useToast();
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [buscando, setBuscando] = useState<{ saldo: SaldoRecuperaciones; credito: CreditoRecuperacion } | null>(null);
  const [textoParaCopiar, setTextoParaCopiar] = useState<string | null>(null);

  const saldos = useMemo(() => (datos ? calcularRecuperaciones(mes, datos, hoy) : null), [datos, mes, hoy]);
  if (!saldos) return <EstadoCarga cargando={cargando} error={error} onReintentar={onReintentar} />;

  const grupos = pendientesPorOrigen(saldos);
  const total = ORDEN_ORIGENES.reduce((n, o) => n + grupos[o].length, 0);
  const cerrado = format(endOfMonth(parseISO(`${mes}-01`)), 'yyyy-MM-dd') < hoy;
  const conAdelantos = saldos.filter((s) => s.adelantos.length > 0);
  const sinDerecho = saldos.flatMap((s) => s.sinDerecho.map((x) => ({ saldo: s, ...x })))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.saldo.nombre.localeCompare(b.saldo.nombre, 'es'));
  const cambiarMes = (delta: number) => setMes(format((delta > 0 ? addMonths : subMonths)(parseISO(`${mes}-01`), 1), 'yyyy-MM'));
  const etiquetaMes = format(parseISO(`${mes}-01`), 'MMMM yyyy', { locale: es });
  const etiqueta = etiquetaMes.charAt(0).toUpperCase() + etiquetaMes.slice(1);

  // Por http desde la red local (o un navegador viejo) no hay portapapeles: se muestra el texto para copiar a mano.
  const copiar = async () => {
    const texto = textoListaRecuperaciones(saldos, mes);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('sin portapapeles');
      await navigator.clipboard.writeText(texto);
      toast.exito('Lista copiada: pegala en WhatsApp');
    } catch {
      setTextoParaCopiar(texto);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="md:w-80">
          <SemanaNav
            etiqueta={etiqueta}
            onAnterior={() => cambiarMes(-1)}
            onHoy={() => setMes(hoy.slice(0, 7))}
            onSiguiente={() => cambiarMes(1)}
            textoAnterior="Mes anterior"
            textoSiguiente="Mes siguiente"
          />
        </div>
        <p className="flex-1 text-sm text-stone-600">
          {total === 0 ? 'No hay recuperaciones pendientes.' : `${total} ${total === 1 ? 'pendiente' : 'pendientes'} de recuperar.`}
          {cerrado && ' El mes ya cerró: lo que vencía se perdió; las clases que cancelaste pasan al mes siguiente.'}
        </p>
        <button
          type="button"
          onClick={copiar}
          className="h-11 px-4 flex items-center justify-center gap-2 text-sm font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-300 rounded-lg"
        >
          <Copy size={16} /> Copiar lista
        </button>
      </div>

      {ORDEN_ORIGENES.map((o) => (
        <TpaPendientesGrupo
          key={o}
          titulo={TITULOS_ORIGENES[o]}
          items={grupos[o]}
          onBuscarLugar={cerrado ? null : (saldo, credito) => setBuscando({ saldo, credito })}
          onAbrirPaciente={onAbrirPaciente}
        />
      ))}

      {conAdelantos.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Adelantos (recuperaron antes de faltar)</h3>
          <ul className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100">
            {conAdelantos.map((s) => (
              <li key={s.pacienteId} className="px-4 py-3 text-sm">
                <span className="font-semibold text-stone-900">{s.nombre}</span>
                <span className="text-stone-600"> · {s.adelantos.map((u) => u.texto).join(', ')} · usó {s.topeUsado} de {s.frecuencia}</span>
                {s.adelantoSinFalta && (
                  <p className="flex items-center gap-1 text-xs text-amber-700 mt-1">
                    <AlertTriangle size={12} /> Adelantó y no faltó en {format(parseISO(`${mes}-01`), 'MMMM', { locale: es })}: decidís vos.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {sinDerecho.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Sin derecho a recuperar</h3>
          <ul className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100">
            {sinDerecho.map((x) => (
              <li key={`${x.saldo.pacienteId}_${x.motivo}_${x.fecha}_${x.hora}`} className="px-4 py-3 text-sm">
                <span className="font-semibold text-stone-900">{x.saldo.nombre}</span>
                <span className="text-stone-600"> · {x.texto}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {buscando && (
        <TpaBuscarLugar
          saldo={buscando.saldo}
          credito={buscando.credito}
          onCerrar={() => setBuscando(null)}
          onElegir={(celda) => {
            onElegirLugar(celda, { pacienteId: buscando.saldo.pacienteId, nombre: buscando.saldo.nombre });
            setBuscando(null);
          }}
        />
      )}

      {textoParaCopiar && (
        <Modal
          titulo="Copiá la lista"
          subtitulo="Este navegador no deja copiar solo: seleccioná el texto y copialo."
          onCerrar={() => setTextoParaCopiar(null)}
          ancho="lg"
          pie={<button type="button" onClick={() => setTextoParaCopiar(null)} className={BOTON_PIE_SECUNDARIO}>Cerrar</button>}
        >
          <div className="p-4 md:p-6">
            <textarea
              readOnly
              value={textoParaCopiar}
              onFocus={(e) => e.currentTarget.select()}
              rows={12}
              aria-label="Lista de recuperaciones"
              className="w-full bg-white border border-stone-200 text-stone-900 text-base md:text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
