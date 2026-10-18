"use client";

import { Search, Bell, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cerrarSesion } from '@/lib/auth';
import { mensajeError, registrarError } from '@/lib/errores';

export default function Header() {
  const [searchQuery, setSearchQuery] = useState('');
  const [saliendo, setSaliendo] = useState(false);
  const router = useRouter();

  const handleSalir = async () => {
    setSaliendo(true);
    try {
      await cerrarSesion();
      router.replace('/login');
      router.refresh();
    } catch (error: unknown) {
      registrarError('Error al cerrar sesión', error);
      alert(mensajeError(error)); // TODO Fase 0.5: Toast
      setSaliendo(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-stone-50/80 backdrop-blur-md border-b border-stone-200">
      <div className="flex h-16 items-center px-4 md:px-6 gap-4">
        {/* Search */}
        <div className="flex-1 flex items-center">
          <div className="relative w-full max-w-md group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 group-focus-within:text-teal-600 transition-colors" />
            <input
              type="text"
              placeholder="Buscar paciente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none placeholder:text-stone-400 text-stone-900"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 md:gap-4">
          <button className="relative p-2.5 text-stone-500 hover:text-stone-900 transition-all rounded-lg hover:bg-stone-100">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2 h-2 w-2 bg-rose-500 rounded-full border-2 border-stone-50"></span>
          </button>
          <div className="h-9 w-9 rounded-lg bg-teal-600 flex items-center justify-center text-white font-semibold text-sm">
            P
          </div>
          <button
            onClick={handleSalir}
            disabled={saliendo}
            aria-label="Salir"
            title="Salir"
            className="h-11 w-11 flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors duration-150 disabled:opacity-50"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
