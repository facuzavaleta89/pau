import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pau Kinesio App",
  description: "Gestión de consultorio kinesiológico",
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
