import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pau Kinesio App",
  description: "Gestión de consultorio kinesiológico",
};

// viewportFit "cover" hace que env(safe-area-inset-*) tenga valor en iPhone
// (barra de inicio abajo), para que la navegación inferior no quede debajo.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Layout raíz: solo html/body. La navegación vive en (app)/layout.tsx para
// que no aparezca en /login.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="bg-stone-50">
      <body className={`${inter.className} bg-stone-50 text-stone-900 antialiased selection:bg-teal-500/30 selection:text-teal-900`}>
        {children}
      </body>
    </html>
  );
}
