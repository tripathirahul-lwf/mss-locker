import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-slate-900 text-white border-transparent',
    secondary: 'bg-slate-100 text-slate-900 border-transparent',
    outline: 'text-slate-900 border-slate-300',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    destructive: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded px-2.5 py-0.5 text-xs font-medium border transition-colors',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
