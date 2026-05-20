"use client";

import { Search, Bell } from 'lucide-react';
import { useState } from 'react';

export default function Header() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="sticky top-0 z-40 w-full bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
      <div className="flex h-16 items-center px-4 md:px-6 gap-4">
        {/* Search */}
        <div className="flex-1 flex items-center">
          <div className="relative w-full max-w-md group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-violet-400 transition-colors" />
            <input
              type="text"
              placeholder="Buscar paciente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-colors outline-none placeholder:text-zinc-500 text-white"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 md:gap-4">
          <button className="relative p-2.5 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-zinc-800">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2 h-2 w-2 bg-rose-500 rounded-full border-2 border-zinc-900"></span>
          </button>
          <div className="h-9 w-9 rounded-lg bg-violet-600 flex items-center justify-center text-white font-semibold text-sm cursor-pointer hover:bg-violet-500 transition-colors">
            P
          </div>
        </div>
      </div>
    </header>
  );
}
