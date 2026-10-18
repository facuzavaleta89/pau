import { TpaAgenda } from '@/components/tpa/TpaAgenda';

export default function AgendaTPAPage() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Agenda TPA</h1>
        <p className="text-stone-600 mt-1 text-sm">Terapia Postural Activa · lunes, miércoles y viernes</p>
      </div>
      <TpaAgenda />
    </div>
  );
}
