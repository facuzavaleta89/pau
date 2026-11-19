import { redirect } from 'next/navigation';

// "Turnos individuales" pasó a ser la Agenda (Día | Semana | Mes). Se deja la
// ruta para los marcadores y el historial del navegador.
export default function TurnosPage() {
  redirect('/agenda');
}
