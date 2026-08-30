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
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    destructive: 'bg-red-50 text-red-700 border-red-200',
  };

  const card = (
    <Card className={cn('overflow-hidden transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md', className)}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0 space-y-1.5">
            <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
              {title}
            </p>
            <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2">
              <span className="text-2xl sm:text-[1.65rem] lg:text-3xl font-bold tracking-tight text-slate-950 font-mono">
                {value}
              </span>
              {badge && (
                <span
                  className={cn(
                    'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] sm:text-xs font-semibold border',
                    badgeStyles[badge.variant || 'neutral']
                  )}
                >
                  {badge.text}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-[11px] sm:text-xs leading-relaxed text-slate-500 font-normal">
                {subtitle}
              </p>
            )}
          </div>
          <div
            className={cn(
              'flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/80',
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
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
    >
      {card}
    </Link>
  ) : card;
}
