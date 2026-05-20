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
      <nav className="md:hidden fixed bottom-0 w-full bg-zinc-950 border-t border-zinc-800 z-50 pb-safe">
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
                  isActive ? "text-violet-400" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive && "scale-110")} strokeWidth={isActive ? 2.5 : 2} />
                <span className={cn("text-[10px]", isActive ? "font-semibold" : "font-medium")}>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Sidebar Navigation */}
      <nav className="hidden md:flex flex-col w-64 h-screen fixed bg-zinc-950 border-r border-zinc-800 z-40">
        <div className="p-8">
          <h1 className="text-2xl font-bold tracking-tighter text-white flex items-center gap-2">
            <span className="bg-violet-600 text-white p-1.5 rounded-lg shadow-sm">
              <LayoutGrid className="w-5 h-5" />
            </span>
            Pau<span className="text-zinc-500 font-normal">Kinesio</span>
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
                  "group flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors duration-150",
                  isActive 
                    ? "bg-violet-600 text-white" 
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300"
                )}
              >
                <Icon className={cn("w-5 h-5 transition-transform duration-150", isActive ? "scale-110" : "group-hover:scale-110")} strokeWidth={isActive ? 2.5 : 2} />
                <span className={cn("font-medium tracking-tight", isActive ? "font-semibold" : "")}>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
