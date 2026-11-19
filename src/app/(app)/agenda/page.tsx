import { PantallaAgenda } from '@/components/agenda/PantallaAgenda';

export default function AgendaPage() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Agenda</h1>
        <p className="text-stone-600 mt-1 text-sm">Turnos individuales y clases de TPA</p>
      </div>
      <PantallaAgenda />
    </div>
  );
}
