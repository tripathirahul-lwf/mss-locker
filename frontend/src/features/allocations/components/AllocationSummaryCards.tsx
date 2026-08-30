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
      color: 'blue',
      activeRing: 'ring-2 ring-blue-600 bg-blue-50/70 border-blue-300',
      badgeBg: 'bg-blue-100 text-blue-800',
      textColor: 'text-blue-950',
    },
    {
      id: 'ACTIVE' as const,
      label: 'Active Tenancies',
      count: stats?.active ?? 0,
      icon: KeyRound,
      color: 'emerald',
      activeRing: 'ring-2 ring-emerald-600 bg-emerald-50/70 border-emerald-300',
      badgeBg: 'bg-emerald-100 text-emerald-800',
      textColor: 'text-emerald-950',
    },
    {
      id: 'RESERVED' as const,
      label: 'On Hold (Reserved)',
      count: stats?.reserved ?? 0,
      icon: Clock,
      color: 'amber',
      activeRing: 'ring-2 ring-amber-500 bg-amber-50/70 border-amber-300',
      badgeBg: 'bg-amber-100 text-amber-800',
      textColor: 'text-amber-950',
    },
    {
      id: 'CLOSED' as const,
      label: 'Normal Closed',
      count: stats?.closed ?? 0,
      icon: CheckCircle2,
      color: 'slate',
      activeRing: 'ring-2 ring-slate-600 bg-slate-100/80 border-slate-300',
      badgeBg: 'bg-slate-200 text-slate-800',
      textColor: 'text-slate-950',
    },
    {
      id: 'CANCELLED' as const,
      label: 'Cancelled Holds',
      count: stats?.cancelled ?? 0,
      icon: XCircle,
      color: 'rose',
      activeRing: 'ring-2 ring-rose-500 bg-rose-50/70 border-rose-300',
      badgeBg: 'bg-rose-100 text-rose-800',
      textColor: 'text-rose-950',
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
            className={`p-4 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-2xs text-left transition-all hover:border-blue-400 hover:shadow-sm flex flex-col justify-between cursor-pointer min-h-[102px] ${
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
            <div className="text-2xl sm:text-3xl font-black font-sans text-slate-900 mt-2 tracking-tight">
              {card.count.toLocaleString()}
            </div>
          </button>
        );
      })}
    </div>
  );
}
