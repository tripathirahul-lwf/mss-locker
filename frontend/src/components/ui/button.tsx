import React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none rounded-md';

    const variants = {
      default: 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm active:bg-slate-950',
      outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 active:bg-slate-200 shadow-sm',
      secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300',
      ghost: 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200',
      destructive: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm',
      link: 'text-slate-900 underline-offset-4 hover:underline p-0 h-auto',
    };

    // Touch-friendly sizes (min touch target 44px on mobile/tablet for standard buttons)
    const sizes = {
      default: 'min-h-[44px] h-11 px-4 py-2 text-sm',
      sm: 'min-h-[44px] h-11 px-3 text-xs sm:min-h-[40px] sm:h-10',
      lg: 'min-h-[48px] h-12 px-6 text-base',
      icon: 'min-h-[44px] min-w-[44px] h-11 w-11 p-0',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
