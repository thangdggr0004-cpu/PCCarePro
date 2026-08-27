import React from 'react';

interface ProgressBarProps {
  value: number;
  color?: 'emerald' | 'cyan' | 'blue' | 'purple' | 'rose' | 'amber' | 'sky';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showGlow?: boolean;
}

const colorMap = {
  emerald: 'bg-gradient-to-r from-emerald-500 to-teal-400',
  cyan: 'bg-gradient-to-r from-cyan-500 to-blue-400',
  blue: 'bg-gradient-to-r from-blue-500 to-indigo-400',
  purple: 'bg-gradient-to-r from-purple-500 to-indigo-400',
  rose: 'bg-gradient-to-r from-rose-500 to-red-400',
  amber: 'bg-gradient-to-r from-amber-500 to-orange-400',
  sky: 'bg-gradient-to-r from-sky-500 to-cyan-400',
};

const sizeMap = {
  xs: 'h-1',
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
};

export default function ProgressBar({
  value,
  color = 'emerald',
  size = 'md',
  className = '',
  showGlow = false,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, isNaN(value) ? 0 : value));
  return (
    <div className={`w-full bg-slate-800/80 ${sizeMap[size]} rounded-full overflow-hidden border border-slate-700/40 ${className}`}>
      <div
        className={`h-full ${colorMap[color]} rounded-full transition-all duration-700 ease-out ${
          showGlow ? 'shadow-sm' : ''
        }`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

