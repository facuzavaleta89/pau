import Navigation from "@/components/layout/Navigation";
import Header from "@/components/layout/Header";
import { SesionWatcher } from "@/components/auth/SesionWatcher";

// Layout de las pantallas que requieren sesión (/rpg, /tpa, /pacientes, /pagos).
// El grupo (app) no cambia las URLs.
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen bg-stone-50">
      <SesionWatcher />
      <Navigation />
      <div className="flex-1 md:ml-64 pb-16 md:pb-0 flex flex-col min-h-screen bg-stone-50">
        <Header />
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-hidden bg-stone-50">
          {children}
        </main>
      </div>
    </div>
  );
}
