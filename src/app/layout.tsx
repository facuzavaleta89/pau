import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // assuming there's a globals.css, wait I should use the correct css file
import Navigation from "@/components/layout/Navigation";
import Header from "@/components/layout/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pau Kinesio App",
  description: "Gestión de consultorio kinesiológico",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased`}>
        <div className="flex min-h-screen">
          <Navigation />
          <div className="flex-1 md:ml-64 pb-16 md:pb-0 flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-hidden">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
