"use client";

import { useCallback, useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import { cargarPagosMes } from '@/lib/queries';
import {
  calcularPagosDelMes, conMayuscula, hoyArgentina, medioSugerido, moverMes, nombreMes, textoPendientes,
  type CuotaDelMes, type SesionDelMes, type SueltasDelMes,
} from '@/lib/pagos';
import { useDatos } from '@/hooks/useDatos';
import { useToast } from '@/components/ui/ToastProvider';
import { SemanaNav } from '@/components/ui/SemanaNav';
import { EstadoCarga } from '@/components/ui/EstadoCarga';
import { Modal, BOTON_PIE_SECUNDARIO } from '@/components/ui/Modal';
import { HistoriaClinicaModal } from '@/components/pacientes/HistoriaClinicaModal';
import { AvisoPrecios } from './AvisoPrecios';
import { PagosCifras } from './PagosCifras';
import { PagosSecciones } from './PagosSecciones';
import { CobrarCuota } from './CobrarCuota';
import { CobrarSueltas } from './CobrarSueltas';
import { CobrarSesionRPG } from './CobrarSesionRPG';

type Cobrando =
  | { tipo: 'cuota'; item: CuotaDelMes }
  | { tipo: 'sueltas'; item: SueltasDelMes }
  | { tipo: 'rpg'; item: SesionDelMes };

// Pagos del mes (diseño 4.3): cifras, precios, cuotas TPA por plan, clases
// sueltas, RPG y "Copiar pendientes". Reemplaza la pantalla vieja.
export function PagosDelMes() {
  const toast = useToast();
  const [hoy] = useState(() => hoyArgentina(new Date()));
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [cobrando, setCobrando] = useState<Cobrando | null>(null);
  const [pacienteHistoria, setPacienteHistoria] = useState<string | null>(null);
  const [textoParaCopiar, setTextoParaCopiar] = useState<string | null>(null);

  const cargar = useCallback(() => cargarPagosMes(mes), [mes]);
  const { datos, cargando, error, recargar } = useDatos(mes, cargar, 'No se pudieron cargar los pagos.');
  const calculo = useMemo(() => (datos ? calcularPagosDelMes(datos, hoy) : null), [datos, hoy]);
  const medio = (pacienteId: string) => medioSugerido(datos?.pagos ?? [], pacienteId);

  // Sin portapapeles (http en la red local, navegador viejo): se muestra el texto para copiar a mano.
  const copiar = async () => {
    if (!calculo) return;
    const texto = textoPendientes(mes, calculo.cuotas, calculo.sueltas, calculo.sesiones);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('sin portapapeles');
      await navigator.clipboard.writeText(texto);
      toast.exito('Pendientes copiados: pegalos en WhatsApp');
    } catch {
      setTextoParaCopiar(texto);
    }
  };

  const precios = calculo?.vigentes?.precios ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="md:w-80">
          <SemanaNav
            etiqueta={conMayuscula(nombreMes(mes))}
            onAnterior={() => setMes(moverMes(mes, -1))}
            onHoy={() => setMes(hoy.slice(0, 7))}
            onSiguiente={() => setMes(moverMes(mes, 1))}
            textoAnterior="Mes anterior"
            textoSiguiente="Mes siguiente"
          />
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={copiar}
          disabled={!calculo}
          className="h-11 px-4 flex items-center justify-center gap-2 text-sm font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-300 rounded-lg disabled:opacity-50"
        >
          <Copy size={16} /> Copiar pendientes
        </button>
      </div>

      {!calculo ? (
        <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} />
      ) : (
        <>
          <PagosCifras resumen={calculo.resumen} />
          <AvisoPrecios mes={mes} vigentes={calculo.vigentes} onGuardado={recargar} conLinea />
          <PagosSecciones
            cuotas={calculo.cuotas}
            sueltas={calculo.sueltas}
            sesiones={calculo.sesiones}
            resumen={calculo.resumen}
            onCobrarCuota={(item) => setCobrando({ tipo: 'cuota', item })}
            onCobrarSueltas={(item) => setCobrando({ tipo: 'sueltas', item })}
            onCobrarSesion={(item) => setCobrando({ tipo: 'rpg', item })}
            onAbrirPaciente={setPacienteHistoria}
          />
        </>
      )}

      {cobrando?.tipo === 'cuota' && (
        <CobrarCuota cuota={cobrando.item} mes={mes} precios={precios} medioSugerido={medio(cobrando.item.pacienteId)}
          onCerrar={() => setCobrando(null)} onGuardado={recargar} onAbrirPaciente={setPacienteHistoria} />
      )}
      {cobrando?.tipo === 'sueltas' && (
        <CobrarSueltas sueltas={cobrando.item} mes={mes} precios={precios} medioSugerido={medio(cobrando.item.pacienteId)}
          onCerrar={() => setCobrando(null)} onGuardado={recargar} />
      )}
      {cobrando?.tipo === 'rpg' && (
        <CobrarSesionRPG item={cobrando.item} medioSugerido="transferencia" onCerrar={() => setCobrando(null)} onGuardado={recargar} />
      )}

      {textoParaCopiar && (
        <Modal
          titulo="Copiá los pendientes"
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
              rows={14}
              aria-label="Pagos pendientes"
              className="w-full bg-white border border-stone-200 text-stone-900 text-base md:text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
        </Modal>
      )}

      <HistoriaClinicaModal isOpen={pacienteHistoria !== null} onClose={() => setPacienteHistoria(null)} pacienteId={pacienteHistoria} onCambioPaciente={recargar} />
    </div>
  );
}
