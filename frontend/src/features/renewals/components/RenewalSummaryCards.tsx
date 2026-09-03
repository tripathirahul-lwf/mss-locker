import React from 'react';
import { RenewalStats, DueStatus, PaymentStatus } from '../types';
import { Clock, AlertTriangle, CheckCircle2, Calendar, IndianRupee } from 'lucide-react';

interface RenewalSummaryCardsProps {
  stats?: RenewalStats;
  selectedDueStatus?: DueStatus | 'ALL';
  selectedPaymentStatus?: PaymentStatus | 'ALL';
  onSelectFilter: (filter: { dueStatus?: DueStatus | 'ALL'; paymentStatus?: PaymentStatus | 'ALL' }) => void;
}

export function RenewalSummaryCards({
  stats,
  selectedDueStatus = 'ALL',
  selectedPaymentStatus = 'ALL',
  onSelectFilter,
}: RenewalSummaryCardsProps) {
  const cards = [
    {
      id: 'DUE_TODAY',
      label: 'Due Today',
      count: stats?.dueToday.count ?? 0,
      amount: stats?.dueToday.amount ?? 0,
      icon: Clock,
      activeRing: 'ring-2 ring-amber-600/30 border-amber-600 bg-amber-50/50 shadow-xs',
      badgeBg: 'bg-amber-50 text-amber-800 border border-amber-200/80',
      filter: { dueStatus: 'DUE_TODAY' as const, paymentStatus: 'ALL' as const },
    },
    {
      id: 'DUE_WEEK',
      label: 'Due This Week',
      count: stats?.dueThisWeek.count ?? 0,
      amount: stats?.dueThisWeek.amount ?? 0,
      icon: Calendar,
      activeRing: 'ring-2 ring-emerald-800/30 border-emerald-800 bg-emerald-50/50 shadow-xs',
      badgeBg: 'bg-emerald-50 text-emerald-800 border border-emerald-200/80',
      filter: { dueStatus: 'ALL' as const, paymentStatus: 'UNPAID' as const },
    },
    {
      id: 'DUE_MONTH',
      label: 'Due This Month',
      count: stats?.dueThisMonth.count ?? 0,
      amount: stats?.dueThisMonth.amount ?? 0,
      icon: Calendar,
      activeRing: 'ring-2 ring-emerald-800/30 border-emerald-800 bg-emerald-50/50 shadow-xs',
      badgeBg: 'bg-emerald-50 text-emerald-800 border border-emerald-200/80',
      filter: { dueStatus: 'ALL' as const, paymentStatus: 'ALL' as const },
    },
    {
      id: 'OVERDUE',
      label: 'Overdue Renewals',
      count: stats?.overdue.count ?? 0,
      amount: stats?.overdue.amount ?? 0,
      icon: AlertTriangle,
      activeRing: 'ring-2 ring-rose-600/30 border-rose-600 bg-rose-50/50 shadow-xs',
      badgeBg: 'bg-rose-50 text-rose-800 border border-rose-200/80',
      filter: { dueStatus: 'OVERDUE' as const, paymentStatus: 'ALL' as const },
    },
    {
      id: 'PAID_MONTH',
      label: 'Paid This Month',
      count: stats?.paidThisMonth.count ?? 0,
      amount: stats?.paidThisMonth.amount ?? 0,
      icon: CheckCircle2,
      activeRing: 'ring-2 ring-emerald-800/30 border-emerald-800 bg-emerald-50/50 shadow-xs',
      badgeBg: 'bg-emerald-50 text-emerald-800 border border-emerald-200/80',
      filter: { dueStatus: 'ALL' as const, paymentStatus: 'PAID' as const },
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 select-none">
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected =
          (card.id === 'DUE_TODAY' && selectedDueStatus === 'DUE_TODAY') ||
          (card.id === 'OVERDUE' && selectedDueStatus === 'OVERDUE') ||
          (card.id === 'PAID_MONTH' && selectedPaymentStatus === 'PAID');

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelectFilter(card.filter)}
            className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all text-left flex flex-col justify-between cursor-pointer min-h-[96px] ${
              isSelected
                ? card.activeRing
                : 'bg-white border-slate-200/90 hover:border-emerald-400 hover:bg-slate-50/60 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-sans">
                {card.label}
              </span>
              <div className={`p-1.5 rounded-xl ${card.badgeBg} shrink-0 shadow-2xs`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="mt-2 flex items-baseline justify-between gap-1">
              <span className="text-2xl sm:text-3xl font-bold font-sans text-slate-900 tracking-tight tabular-nums">
                {card.count.toLocaleString()}
              </span>
              <span className="text-xs font-semibold font-sans text-slate-600 tabular-nums">
                ₹{card.amount.toLocaleString('en-IN')}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
