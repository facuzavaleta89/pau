"use client";

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { escucharCierreInesperado } from '@/lib/auth';

// Si la sesión se cierra sola mientras Pau usa la app (token revocado, salió
// en otra pestaña), la lleva al login avisándole y recordando dónde estaba.
export function SesionWatcher() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    return escucharCierreInesperado(() => {
      const params = new URLSearchParams({ motivo: 'sesion-cerrada', next: pathname });
      router.replace(`/login?${params.toString()}`);
    });
  }, [router, pathname]);

  return null;
}
