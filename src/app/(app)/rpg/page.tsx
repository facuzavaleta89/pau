import { AgendaRPG } from '@/components/rpg/AgendaRPG';

export default function AgendaRPGPage() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Turnos individuales</h1>
        <p className="text-stone-600 mt-1 text-sm">RPG, masajes, evaluaciones y clases a domicilio, cualquier día</p>
      </div>
      <AgendaRPG />
    </div>
  );
}
