"use client";

import { useCallback, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cargarDatosHorarios, getHorariosTPA, reactivarPaciente } from '@/lib/queries';
import { conflictoAlReactivar, horariosCerradosConLaBaja } from '@/lib/horarios';
import { diaYMes, hoyArgentina } from '@/lib/pagos';
import { CUPO_TPA, DIAS_TPA } from '@/lib/tpa';
import { mensajeErrorAlGuardar, registrarError } from '@/lib/errores';
import type { Paciente } from '@/types';
import { useDatos } from '@/hooks/useDatos';
import { useToast } from '@/components/ui/ToastProvider';
import { Modal, BOTON_PIE_PRIMARIO, BOTON_PIE_SECUNDARIO } from '@/components/ui/Modal';
import { EstadoCarga } from '@/components/ui/EstadoCarga';

interface ReactivarPacienteDialogProps {
  paciente: Pick<Paciente, 'id' | 'nombre' | 'fecha_baja'>;
  onCancelar: () => void;
  onHecho: () => void;
}

const TITULO = 'text-xs font-semibold text-stone-400 uppercase tracking-wider';

// "Reactivar" en la ficha: el paciente vuelve a las listas y, aparte, se
// pueden recuperar los horarios de TPA que se cerraron con su baja (todas
// las casillas marcadas, salvo las que ya no tienen lugar). Todo en una
// transacción (reactivar_paciente). Se monta al abrir.
export function ReactivarPacienteDialog({ paciente, onCancelar, onHecho }: ReactivarPacienteDialogProps) {
  const toast = useToast();
  const [hoy] = useState(() => hoyArgentina(new Date()));
  const cargar = useCallback(async () => {
    const cerrados = horariosCerradosConLaBaja(paciente.fecha_baja, await getHorariosTPA(paciente.id));
    const datos = cerrados.length > 0 ? await cargarDatosHorarios(paciente.id, cerrados.map((h) => h.hora)) : null;
    return cerrados.map((h) => ({
      horario: h,
      conflicto: datos ? conflictoAlReactivar(h, datos, { cupo: CUPO_TPA, hoy, pacienteActivo: true }) : null,
    }));
  }, [paciente.id, paciente.fecha_baja, hoy]);
  const { datos: horarios, cargando, error, recargar } = useDatos(`reactivar_${paciente.id}`, cargar, 'No se pudieron revisar sus horarios.');
  // null = todavía no tocó ninguna casilla: van marcadas todas las que se pueden.
  const [marcados, setMarcados] = useState<Set<string> | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);

  const elegidos = useMemo(() => {
    const posibles = (horarios ?? []).filter((x) => !x.conflicto).map((x) => x.horario.id);
    return marcados ? posibles.filter((id) => marcados.has(id)) : posibles;
  }, [horarios, marcados]);

  const alternar = (id: string) => {
    const nuevo = new Set(elegidos);
    if (nuevo.has(id)) nuevo.delete(id); else nuevo.add(id);
    setMarcados(nuevo);
  };

  const confirmar = async () => {
    setGuardando(true);
    setErrorGuardar(null);
    try {
      const n = await reactivarPaciente(paciente.id, elegidos);
      toast.exito(`${paciente.nombre}: reactivado${n > 0 ? ` (${n === 1 ? '1 horario recuperado' : `${n} horarios recuperados`})` : ''}`);
      onHecho();
    } catch (err: unknown) {
      registrarError('Error reactivando al paciente', err);
      setErrorGuardar(mensajeErrorAlGuardar('No se pudo reactivar. No se cambió nada.', err));
      recargar();
    } finally {
      setGuardando(false);
    }
  };

  const textoBoton = elegidos.length === 0 ? 'Reactivar'
    : `Reactivar y recuperar ${elegidos.length === 1 ? '1 horario' : `${elegidos.length} horarios`}`;

  return (
    <Modal
      titulo={`¿Reactivar a ${paciente.nombre}?`}
      onCerrar={() => !guardando && onCancelar()}
      ancho="lg"
      capa={60}
      pie={
        <>
          <button type="button" onClick={onCancelar} disabled={guardando} className={BOTON_PIE_SECUNDARIO}>Cancelar</button>
          <button type="button" onClick={confirmar} disabled={guardando || !horarios} className={BOTON_PIE_PRIMARIO}>
            {guardando && <Loader2 size={16} className="animate-spin" />}
            {textoBoton}
          </button>
        </>
      }
    >
      <div className="p-4 md:p-6 space-y-5">
        <section className="space-y-1">
          <h3 className={TITULO}>1. El paciente</h3>
          <p className="text-sm text-stone-700">Vuelve a aparecer en las listas para elegir pacientes. Su historia y sus pagos ya estaban guardados.</p>
        </section>

        <section className="space-y-2 border-t border-stone-200 pt-4">
          <h3 className={TITULO}>2. Sus horarios de TPA (aparte)</h3>
          {!horarios ? (
            <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} />
          ) : horarios.length === 0 ? (
            <p className="text-sm text-stone-600">No tenía horarios fijos cerrados con la baja. Si vuelve a TPA, inscribilo desde TPA → Calendario.</p>
          ) : (
            <>
              <p className="text-sm text-stone-600">
                Reactivar al paciente <strong>no</strong> le devuelve sus horarios. Marcá los que recupera: vuelve a ser fijo como si la baja del {diaYMes(paciente.fecha_baja ?? '')} no hubiera existido.
              </p>
              <ul className="space-y-2">
                {horarios.map(({ horario: h, conflicto }) => (
                  <li key={h.id}>
                    <label className={`flex items-start gap-3 p-3 rounded-lg border ${conflicto ? 'bg-stone-50 border-stone-200 cursor-not-allowed' : 'bg-white border-stone-200 cursor-pointer hover:bg-stone-50'}`}>
                      <input
                        type="checkbox"
                        checked={elegidos.includes(h.id)}
                        disabled={Boolean(conflicto) || guardando}
                        onChange={() => alternar(h.id)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-teal-600"
                      />
                      <span className="min-w-0">
                        <span className={`block text-sm font-medium ${conflicto ? 'text-stone-500' : 'text-stone-900'}`}>
                          {DIAS_TPA.find((d) => d.id === h.dia_semana)?.label} {h.hora}
                        </span>
                        {conflicto && <span className="block text-sm text-amber-800 mt-0.5">No se puede recuperar: {conflicto}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {errorGuardar && (
          <p role="alert" className="text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">{errorGuardar}</p>
        )}
      </div>
    </Modal>
  );
}
