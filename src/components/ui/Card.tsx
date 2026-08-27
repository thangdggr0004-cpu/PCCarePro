import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: 'emerald' | 'cyan' | 'amber' | 'none';
  onClick?: () => void;
}

export default function Card({
  children,
  className = '',
  hover = false,
  glow = 'none',
  onClick,
}: CardProps) {
  const base = 'bg-[#131d33] p-5 rounded-xl border border-slate-800/80 shadow-sm relative overflow-hidden';
  
  const glowClass =
    glow === 'emerald' ? 'glow-emerald border-emerald-500/20' :
    glow === 'cyan' ? 'glow-cyan border-cyan-500/20' :
    glow === 'amber' ? 'glow-amber border-amber-500/20' : '';

  const interactive = hover
    ? 'hover:bg-[#16223b] hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-200 cursor-pointer group hover:-translate-y-0.5'
    : '';

  return (
    <div className={`${base} ${glowClass} ${interactive} ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}

