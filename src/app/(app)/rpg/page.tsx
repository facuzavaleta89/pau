import { CalendarMonthView } from '@/components/rpg/CalendarMonthView';

export default function AgendaRPGPage() {
  return (
    <div className="flex flex-col h-full space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Agenda RPG</h1>
          <p className="text-stone-600 mt-1 text-sm">Reeducación Postural Global • Martes y Jueves</p>
        </div>
      </div>
      
      <div className="flex-1 bg-white rounded-xl border border-stone-200 overflow-hidden flex flex-col shadow-sm">
        <CalendarMonthView />
      </div>
    </div>
  );
}
