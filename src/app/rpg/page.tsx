import { CalendarMonthView } from '@/components/rpg/CalendarMonthView';

export default function AgendaRPGPage() {
  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Agenda RPG</h1>
          <p className="text-gray-500 mt-1">Martes y Jueves</p>
        </div>
      </div>
      
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <CalendarMonthView />
      </div>
    </div>
  );
}
