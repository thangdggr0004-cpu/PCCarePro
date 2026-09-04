import React, { useState } from 'react';
import {
  Search,
  BookOpen,
  Settings,
} from 'lucide-react';
import Tooltip from './ui/Tooltip.js';
import UserGuideModal from './UserGuideModal.js';

interface TopToolbarProps {
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onNavigate?: (section: string) => void;
}

export default function TopToolbar({
  onOpenSearch,
  onOpenSettings,
  onNavigate,
}: TopToolbarProps) {
  const [showUserGuide, setShowUserGuide] = useState(false);

  return (
    <header className="w-full h-14 bg-[#0d1424] border-b border-slate-800/80 px-4 md:px-6 flex items-center justify-between shrink-0 relative z-30 select-none">
      {/* ── Left: Brand Header (PC CARE MASTER PRO SUITE) ── */}
      <div className="flex items-center gap-2.5 w-52 md:w-56 lg:w-60 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
          <div className="w-4 h-4 border-2 border-white rounded-[3px] rotate-45 flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
          </div>
        </div>
        <div className="min-w-0">
          <h1 className="text-xs font-extrabold text-white tracking-wider leading-none truncate">
            PC CARE MASTER
          </h1>
          <span className="text-[9px] text-emerald-400 font-bold tracking-widest uppercase block mt-0.5">
            PRO SUITE
          </span>
        </div>
      </div>

      {/* ── Center: Search Input (Centered) ── */}
      <div className="flex-1 max-w-md mx-auto px-4">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between gap-3 px-3.5 py-1.5 bg-[#131d33] hover:bg-[#162442] border border-slate-700/60 hover:border-emerald-500/40 rounded-xl text-left text-xs text-slate-400 transition cursor-pointer group shadow-inner"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 transition-colors" />
            <span className="truncate text-slate-400 group-hover:text-slate-200">
              Tìm kiếm tính năng, công cụ...
            </span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-400 bg-slate-800 border border-slate-700 rounded-md">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* ── Right Controls ── */}
      <div className="flex items-center gap-2 md:gap-3 w-52 md:w-56 lg:w-60 justify-end shrink-0">
        {/* User Guide Button */}
        <Tooltip content="Cẩm nang hướng dẫn sử dụng tool" position="bottom">
          <button
            onClick={() => setShowUserGuide(true)}
            className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 flex items-center justify-center transition cursor-pointer border border-slate-700/50 relative group"
            title="Cẩm nang hướng dẫn sử dụng"
          >
            <BookOpen className="w-4 h-4 transition-transform group-hover:scale-110" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full shadow-sm shadow-emerald-400/50" />
          </button>
        </Tooltip>

        {/* Settings */}
        <Tooltip content="Cài đặt ứng dụng" position="bottom">
          <button
            onClick={onOpenSettings}
            className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 flex items-center justify-center transition cursor-pointer border border-slate-700/50"
          >
            <Settings className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>

      {/* User Guide Modal Dialog (Option B) */}
      <UserGuideModal
        isOpen={showUserGuide}
        onClose={() => setShowUserGuide(false)}
        onNavigate={onNavigate}
      />
    </header>
  );
}
