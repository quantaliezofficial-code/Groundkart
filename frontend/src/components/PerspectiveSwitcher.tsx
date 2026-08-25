import React, { useState } from 'react';
import { Layers, EyeOff, Eye } from 'lucide-react';

interface PerspectiveSwitcherProps {
  activeRole: 'client' | 'owner' | 'admin';
  setActiveRole: (role: 'client' | 'owner' | 'admin') => void;
}

export default function PerspectiveSwitcher({ activeRole, setActiveRole }: PerspectiveSwitcherProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 left-6 z-50 bg-[#141A16] text-[#F3FAF4] border border-[#EFFF00]/30 shadow-2xl rounded-full p-3 flex items-center gap-2 hover:bg-pitch active:scale-95 transition-all cursor-pointer group"
        title="Show Perspective Switcher"
        id="perspective-restore-btn"
      >
        <Layers size={18} className="text-[#EFFF00] group-hover:rotate-12 transition-transform" />
        <span className="text-[11px] font-mono font-bold tracking-wider pr-1">Role: {activeRole}</span>
        <Eye size={14} className="text-chalk/40 group-hover:text-chalk/80" />
      </button>
    );
  }

  return (
    <div 
      className="fixed bottom-6 left-6 z-50 bg-[#141A16] text-[#F3FAF4] border border-[#EFFF00]/30 shadow-2xl rounded-2xl p-4 max-w-xs space-y-3 animate-fade-in"
      id="perspective-switcher-widget"
    >
      <div className="flex items-center justify-between gap-6">
        <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-[#EFFF00] flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#EFFF00] inline-block animate-pulse" />
          Active Perspective
        </span>
        <div className="flex items-center gap-2">
          <span className="text-on-surface-variant text-[9px] font-mono font-semibold uppercase tracking-wider opacity-60">TEST FLIGHT</span>
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 hover:bg-chalk/10 rounded text-chalk/45 hover:text-chalk cursor-pointer transition-colors"
            title="Minimize to Corner"
            id="perspective-minimize-btn"
          >
            <EyeOff size={14} />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={() => setActiveRole('client')}
          className={`py-2 px-1 text-[11px] font-mono font-bold rounded-lg uppercase tracking-wider transition-all cursor-pointer text-center ${
            activeRole === 'client'
              ? 'bg-pitch text-[#F3FAF4] ring-1 ring-[#EFFF00] font-extrabold'
              : 'bg-chalk/5 hover:bg-chalk/10 text-chalk/60'
          }`}
          id="perspective-role-client"
        >
          Client
        </button>
        <button
          onClick={() => setActiveRole('owner')}
          className={`py-2 px-1 text-[11px] font-mono font-bold rounded-lg uppercase tracking-wider transition-all cursor-pointer text-center ${
            activeRole === 'owner'
              ? 'bg-[#EFFF00] text-[#141A16] font-extrabold shadow-sm'
              : 'bg-chalk/5 hover:bg-chalk/10 text-chalk/60'
          }`}
          id="perspective-role-owner"
        >
          Owner
        </button>
        <button
          onClick={() => setActiveRole('admin')}
          className={`py-2 px-1 text-[11px] font-mono font-bold rounded-lg uppercase tracking-wider transition-all cursor-pointer text-center ${
            activeRole === 'admin'
              ? 'bg-clay text-chalk font-extrabold'
              : 'bg-chalk/5 hover:bg-chalk/10 text-chalk/60'
          }`}
          id="perspective-role-admin"
        >
          Admin
        </button>
      </div>

      <p className="text-[9.5px] text-[#A6C0AF] leading-snug font-sans font-medium border-t border-chalk/10 pt-2 selection:bg-[#EFFF00] selection:text-pitch">
        {activeRole === 'client' && "Browse sports arenas, utilize detailed criteria filters, book events & complete transaction checkouts."}
        {activeRole === 'owner' && "Review and approve pending client reservation requests, submit listing requests, and configure availability flags."}
        {activeRole === 'admin' && "Evaluate total volumes, suspend/restore complex search indexing, adjust rates and override the global reservation ledger."}
      </p>
    </div>
  );
}
