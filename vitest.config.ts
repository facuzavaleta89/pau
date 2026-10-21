import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Las fechas de la app se calculan en la hora del dispositivo de Pau
// (Argentina). Los tests corren con la misma zona para dar igual en cualquier
// máquina. Se fija acá, antes de que Vitest arranque los procesos de test.
process.env.TZ = 'America/Argentina/Buenos_Aires';

// Solo funciones puras de src/lib (sin navegador ni base de datos).
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
