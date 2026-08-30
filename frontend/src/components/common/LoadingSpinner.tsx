import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface LoadingSpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export function LoadingSpinner({ className, size = 'md', label }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={cn('flex items-center justify-center gap-2 text-slate-500', className)}>
      <Loader2 className={cn('animate-spin', sizeClasses[size])} />
      {label && <span className="text-sm font-medium">{label}</span>}
    </div>
  );
}
