"use client";

import { cn } from '@/lib/utils';

export interface ColumnaPagos<T> {
  titulo: string;
  celda: (item: T) => React.ReactNode;
  derecha?: boolean;
}

interface TablaPagosProps<T> {
  titulo: string;
  /** Al lado del título, en gris ("pagaron 2 de 3"). */
  detalle?: string;
  /** Sin filas: se muestra la sección con este texto. Sin `vacio`, la sección no se muestra. */
  vacio?: string;
  items: T[];
  clave: (item: T) => string;
  /** La primera es el nombre: encabeza la card en el celular. */
  columnas: ColumnaPagos<T>[];
  accion: (item: T) => React.ReactNode;
  /** Totales de la sección. */
  pie?: React.ReactNode;
}

export const BOTON_COBRAR =
  'min-h-11 md:min-h-9 px-3 inline-flex items-center justify-center gap-1.5 text-sm font-medium rounded-lg border transition-colors duration-150';
export const BOTON_COBRAR_PRIMARIO = cn(BOTON_COBRAR, 'text-white bg-teal-600 hover:bg-teal-700 border-teal-600');
export const BOTON_COBRAR_SECUNDARIO = cn(BOTON_COBRAR, 'text-stone-700 bg-white hover:bg-stone-50 border-stone-200');

// Una sección de /pagos: tabla en la compu, cards en el celular (mismos datos,
// nada se desplaza de costado en 390px).
export function TablaPagos<T>({ titulo, detalle, vacio, items, clave, columnas, accion, pie }: TablaPagosProps<T>) {
  if (items.length === 0 && !vacio) return null;
  const [principal, ...resto] = columnas;
  const encabezado = (
    <h2 className="flex flex-wrap items-baseline gap-x-2 text-base font-semibold text-stone-900">
      {titulo}
      {detalle && <span className="text-sm font-normal text-stone-500">{detalle}</span>}
    </h2>
  );

  if (items.length === 0) {
    return (
      <section className="space-y-2">
        {encabezado}
        <p className="text-sm text-stone-500 bg-white rounded-xl border border-dashed border-stone-200 py-4 px-4">{vacio}</p>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      {encabezado}

      <div className="hidden md:block bg-white border border-stone-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-xs text-stone-500 text-left">
            <tr>
              {columnas.map((c) => (
                <th key={c.titulo} className={cn('px-4 py-2 font-medium', c.derecha && 'text-right')}>{c.titulo}</th>
              ))}
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {items.map((item) => (
              <tr key={clave(item)}>
                {columnas.map((c) => (
                  <td key={c.titulo} className={cn('px-4 py-2 text-stone-700', c.derecha && 'text-right tabular-nums')}>{c.celda(item)}</td>
                ))}
                <td className="px-4 py-2 text-right w-px whitespace-nowrap">{accion(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {pie && <div className="px-4 py-2 border-t border-stone-200 bg-stone-50 text-sm text-stone-600 text-right">{pie}</div>}
      </div>

      <ul className="md:hidden space-y-2">
        {items.map((item) => (
          <li key={clave(item)} className="bg-white border border-stone-200 rounded-xl p-4 space-y-2">
            <div className="text-sm">{principal.celda(item)}</div>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
              {resto.map((c) => (
                <div key={c.titulo} className="contents">
                  <dt className="text-stone-500">{c.titulo}</dt>
                  <dd className="text-stone-700 min-w-0">{c.celda(item)}</dd>
                </div>
              ))}
            </dl>
            <div className="[&>button]:w-full">{accion(item)}</div>
          </li>
        ))}
        {pie && <li className="px-1 text-sm text-stone-600">{pie}</li>}
      </ul>
    </section>
  );
}
