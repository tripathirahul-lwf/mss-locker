import React from 'react';
import { AllocationStats, AllocationStatus } from '../types';
import { KeyRound, Clock, CheckCircle2, XCircle, Layers } from 'lucide-react';

interface AllocationSummaryCardsProps {
  stats?: AllocationStats;
  selectedStatus?: AllocationStatus | 'ALL';
  onSelectStatus: (status: AllocationStatus | 'ALL') => void;
}

export function AllocationSummaryCards({
  stats,
  selectedStatus = 'ALL',
  onSelectStatus,
}: AllocationSummaryCardsProps) {
  const cards = [
    {
      id: 'ALL' as const,
      label: 'Total Agreements',
      count: stats?.total ?? 0,
      icon: Layers,
      activeRing: 'ring-2 ring-emerald-800 bg-emerald-50/40 border-emerald-300',
      badgeBg: 'bg-emerald-50 text-emerald-800 border border-emerald-200/80',
    },
    {
      id: 'ACTIVE' as const,
      label: 'Active Tenancies',
      count: stats?.active ?? 0,
      icon: KeyRound,
      activeRing: 'ring-2 ring-emerald-800 bg-emerald-50/40 border-emerald-300',
      badgeBg: 'bg-emerald-100/70 text-emerald-800 border border-emerald-200',
    },
    {
      id: 'RESERVED' as const,
      label: 'On Hold (Reserved)',
      count: stats?.reserved ?? 0,
      icon: Clock,
      activeRing: 'ring-2 ring-amber-500 bg-amber-50/40 border-amber-300',
      badgeBg: 'bg-amber-50 text-amber-800 border border-amber-200',
    },
    {
      id: 'CLOSED' as const,
      label: 'Normal Closed',
      count: stats?.closed ?? 0,
      icon: CheckCircle2,
      activeRing: 'ring-2 ring-slate-600 bg-slate-50 border-slate-300',
      badgeBg: 'bg-slate-100 text-slate-700 border border-slate-200',
    },
    {
      id: 'CANCELLED' as const,
      label: 'Cancelled Holds',
      count: stats?.cancelled ?? 0,
      icon: XCircle,
      activeRing: 'ring-2 ring-rose-500 bg-rose-50/40 border-rose-300',
      badgeBg: 'bg-rose-50 text-rose-800 border border-rose-200',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 select-none">
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = (selectedStatus || 'ALL') === card.id;

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelectStatus(card.id)}
            className={`p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs text-left transition-all hover:border-emerald-300 hover:shadow-xs flex flex-col justify-between cursor-pointer min-h-[96px] ${
              isSelected ? card.activeRing : 'hover:bg-slate-50/70'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-medium text-slate-500 uppercase tracking-wider">
                {card.label}
              </span>
              <div className={`p-1.5 rounded-xl ${card.badgeBg} shrink-0`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-semibold font-sans text-slate-900 mt-2 tracking-tight tabular-nums">
              {card.count.toLocaleString('en-IN')}
            </div>
          </button>
        );
      })}
    </div>
  );
}
