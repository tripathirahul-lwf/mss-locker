import React from 'react';
import { RenewalStats, DueStatus, PaymentStatus } from '../types';
import { Clock, AlertTriangle, CheckCircle2, Calendar, IndianRupee, Layers } from 'lucide-react';

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
      activeRing: 'ring-2 ring-amber-500 bg-amber-50/80 border-amber-300',
      badgeBg: 'bg-amber-100 text-amber-800',
      filter: { dueStatus: 'DUE_TODAY' as const, paymentStatus: 'ALL' as const },
    },
    {
      id: 'DUE_WEEK',
      label: 'Due This Week',
      count: stats?.dueThisWeek.count ?? 0,
      amount: stats?.dueThisWeek.amount ?? 0,
      icon: Calendar,
      activeRing: 'ring-2 ring-blue-600 bg-blue-50/80 border-blue-300',
      badgeBg: 'bg-blue-100 text-blue-800',
      filter: { dueStatus: 'ALL' as const, paymentStatus: 'UNPAID' as const },
    },
    {
      id: 'DUE_MONTH',
      label: 'Due This Month',
      count: stats?.dueThisMonth.count ?? 0,
      amount: stats?.dueThisMonth.amount ?? 0,
      icon: Calendar,
      activeRing: 'ring-2 ring-indigo-500 bg-indigo-50/80 border-indigo-300',
      badgeBg: 'bg-indigo-100 text-indigo-800',
      filter: { dueStatus: 'ALL' as const, paymentStatus: 'ALL' as const },
    },
    {
      id: 'OVERDUE',
      label: 'Overdue Renewals',
      count: stats?.overdue.count ?? 0,
      amount: stats?.overdue.amount ?? 0,
      icon: AlertTriangle,
      activeRing: 'ring-2 ring-rose-500 bg-rose-50/80 border-rose-300',
      badgeBg: 'bg-rose-100 text-rose-800',
      filter: { dueStatus: 'OVERDUE' as const, paymentStatus: 'ALL' as const },
    },
    {
      id: 'PAID_MONTH',
      label: 'Paid This Month',
      count: stats?.paidThisMonth.count ?? 0,
      amount: stats?.paidThisMonth.amount ?? 0,
      icon: CheckCircle2,
      activeRing: 'ring-2 ring-emerald-600 bg-emerald-50/80 border-emerald-300',
      badgeBg: 'bg-emerald-100 text-emerald-800',
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
            className={`p-4 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-2xs text-left transition-all hover:border-blue-400 hover:shadow-sm flex flex-col justify-between cursor-pointer min-h-[106px] ${
              isSelected ? card.activeRing : 'hover:bg-slate-50/60'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {card.label}
              </span>
              <div className={`p-2 rounded-xl ${card.badgeBg} shrink-0`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-2 flex items-baseline justify-between gap-1">
              <span className="text-2xl sm:text-3xl font-black font-sans text-slate-900 tracking-tight">
                {card.count.toLocaleString()}
              </span>
              <span className="text-xs font-mono font-bold text-slate-600">
                ₹{card.amount.toLocaleString('en-IN')}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
