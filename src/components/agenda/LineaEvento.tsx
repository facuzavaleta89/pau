"use client";

import type { EventoAgenda } from '@/lib/agenda';
import type { AccionesAgenda } from './acciones';
import { LineaClase } from './LineaClase';
import { LineaTurno } from './LineaTurno';

// Un turno o una clase en una línea: tocarlo abre su modal.
export function LineaEvento({ evento, acciones }: { evento: EventoAgenda; acciones: AccionesAgenda }) {
  return evento.tipo === 'turno'
    ? <LineaTurno turno={evento.turno} onClick={() => acciones.onEditarTurno(evento.turno)} />
    : <LineaClase celda={evento.celda} onClick={() => acciones.onAbrirClase(evento.celda)} />;
}
