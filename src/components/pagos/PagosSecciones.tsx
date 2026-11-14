"use client";

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  formatoPesos, textoHorarios, textoSueltas, textoVeces, type CuotaDelMes, type ResumenMes, type SesionDelMes,
  type SueltasDelMes,
} from '@/lib/pagos';
import { EstadoPagoChip } from './EstadoPagoChip';
import { BOTON_COBRAR_PRIMARIO, BOTON_COBRAR_SECUNDARIO, TablaPagos } from './TablaPagos';

interface PagosSeccionesProps {
  cuotas: CuotaDelMes[];
  sueltas: SueltasDelMes[];
  sesiones: SesionDelMes[];
  resumen: ResumenMes;
  onCobrarCuota: (c: CuotaDelMes) => void;
  onCobrarSueltas: (s: SueltasDelMes) => void;
  onCobrarSesion: (s: SesionDelMes) => void;
  onAbrirPaciente: (pacienteId: string) => void;
}

const totales = (cobrado: number, pendiente: number) =>
  `Cobrado ${formatoPesos(cobrado)} · Falta cobrar ${formatoPesos(pendiente)}`;

// Cuotas TPA por plan, clases sueltas y sesiones de RPG del mes (diseño 4.3).
export function PagosSecciones({
  cuotas, sueltas, sesiones, resumen, onCobrarCuota, onCobrarSueltas, onCobrarSesion, onAbrirPaciente,
}: PagosSeccionesProps) {
  const nombre = (pacienteId: string, texto: string) => (
    <button type="button" onClick={() => onAbrirPaciente(pacienteId)} className="text-left font-semibold text-stone-900 hover:text-teal-700">
      {texto}
    </button>
  );
  const boton = (pagado: boolean, onClick: () => void) => (
    <button type="button" onClick={onClick} className={pagado ? BOTON_COBRAR_SECUNDARIO : BOTON_COBRAR_PRIMARIO}>
      {pagado ? 'Ver' : 'Cobrar'}
    </button>
  );

  return (
    <div className="space-y-6">
      {cuotas.length === 0 && (
        <p className="text-sm text-stone-500 bg-white rounded-xl border border-dashed border-stone-200 py-6 px-4 text-center">
          No hay alumnos fijos de TPA este mes. Se inscriben desde TPA → Calendario, en cada lugar libre.
        </p>
      )}
      {resumen.planes.map((plan) => (
        <TablaPagos
          key={plan.veces}
          titulo={`TPA · ${textoVeces(plan.veces)} · pagaron ${plan.pagaron} de ${plan.alumnos}`}
          items={cuotas.filter((c) => Math.min(3, c.veces) === plan.veces)}
          clave={(c) => c.pacienteId}
          columnas={[
            { titulo: 'Alumno', celda: (c) => nombre(c.pacienteId, c.nombre) },
            { titulo: 'Horarios', celda: (c) => (c.fijo ? textoHorarios(c.fijo) : 'ya no es fijo') },
            { titulo: 'Estado', celda: (c) => <EstadoPagoChip pago={c.pago && { pagadoEl: c.pago.pagado_el, medio: c.pago.medio }} /> },
            {
              titulo: 'Importe', derecha: true,
              celda: (c) => c.pago ? formatoPesos(c.pago.importe) : <span className="text-stone-500">{formatoPesos(c.importePendiente)}</span>,
            },
          ]}
          accion={(c) => boton(Boolean(c.pago), () => onCobrarCuota(c))}
          pie={totales(plan.cobrado, plan.pendiente)}
        />
      ))}

      <TablaPagos
        titulo={`Clases sueltas TPA · ${resumen.sueltas.clases} ${resumen.sueltas.clases === 1 ? 'clase' : 'clases'}`}
        items={sueltas}
        clave={(s) => s.pacienteId}
        columnas={[
          { titulo: 'Persona', celda: (s) => nombre(s.pacienteId, s.nombre) },
          { titulo: 'Clases', celda: (s) => <>× {s.presentes} <span className="text-xs text-stone-500">({textoSueltas(s)})</span></> },
          {
            titulo: 'Estado',
            celda: (s) => s.pendientes > 0 || s.pagos.length === 0
              ? <EstadoPagoChip pago={null} textoPendiente={s.pendientes > 0 ? `Falta pagar ${s.pendientes}` : 'Nada para cobrar'} apagado={s.pendientes === 0} />
              : <EstadoPagoChip pago={{ pagadoEl: s.pagos.at(-1)?.pagado_el ?? null, medio: s.pagos.at(-1)?.medio ?? null }} />,
          },
          {
            titulo: 'Importe', derecha: true,
            celda: (s) => <>{formatoPesos(s.importePagado)}{s.importePendiente > 0 && <span className="text-pink-700"> + {formatoPesos(s.importePendiente)}</span>}</>,
          },
        ]}
        accion={(s) => boton(s.pendientes === 0, () => onCobrarSueltas(s))}
        pie={totales(resumen.sueltas.cobrado, resumen.sueltas.pendiente)}
      />

      <TablaPagos
        titulo={`RPG · ${resumen.rpg.sesiones} ${resumen.rpg.sesiones === 1 ? 'sesión' : 'sesiones'}`}
        items={sesiones}
        clave={(s) => s.sesion.id}
        columnas={[
          { titulo: 'Paciente', celda: (s) => nombre(s.sesion.paciente_id, s.nombre) },
          { titulo: 'Fecha', celda: (s) => <span className="capitalize">{format(parseISO(s.sesion.fecha), 'EEE d/M', { locale: es })} · {s.sesion.hora}</span> },
          { titulo: 'Tipo', celda: (s) => s.sesion.tipo_sesion ?? 'RPG' },
          {
            titulo: 'Estado',
            celda: (s) => (
              <EstadoPagoChip
                pago={s.pagada ? { pagadoEl: s.sesion.pagado_el ?? null, medio: s.sesion.medio_pago ?? null } : null}
                textoPendiente={s.futura ? 'Todavía no se hizo' : undefined}
                apagado={s.futura}
              />
            ),
          },
          { titulo: 'Importe', derecha: true, celda: (s) => formatoPesos(s.importe) },
        ]}
        accion={(s) => boton(s.pagada, () => onCobrarSesion(s))}
        pie={totales(resumen.rpg.cobrado, resumen.rpg.pendiente)}
      />
    </div>
  );
}
