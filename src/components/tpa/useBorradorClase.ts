"use client";

import { useState } from "react";
import { esAviso, type EstadoAviso } from "@/lib/avisos";
import {
  BORRADOR_VACIO, filasDeLaClase, lugarParaOcupar, ocupanteDe,
  type BorradorClase, type EnlacesCambio, type FilaClase, type TipoOcupante,
} from "@/lib/clase-tpa";
import type { OpcionOcupar } from "@/lib/ocupar";
import type { CeldaTPA, EstadoAsistenciaTPA } from "@/types";
import type { PreguntaFila } from "./TpaAsistenciaFila";

export interface OcupanteInicial {
  pacienteId: string;
  nombre: string;
}

type Decision = 'sacar' | 'libre' | 'quitar_cambio' | 'cancelar';

const sinClave = <T,>(registro: Record<string, T>, clave: string) => {
  const copia = { ...registro };
  delete copia[clave];
  return copia;
};

// Estado de lo que Pau cambió en una clase y todavía no guardó, con las reglas
// que el trigger de la base exige: no se le cambia el estado a un fijo cuyo
// lugar está ocupado (o que es origen de un cambio) sin decidir qué pasa.
export function useBorradorClase(celda: CeldaTPA, enlaces: EnlacesCambio, inicial: OcupanteInicial | null) {
  const [borrador, setBorrador] = useState<BorradorClase>(() => {
    if (!inicial) return BORRADOR_VACIO;
    const lugar = lugarParaOcupar(filasDeLaClase(celda, BORRADOR_VACIO));
    return { ...BORRADOR_VACIO, nuevos: [{ ...inicial, tipo: 'recupera', ocupaLugarDe: lugar, cambioDe: null }] };
  });
  const [preguntas, setPreguntas] = useState<Record<string, PreguntaFila>>({});
  const filas = filasDeLaClase(celda, borrador);

  const fijarEstado = (b: BorradorClase, pacienteId: string, estado: EstadoAsistenciaTPA): BorradorClase =>
    ({ ...b, estados: { ...b.estados, [pacienteId]: estado } });

  const sacar = (b: BorradorClase, fila: FilaClase): BorradorClase =>
    fila.guardado === null
      ? { ...b, nuevos: b.nuevos.filter((n) => n.pacienteId !== fila.pacienteId), estados: sinClave(b.estados, fila.pacienteId) }
      : { ...b, quitar: [...b.quitar, fila.pacienteId] };

  const cambiarEstado = (pacienteId: string, estado: EstadoAsistenciaTPA) => {
    const fila = filas.find((f) => f.pacienteId === pacienteId);
    if (!fila) return;
    if (fila.tipo === 'fijo' && !esAviso(estado)) {
      const ocupante = ocupanteDe(filas, pacienteId);
      if (ocupante) {
        setPreguntas((p) => ({ ...p, [pacienteId]: { tipo: 'lugar_ocupado', estado, ocupante: ocupante.nombre } }));
        return;
      }
      const destino = enlaces.destinoDe.get(pacienteId);
      if (destino && !borrador.quitarCambios.some((q) => q.pacienteId === pacienteId)) {
        setPreguntas((p) => ({ ...p, [pacienteId]: { tipo: 'origen_de_cambio', estado, destino } }));
        return;
      }
    }
    setPreguntas((p) => sinClave(p, pacienteId));
    setBorrador((b) => fijarEstado(b, pacienteId, estado));
  };

  const resolver = (pacienteId: string, decision: Decision) => {
    const pregunta = preguntas[pacienteId];
    setPreguntas((p) => sinClave(p, pacienteId));
    if (!pregunta || decision === 'cancelar') return;
    setBorrador((b) => {
      let siguiente = b;
      if (pregunta.tipo === 'lugar_ocupado') {
        const ocupante = ocupanteDe(filas, pacienteId);
        if (ocupante && decision === 'sacar') siguiente = sacar(b, ocupante);
        if (ocupante && decision === 'libre') {
          siguiente = ocupante.guardado === null
            ? { ...b, nuevos: b.nuevos.map((n) => (n.pacienteId === ocupante.pacienteId ? { ...n, ocupaLugarDe: null } : n)) }
            : { ...b, liberar: [...b.liberar, ocupante.pacienteId] };
        }
      } else if (decision === 'quitar_cambio') {
        siguiente = { ...b, quitarCambios: [...b.quitarCambios, { pacienteId, ...pregunta.destino }] };
      }
      return fijarEstado(siguiente, pacienteId, pregunta.estado);
    });
  };

  const quitar = (pacienteId: string) => {
    const fila = filas.find((f) => f.pacienteId === pacienteId);
    if (fila) setBorrador((b) => sacar(b, fila));
  };

  const cambiarTipo = (pacienteId: string, tipo: TipoOcupante) =>
    setBorrador((b) => ({ ...b, nuevos: b.nuevos.map((n) => (n.pacienteId === pacienteId ? { ...n, tipo } : n)) }));

  /** Suma a quien eligió en el selector, en el lugar de ese fijo (o en el primero que quede). */
  const agregar = (opcion: OpcionOcupar, lugarDe: string | null, avisoOrigen: EstadoAviso | null) => {
    const origen = opcion.cambioDe;
    setBorrador((b) => ({
      ...b,
      nuevos: [...b.nuevos, {
        pacienteId: opcion.pacienteId,
        nombre: opcion.nombre,
        tipo: opcion.tipo,
        ocupaLugarDe: lugarDe ?? lugarParaOcupar(filasDeLaClase(celda, b)),
        cambioDe: origen ? { fecha: origen.fecha, hora: origen.hora, aviso: origen.yaAviso ? null : avisoOrigen } : null,
      }],
    }));
  };

  return {
    borrador, filas, preguntas,
    hayPreguntas: Object.keys(preguntas).length > 0,
    cambiarEstado, resolver, quitar, cambiarTipo, agregar,
  };
}
