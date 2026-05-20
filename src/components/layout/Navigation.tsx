"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Users, CreditCard, LayoutGrid } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: 'Agenda RPG', href: '/rpg', icon: Calendar },
  { name: 'Agenda TPA', href: '/tpa', icon: LayoutGrid },
  { name: 'Pacientes', href: '/pacientes', icon: Users },
  { name: 'Pagos', href: '/pagos', icon: CreditCard },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-gray-200 z-50 pb-safe">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1",
                  isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-900"
                )}
              >
                <Icon className={cn("w-6 h-6", isActive && "animate-pulse")} />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Sidebar Navigation */}
      <nav className="hidden md:flex flex-col w-64 h-screen fixed bg-slate-900 text-white border-r border-slate-800">
        <div className="p-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Pau Kinesio
          </h1>
        </div>
        <div className="flex flex-col space-y-2 px-4 flex-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200",
                  isActive 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
