import { LoginForm } from '@/components/auth/LoginForm';

interface LoginPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// Solo acepta rutas internas ("/tpa"), nunca URLs externas ("//sitio.com" o
// "/\sitio.com", que algunos navegadores interpretan igual).
function destinoSeguro(next: string | string[] | undefined): string {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/rpg';
  return next;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, motivo } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50 px-4 py-6">
      <LoginForm destino={destinoSeguro(next)} sesionCerrada={motivo === 'sesion-cerrada'} />
    </main>
  );
}
