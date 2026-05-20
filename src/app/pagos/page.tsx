"use client";

import { useState, useEffect, useMemo } from 'react';
import { DollarSign, AlertCircle, CheckCircle, Calendar, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { getPacientesConPagos, upsertPago } from '@/lib/queries';
import type { Pago, Paciente } from '@/types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/components/layout/Navigation';

interface PacienteConPago extends Paciente {
  pago: Pago | null;
}

export default function PagosPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [pacientesConPagos, setPacientesConPagos] = useState<PacienteConPago[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const mes = currentDate.getMonth() + 1; // 1-indexed
  const año = currentDate.getFullYear();

  const fetchPagos = async () => {
    setLoading(true);
    try {
      const data = await getPacientesConPagos(mes, año);
      setPacientesConPagos(data as PacienteConPago[]);
    } catch (error) {
      console.error("Error fetching pagos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPagos();
  }, [currentDate]);

  const handlePrevMonth = () => {
    setCurrentDate(prev => {
      const copy = new Date(prev);
      copy.setMonth(copy.getMonth() - 1);
      return copy;
    });
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => {
      const copy = new Date(prev);
      copy.setMonth(copy.getMonth() + 1);
      return copy;
    });
  };

  const handleToggleEstado = async (item: PacienteConPago) => {
    setSavingId(item.id);
    const nuevoEstado = item.pago?.estado === 'pagado' ? 'pendiente' : 'pagado';
    
    try {
      const payload: any = {
        paciente_id: item.id,
        mes,
        año,
        plan: item.pago?.plan || item.tipo_clase || 'RPG',
        precio: item.pago?.precio || (item.tipo_clase === 'RPG' ? 12000 : 8000), // Default values
        estado: nuevoEstado,
        fecha_pago: nuevoEstado === 'pagado' ? format(new Date(), 'yyyy-MM-dd') : null
      };

      if (item.pago?.id) {
        payload.id = item.pago.id;
      }

      await upsertPago(payload);

      // Refresh data
      const updatedData = await getPacientesConPagos(mes, año);
      setPacientesConPagos(updatedData as PacienteConPago[]);
    } catch (error: any) {
      console.error("Error toggling pago:", error);
      alert(`No se pudo registrar el pago: ${error.message || error.details || JSON.stringify(error)}`);
    } finally {
      setSavingId(null);
    }
  };

  const handleUpdateMontoPlan = async (item: PacienteConPago, precio: number, plan: string) => {
    setSavingId(item.id);
    try {
      const payload: any = {
        paciente_id: item.id,
        mes,
        año,
        plan: plan || item.pago?.plan || item.tipo_clase || 'RPG',
        precio: precio,
        estado: item.pago?.estado || 'pendiente',
        fecha_pago: item.pago?.fecha_pago || null
      };

      if (item.pago?.id) {
        payload.id = item.pago.id;
      }

      await upsertPago(payload);

      // Refresh
      const updatedData = await getPacientesConPagos(mes, año);
      setPacientesConPagos(updatedData as PacienteConPago[]);
    } catch (error: any) {
      console.error("Error updating precio/plan:", error);
      alert(`No se pudo actualizar el plan/importe: ${error.message || error.details || JSON.stringify(error)}`);
    } finally {
      setSavingId(null);
    }
  };

  // --- Financial Summary calculations ---
  const summary = useMemo(() => {
    let totalCobrado = 0;
    let totalPendiente = 0;
    let deudoresCount = 0;

    pacientesConPagos.forEach(item => {
      const precio = item.pago?.precio || (item.tipo_clase === 'RPG' ? 12000 : 8000);
      if (item.pago?.estado === 'pagado') {
        totalCobrado += precio;
      } else {
        totalPendiente += precio;
        deudoresCount++;
      }
    });

    return { totalCobrado, totalPendiente, deudoresCount };
  }, [pacientesConPagos]);

  return (
    <div className="flex flex-col h-full space-y-8 animate-in fade-in duration-500">
      
      {/* Title banner */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Pagos</h1>
          <p className="text-stone-600 mt-1 text-sm">Control mensual de facturación y cuotas de pacientes</p>
        </div>
        
        {/* Month Selector */}
        <div className="flex bg-stone-100 rounded-lg p-1 border border-stone-200 self-start sm:self-auto">
          <button 
            onClick={handlePrevMonth}
            className="p-1.5 rounded-md hover:bg-white hover:text-stone-900 text-stone-600 hover:shadow-sm transition-all cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="px-4 py-1.5 text-sm font-semibold text-stone-700 capitalize min-w-[140px] text-center flex items-center justify-center gap-2">
            <Calendar className="w-4 h-4 text-teal-600" />
            {format(currentDate, 'MMMM yyyy', { locale: es })}
          </span>
          <button 
            onClick={handleNextMonth}
            className="p-1.5 rounded-md hover:bg-white hover:text-stone-900 text-stone-600 hover:shadow-sm transition-all cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Total Cobrado */}
        <div className="bg-white border border-stone-200 rounded-xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-all duration-150">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider block">Total Cobrado</span>
            <p className="text-2xl font-bold text-emerald-600">${summary.totalCobrado.toLocaleString()}</p>
          </div>
          <div className="w-12 h-12 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Total Pendiente */}
        <div className="bg-white border border-stone-200 rounded-xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-all duration-150">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider block">Total Pendiente</span>
            <p className="text-2xl font-bold text-amber-600">${summary.totalPendiente.toLocaleString()}</p>
          </div>
          <div className="w-12 h-12 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-sm">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Deudores */}
        <div className="bg-white border border-stone-200 rounded-xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-all duration-150">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider block">Deudores Activos</span>
            <p className="text-2xl font-bold text-red-600">{summary.deudoresCount} pacientes</p>
          </div>
          <div className="w-12 h-12 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shadow-sm">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Billing Table */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse bg-white">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-stone-400 font-semibold text-xs uppercase tracking-wider">
                  <th className="p-4 pl-6">Paciente</th>
                  <th className="p-4">Plan / Tratamiento</th>
                  <th className="p-4">Importe Mensual ($)</th>
                  <th className="p-4">Estado de Pago</th>
                  <th className="p-4 pr-6">Fecha Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {pacientesConPagos.map((item) => {
                  const defaultPrice = item.tipo_clase === 'RPG' ? 12000 : 8000;
                  const currentPrice = item.pago?.precio !== undefined && item.pago?.precio !== null ? item.pago.precio : defaultPrice;
                  const currentPlan = item.pago?.plan || item.tipo_clase || 'RPG';
                  const isPaid = item.pago?.estado === 'pagado';

                  return (
                    <tr key={item.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-center text-xs font-semibold text-stone-600 shadow-sm">
                            <User className="w-4 h-4 text-stone-400" />
                          </div>
                          <span className="font-semibold text-stone-900">{item.nombre}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <select
                          value={currentPlan}
                          onChange={(e) => handleUpdateMontoPlan(item, currentPrice, e.target.value)}
                          className="bg-white border border-stone-200 text-stone-900 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                        >
                          <option value="RPG">RPG (Sesiones)</option>
                          <option value="TPA">TPA (Clases)</option>
                          <option value="ambos">Tratamiento Completo</option>
                        </select>
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          value={currentPrice}
                          onBlur={(e) => handleUpdateMontoPlan(item, Number(e.target.value), currentPlan)}
                          onChange={(e) => {
                            // Update local state temporarily to avoid lag on input
                            const temp = [...pacientesConPagos];
                            const idx = temp.findIndex(p => p.id === item.id);
                            if (idx !== -1) {
                              temp[idx] = {
                                ...temp[idx],
                                pago: {
                                  ...(temp[idx].pago || {}),
                                  precio: Number(e.target.value)
                                } as Pago
                              };
                              setPacientesConPagos(temp);
                            }
                          }}
                          className="bg-white border border-stone-200 text-stone-900 text-xs px-2.5 py-1.5 rounded-lg w-24 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                        />
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => handleToggleEstado(item)}
                          disabled={savingId === item.id}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm cursor-pointer",
                            isPaid
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/50"
                              : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/50"
                          )}
                        >
                          {savingId === item.id ? (
                            <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                          ) : isPaid ? (
                            "Cobrado"
                          ) : (
                            "Pendiente"
                          )}
                        </button>
                      </td>
                      <td className="p-4 pr-6 text-stone-500 text-xs">
                        {item.pago?.fecha_pago 
                          ? format(parseISO(item.pago.fecha_pago), "d MMM, yyyy", { locale: es })
                          : '--'}
                      </td>
                    </tr>
                  );
                })}

                {pacientesConPagos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-stone-400 bg-stone-50 rounded-xl border border-dashed border-stone-200">
                      No hay pacientes registrados para este mes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
