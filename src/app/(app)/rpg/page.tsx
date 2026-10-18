import { AgendaRPG } from '@/components/rpg/AgendaRPG';

export default function AgendaRPGPage() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Agenda RPG</h1>
        <p className="text-stone-600 mt-1 text-sm">Reeducación Postural Global · martes y jueves</p>
      </div>
      <AgendaRPG />
    </div>
  );
}
