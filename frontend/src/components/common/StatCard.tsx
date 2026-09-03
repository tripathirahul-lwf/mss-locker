import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { cn } from '../../lib/utils';
import { Link } from 'react-router-dom';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  badge?: {
    text: string;
    variant?: 'neutral' | 'success' | 'warning' | 'destructive';
  };
  icon: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  className?: string;
  href?: string;
  ariaLabel?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  badge,
  icon: Icon,
  iconBg = 'bg-slate-100',
  iconColor = 'text-slate-700',
  className,
  href,
  ariaLabel,
}: StatCardProps) {
  const badgeStyles = {
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    destructive: 'bg-rose-50 text-rose-800 border-rose-200',
  };

  const card = (
    <Card className={cn('overflow-hidden rounded-2xl border border-slate-200/90 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md bg-white', className)}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0 space-y-1.5 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {title}
            </p>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-2xl sm:text-[1.65rem] font-semibold tracking-tight text-slate-900 font-sans tabular-nums leading-tight">
                {value}
              </span>
              {badge && (
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium border leading-none',
                    badgeStyles[badge.variant || 'neutral']
                  )}
                >
                  {badge.text}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs leading-relaxed text-slate-500 font-normal">
                {subtitle}
              </p>
            )}
          </div>
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/60 shadow-2xs',
              iconBg,
              iconColor
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return href ? (
    <Link
      to={href}
      aria-label={ariaLabel || `View ${title}`}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
    >
      {card}
    </Link>
  ) : card;
}
