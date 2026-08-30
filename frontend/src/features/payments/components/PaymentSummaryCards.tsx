import React from 'react';
import { PaymentStats, PaymentMethod } from '../types';
import { IndianRupee, Calendar, Banknote, QrCode, Layers } from 'lucide-react';

interface PaymentSummaryCardsProps {
  stats?: PaymentStats;
  selectedMethod?: PaymentMethod | 'ALL';
  onSelectMethod: (method: PaymentMethod | 'ALL') => void;
}

export function PaymentSummaryCards({
  stats,
  selectedMethod = 'ALL',
  onSelectMethod,
}: PaymentSummaryCardsProps) {
  const cards = [
    {
      id: 'TODAY',
      label: "Today's Collection",
      amount: stats?.todayCollection.amount ?? 0,
      count: stats?.todayCollection.count ?? 0,
      icon: IndianRupee,
      badgeBg: 'bg-emerald-100 text-emerald-800',
      activeRing: 'ring-2 ring-emerald-500 bg-emerald-50/80 border-emerald-300',
      filter: 'ALL' as const,
    },
    {
      id: 'MONTH',
      label: 'This Month Collection',
      amount: stats?.monthCollection.amount ?? 0,
      count: stats?.monthCollection.count ?? 0,
      icon: Calendar,
      badgeBg: 'bg-blue-100 text-blue-800',
      activeRing: 'ring-2 ring-blue-500 bg-blue-50/80 border-blue-300',
      filter: 'ALL' as const,
    },
    {
      id: 'CASH',
      label: 'Cash Collection (Today)',
      amount: stats?.cashToday.amount ?? 0,
      count: stats?.cashToday.count ?? 0,
      icon: Banknote,
      badgeBg: 'bg-amber-100 text-amber-800',
      activeRing: 'ring-2 ring-amber-500 bg-amber-50/80 border-amber-300',
      filter: 'CASH' as const,
    },
    {
      id: 'DIGITAL',
      label: 'Digital (UPI / Card / Bank)',
      amount: stats?.digitalToday.amount ?? 0,
      count: stats?.digitalToday.count ?? 0,
      icon: QrCode,
      badgeBg: 'bg-indigo-100 text-indigo-800',
      activeRing: 'ring-2 ring-indigo-500 bg-indigo-50/80 border-indigo-300',
      filter: 'UPI' as const,
    },
    {
      id: 'TOTAL',
      label: 'Total Receipts Settled',
      amount: stats?.totalTransactions ?? 0,
      count: stats?.totalTransactions ?? 0,
      isCountMain: true,
      icon: Layers,
      badgeBg: 'bg-slate-100 text-slate-800',
      activeRing: 'ring-2 ring-slate-500 bg-slate-50 border-slate-300',
      filter: 'ALL' as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 select-none">
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected =
          (card.id === 'CASH' && selectedMethod === 'CASH') ||
          (card.id === 'DIGITAL' && selectedMethod === 'UPI');

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelectMethod(card.filter)}
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
              <span className="text-xl sm:text-2xl font-black font-sans text-slate-900 tracking-tight">
                {card.isCountMain
                  ? card.count.toLocaleString()
                  : `₹${card.amount.toLocaleString('en-IN')}`}
              </span>
              {!card.isCountMain && (
                <span className="text-xs font-mono font-bold text-slate-500">
                  {card.count} txns
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
