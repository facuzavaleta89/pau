"use client";

import { Search, Bell } from 'lucide-react';
import { useState } from 'react';

export default function Header() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="flex h-16 items-center px-4 md:px-6 gap-4">
        {/* Search */}
        <div className="flex-1 flex items-center">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar paciente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 border-transparent rounded-full text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button className="relative p-2 text-gray-500 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-500 to-emerald-400 flex items-center justify-center text-white font-bold text-sm shadow-sm">
            P
          </div>
        </div>
      </div>
    </header>
  );
}
