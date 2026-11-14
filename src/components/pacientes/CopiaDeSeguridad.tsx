"use client";

import { useState } from 'react';
import { AlertTriangle, Download, Loader2 } from 'lucide-react';
import { leerTablasParaCopia } from '@/lib/queries';
import { CLAVE_ULTIMA_COPIA, armarCopia, estadoCopia, nombreArchivoCopia } from '@/lib/copia';
import { mensajeError, registrarError } from '@/lib/errores';
import { cn } from '@/lib/utils';
import { useTextoGuardado } from '@/hooks/useValorGuardado';
import { useToast } from '@/components/ui/ToastProvider';

// "Descargar copia": todas las tablas en un JSON que se guarda en la compu de
// Pau (carpeta de descargas), con la fecha en el nombre. Tiene datos de
// salud: nunca va a la consola ni al repo. Muestra cuándo fue la última copia
// en este navegador y avisa si pasó más de una semana.
export function CopiaDeSeguridad() {
  const toast = useToast();
  const [ultima, guardarUltima] = useTextoGuardado(CLAVE_ULTIMA_COPIA);
  const [descargando, setDescargando] = useState(false);
  const [ahora] = useState(() => new Date());
  const estado = estadoCopia(ultima, ahora);

  const descargar = async () => {
    setDescargando(true);
    try {
      const momento = new Date();
      const copia = armarCopia(await leerTablasParaCopia(), momento);
      const url = URL.createObjectURL(new Blob([JSON.stringify(copia)], { type: 'application/json' }));
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = nombreArchivoCopia(momento);
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      guardarUltima(momento.toISOString());
      toast.exito(`Copia descargada: ${copia.filas.pacientes} pacientes. Guardala fuera de la compu también (pendrive o tu nube).`);
    } catch (err: unknown) {
      registrarError('Error descargando la copia', err);
      toast.error(`No se pudo descargar la copia. ${mensajeError(err)}`);
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div className="flex flex-col sm:items-end gap-1">
      <button
        type="button"
        onClick={descargar}
        disabled={descargando}
        className="h-11 px-4 bg-white hover:bg-stone-50 text-stone-700 text-sm font-medium rounded-lg border border-stone-200 transition-colors duration-150 flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {descargando ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        {descargando ? 'Preparando la copia…' : 'Descargar copia'}
      </button>
      <p className={cn('flex items-center gap-1 text-xs', estado.avisar ? 'text-amber-700 font-medium' : 'text-stone-500')}>
        {estado.avisar && <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />}
        {estado.texto}{estado.avisar && ultima ? ': conviene descargar una nueva' : ''}
      </p>
    </div>
  );
}
