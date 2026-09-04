import React from 'react';
import { ClosureStats } from '../types';
import {
  Clock,
  AlertTriangle,
  ThumbsUp,
  CheckCircle2,
} from 'lucide-react';

interface ClosureSummaryCardsProps {
  stats: ClosureStats | null;
  loading: boolean;
  selectedStatus?: string;
  onSelectStatus?: (status: string) => void;
}

export const ClosureSummaryCards: React.FC<ClosureSummaryCardsProps> = ({
  stats,
  loading,
  selectedStatus,
  onSelectStatus,
}) => {
  const cards = [
    {
      id: 'PENDING_REVIEW',
      label: 'Pending Review',
      count: stats?.pendingReview ?? 0,
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      activeBorder: 'ring-2 ring-amber-500 border-amber-500',
    },
    {
      id: 'PENDING_SETTLEMENT',
      label: 'Pending Settlement',
      count: stats?.pendingSettlement ?? 0,
      icon: AlertTriangle,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-200',
      activeBorder: 'ring-2 ring-rose-500 border-rose-500',
    },
    {
      id: 'READY_FOR_CLOSURE',
      label: 'Ready for Closure',
      count: stats?.readyForClosure ?? 0,
      icon: ThumbsUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      activeBorder: 'ring-2 ring-blue-500 border-blue-500',
    },
    {
      id: 'APPROVED',
      label: 'Approved to Release',
      count: stats?.approved ?? 0,
      icon: ThumbsUp,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
      activeBorder: 'ring-2 ring-indigo-500 border-indigo-500',
    },
    {
      id: 'COMPLETED', label: 'Completed This Month', count: stats?.completedThisMonth ?? 0,
      icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200', activeBorder: 'ring-2 ring-emerald-500 border-emerald-500',
    },
  ];

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = selectedStatus === card.id;

        return (
          <button
            type="button"
            key={card.id}
            onClick={() => onSelectStatus?.(isSelected ? 'ALL' : card.id)}
            aria-pressed={isSelected}
            aria-label={`${card.label}: ${card.count}. ${isSelected ? 'Clear' : 'Apply'} this status filter.`}
            className={`flex flex-col text-left p-3.5 rounded-xl border bg-white shadow-xs transition-all hover:shadow-sm cursor-pointer ${
              card.borderColor
            } ${isSelected ? card.activeBorder : ''}`}
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-xs font-semibold text-slate-600 truncate">
                {card.label}
              </span>
              <div className={`p-1.5 rounded-lg ${card.bgColor}`}>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              {loading ? (
                <div className="h-6 w-12 bg-slate-100 animate-pulse rounded-md" />
              ) : (
                <span className="text-xl font-bold text-slate-900 tracking-tight">
                  {card.count}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
