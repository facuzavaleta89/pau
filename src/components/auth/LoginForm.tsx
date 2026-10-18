"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LayoutGrid, Loader2 } from 'lucide-react';
import { iniciarSesion } from '@/lib/auth';
import { mensajeError, registrarError } from '@/lib/errores';

interface LoginFormProps {
  destino: string;
  sesionCerrada: boolean;
}

const claseInput =
  'w-full h-11 bg-white border border-stone-200 text-stone-900 text-base px-3 rounded-lg placeholder:text-stone-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';

export function LoginForm({ destino, sesionCerrada }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await iniciarSesion(email.trim(), password);
      router.replace(destino);
      router.refresh();
    } catch (err: unknown) {
      registrarError('Error al iniciar sesión', err);
      setError(mensajeError(err));
      setCargando(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="flex items-center justify-center gap-2 mb-8">
        <span className="bg-teal-600 text-white p-1.5 rounded-lg shadow-sm">
          <LayoutGrid className="w-5 h-5" />
        </span>
        <span className="text-2xl font-bold tracking-tighter text-stone-900">
          Pau<span className="text-stone-500 font-normal">Kinesio</span>
        </span>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-2xl shadow-sm p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-stone-900">Ingresar</h1>

        {sesionCerrada && !error && (
          <p className="text-sm bg-amber-50 text-amber-800 border border-amber-200 rounded-lg px-3 py-2">
            Tu sesión se cerró. Volvé a entrar.
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-medium text-stone-600">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            autoCapitalize="none"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={claseInput}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-medium text-stone-600">Contraseña</label>
          <div className="relative">
            <input
              id="password"
              type={verPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${claseInput} pr-12`}
            />
            <button
              type="button"
              onClick={() => setVerPassword((v) => !v)}
              aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-stone-400 hover:text-stone-700 transition-colors duration-150"
            >
              {verPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={cargando}
          className="w-full h-11 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors duration-150 disabled:opacity-50"
        >
          {cargando && <Loader2 size={16} className="animate-spin" />}
          {cargando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
