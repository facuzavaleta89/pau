import { PagosDelMes } from '@/components/pagos/PagosDelMes';

export default function PagosPage() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Pagos</h1>
        <p className="text-stone-600 mt-1 text-sm">Cuotas y clases sueltas de TPA y sesiones de RPG del mes</p>
      </div>
      <PagosDelMes />
    </div>
  );
}
