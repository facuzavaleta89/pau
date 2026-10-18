import Navigation from "@/components/layout/Navigation";
import Header from "@/components/layout/Header";
import { AvisoSinConexion } from "@/components/layout/AvisoSinConexion";
import { SesionWatcher } from "@/components/auth/SesionWatcher";
import { VerificadorAutorizacion } from "@/components/auth/VerificadorAutorizacion";
import { ToastProvider } from "@/components/ui/ToastProvider";

// Layout de las pantallas que requieren sesión (/rpg, /tpa, /pacientes, /pagos).
// El grupo (app) no cambia las URLs.
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-stone-50">
        <SesionWatcher />
        <Navigation />
        {/* min-w-0: sin esto, un contenido ancho estira la columna y la página se desplaza de costado. */}
        <div className="flex-1 min-w-0 md:ml-64 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0 flex flex-col min-h-screen bg-stone-50">
          <Header />
          <AvisoSinConexion />
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 md:px-6 md:py-8 overflow-x-hidden">
            <VerificadorAutorizacion>{children}</VerificadorAutorizacion>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
