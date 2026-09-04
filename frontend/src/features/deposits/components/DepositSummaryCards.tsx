import React from 'react';
import { DepositStats } from '../types';
import { ShieldCheck, ArrowDownLeft, ArrowUpRight, AlertCircle, Clock } from 'lucide-react';

interface DepositSummaryCardsProps {
  stats: DepositStats | null;
  isLoading: boolean;
  selectedFilter?: string;
  onFilterClick?: (filter: string) => void;
}

export const DepositSummaryCards: React.FC<DepositSummaryCardsProps> = ({
  stats,
  isLoading,
  selectedFilter,
  onFilterClick,
}) => {
  const cards = [
    {
      id: 'totalHeld',
      label: 'Total Caution Money Held',
      amount: stats?.totalDepositsHeld ?? 0,
      subtext: 'Net active refundable balance',
      icon: ShieldCheck,
      color: 'emerald',
      bgColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      activeBorder: 'ring-2 ring-emerald-500/50',
    },
    {
      id: 'collectedMonth',
      label: 'Collected This Month',
      amount: stats?.collectedThisMonth ?? 0,
      subtext: `Today: ₹${(stats?.collectedToday ?? 0).toLocaleString('en-IN')}`,
      icon: ArrowDownLeft,
      color: 'cyan',
      bgColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      activeBorder: 'ring-2 ring-cyan-500/50',
    },
    {
      id: 'refundedMonth',
      label: 'Refunded This Month',
      amount: stats?.refundedThisMonth ?? 0,
      subtext: `Today: ₹${(stats?.refundedToday ?? 0).toLocaleString('en-IN')}`,
      icon: ArrowUpRight,
      color: 'purple',
      bgColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      activeBorder: 'ring-2 ring-purple-500/50',
    },
    {
      id: 'pendingRefunds',
      label: 'Pending Refund Requests',
      amount: stats?.pendingRefundAmount ?? 0,
      subtext: `${stats?.pendingRefundCount ?? 0} request(s) awaiting approval`,
      icon: Clock,
      color: 'amber',
      bgColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      activeBorder: 'ring-2 ring-amber-500/50',
      highlight: (stats?.pendingRefundCount ?? 0) > 0,
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-slate-100"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        const isSelected = selectedFilter === c.id;

        return (
          <button
            type="button"
            key={c.id}
            onClick={() => onFilterClick && onFilterClick(c.id)}
            disabled={!onFilterClick || c.id !== 'pendingRefunds'}
            className={`relative w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all enabled:cursor-pointer enabled:hover:border-emerald-300 enabled:hover:shadow-md disabled:cursor-default ${
              isSelected ? c.activeBorder : ''
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {c.label}
              </span>
              <div className={`p-2 rounded-xl border ${c.bgColor}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline space-x-1">
              <span className="text-2xl font-bold tracking-tight text-slate-950">
                ₹{c.amount.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="flex items-center text-xs text-slate-500">
                {c.highlight && <AlertCircle className="mr-1 h-3 w-3 text-amber-600" />}
                {c.subtext}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
