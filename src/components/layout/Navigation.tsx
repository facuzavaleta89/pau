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
      <nav className="md:hidden fixed bottom-0 w-full bg-white/90 backdrop-blur-md border-t border-stone-200 z-50 pb-safe shadow-lg">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors duration-150",
                  isActive ? "text-teal-600" : "text-stone-500 hover:text-stone-700"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive && "scale-110 text-teal-600")} strokeWidth={isActive ? 2.5 : 2} />
                <span className={cn("text-[10px]", isActive ? "font-semibold text-teal-600" : "font-medium text-stone-500")}>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Sidebar Navigation */}
      <nav className="hidden md:flex flex-col w-64 h-screen fixed bg-white border-r border-stone-200 z-40">
        <div className="p-8">
          <h1 className="text-2xl font-bold tracking-tighter text-stone-900 flex items-center gap-2">
            <span className="bg-teal-600 text-white p-1.5 rounded-lg shadow-sm">
              <LayoutGrid className="w-5 h-5" />
            </span>
            Pau<span className="text-stone-500 font-normal">Kinesio</span>
          </h1>
        </div>
        <div className="flex flex-col space-y-1.5 px-4 flex-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-150",
                  isActive 
                    ? "bg-teal-50 text-teal-700 font-semibold" 
                    : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                )}
              >
                <Icon className={cn("w-5 h-5 transition-transform duration-150", isActive ? "scale-110 text-teal-600" : "text-stone-400 group-hover:scale-110 group-hover:text-stone-900")} strokeWidth={isActive ? 2.5 : 2} />
                <span className="font-medium tracking-tight">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
