"use client";

import { useState, useEffect, useMemo } from 'react';
import { DollarSign, AlertCircle, CheckCircle, Calendar, ChevronLeft, ChevronRight, Save, User } from 'lucide-react';
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
      await upsertPago({
        id: item.pago?.id, // If it already exists, use its id
        paciente_id: item.id,
        mes,
        año,
        plan: item.pago?.plan || item.tipo_clase || 'RPG',
        precio: item.pago?.precio || (item.tipo_clase === 'RPG' ? 12000 : 8000), // Default values
        estado: nuevoEstado,
        fecha_pago: nuevoEstado === 'pagado' ? format(new Date(), 'yyyy-MM-dd') : null
      });
      // Refresh data
      const updatedData = await getPacientesConPagos(mes, año);
      setPacientesConPagos(updatedData as PacienteConPago[]);
    } catch (error) {
      console.error("Error toggling pago:", error);
      alert("No se pudo registrar el pago");
    } finally {
      setSavingId(null);
    }
  };

  const handleUpdateMontoPlan = async (item: PacienteConPago, precio: number, plan: string) => {
    setSavingId(item.id);
    try {
      await upsertPago({
        id: item.pago?.id,
        paciente_id: item.id,
        mes,
        año,
        plan: plan || item.pago?.plan || item.tipo_clase || 'RPG',
        precio: precio,
        estado: item.pago?.estado || 'pendiente',
        fecha_pago: item.pago?.fecha_pago || null
      });
      // Refresh
      const updatedData = await getPacientesConPagos(mes, año);
      setPacientesConPagos(updatedData as PacienteConPago[]);
    } catch (error) {
      console.error("Error updating precio/plan:", error);
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
          <h1 className="text-2xl font-semibold text-white">Pagos</h1>
          <p className="text-zinc-400 mt-1 text-sm">Control mensual de facturación y cuotas de pacientes</p>
        </div>
        
        {/* Month Selector */}
        <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800 self-start sm:self-auto">
          <button 
            onClick={handlePrevMonth}
            className="p-1.5 rounded-md hover:bg-zinc-800 hover:text-white text-zinc-400 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="px-4 py-1.5 text-sm font-semibold text-white capitalize min-w-[140px] text-center flex items-center justify-center gap-2">
            <Calendar className="w-4 h-4 text-violet-400" />
            {format(currentDate, 'MMMM yyyy', { locale: es })}
          </span>
          <button 
            onClick={handleNextMonth}
            className="p-1.5 rounded-md hover:bg-zinc-800 hover:text-white text-zinc-400 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Total Cobrado */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Total Cobrado</span>
            <p className="text-2xl font-bold text-emerald-400">${summary.totalCobrado.toLocaleString()}</p>
          </div>
          <div className="w-12 h-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Total Pendiente */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Total Pendiente</span>
            <p className="text-2xl font-bold text-amber-400">${summary.totalPendiente.toLocaleString()}</p>
          </div>
          <div className="w-12 h-12 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Deudores */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Deudores Activos</span>
            <p className="text-2xl font-bold text-rose-400">{summary.deudoresCount} pacientes</p>
          </div>
          <div className="w-12 h-12 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Billing Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400 font-medium">
                  <th className="p-4 pl-6">Paciente</th>
                  <th className="p-4">Plan / Tratamiento</th>
                  <th className="p-4">Importe Mensual ($)</th>
                  <th className="p-4">Estado de Pago</th>
                  <th className="p-4 pr-6">Fecha Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {pacientesConPagos.map((item) => {
                  const defaultPrice = item.tipo_clase === 'RPG' ? 12000 : 8000;
                  const currentPrice = item.pago?.precio !== undefined && item.pago?.precio !== null ? item.pago.precio : defaultPrice;
                  const currentPlan = item.pago?.plan || item.tipo_clase || 'RPG';
                  const isPaid = item.pago?.estado === 'pagado';

                  return (
                    <tr key={item.id} className="hover:bg-zinc-950/40 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-300">
                            <User className="w-4 h-4 text-zinc-500" />
                          </div>
                          <span className="font-semibold text-white">{item.nombre}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <select
                          value={currentPlan}
                          onChange={(e) => handleUpdateMontoPlan(item, currentPrice, e.target.value)}
                          className="bg-zinc-800 border border-zinc-700 text-white text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-violet-500"
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
                          className="bg-zinc-800 border border-zinc-700 text-white text-xs px-2.5 py-1.5 rounded-lg w-24 focus:outline-none focus:border-violet-500"
                        />
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => handleToggleEstado(item)}
                          disabled={savingId === item.id}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5",
                            isPaid
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
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
                      <td className="p-4 pr-6 text-zinc-400 text-xs">
                        {item.pago?.fecha_pago 
                          ? format(parseISO(item.pago.fecha_pago), "d MMM, yyyy", { locale: es })
                          : '--'}
                      </td>
                    </tr>
                  );
                })}

                {pacientesConPagos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-zinc-500">
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
