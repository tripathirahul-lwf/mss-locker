import React from 'react';
import { cn } from '../../lib/utils';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  subtitle?: string;
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ name, subtitle: _subtitle, className, ...props }, ref) => {
    const initials = name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    return (
      <div
        ref={ref}
        className={cn(
          'relative flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white tracking-wider',
          className
        )}
        {...props}
      >
        {initials}
      </div>
    );
  }
);
Avatar.displayName = 'Avatar';
