import React from 'react';

interface ProgressBarProps {
  progress: number;
  progressText: string;
  color?: string; // default blue gradient
}

export default function ProgressBarComponent({ progress, progressText, color = 'from-emerald-500 to-emerald-600' }: ProgressBarProps) {
  const totalBlocks = 24;
  const filledBlocks = Math.floor((progress / 100) * totalBlocks);
  const emptyBlocks = Math.max(0, totalBlocks - filledBlocks);
  const bar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

  return (
    <div className="space-y-1.5 font-mono text-xs w-full bg-slate-50/80 p-3 rounded-lg border border-slate-200/80 shadow-inner">
      <div className="flex justify-between items-center text-[11px] font-bold">
        <span className="text-emerald-700 truncate flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse inline-block" />
          {progressText}
        </span>
        <span className="text-slate-600 font-extrabold">{progress}%</span>
      </div>
      <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden border border-slate-300/60 p-0.5 shadow-inner">
        <div 
          className={`bg-gradient-to-r ${color} h-full rounded-full transition-all duration-300 shadow`} 
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} 
        />
      </div>
      <div className="text-[10px] text-slate-400 truncate tracking-tight text-center">
        [{bar}]
      </div>
    </div>
  );
}
