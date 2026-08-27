import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'emerald' | 'cyan' | 'purple' | 'amber' | 'rose' | 'slate' | 'blue';
  size?: 'sm' | 'md';
  className?: string;
}

const variantMap = {
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  rose: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  slate: 'bg-slate-800 text-slate-300 border-slate-700',
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
};

const sizeMap = {
  sm: 'text-[10px] px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
};

export default function Badge({
  children,
  variant = 'emerald',
  size = 'sm',
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-full border ${variantMap[variant]} ${sizeMap[size]} ${className}`}
    >
      {children}
    </span>
  );
}
