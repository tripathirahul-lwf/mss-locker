import React from 'react';
import { CustomerStats } from '../types';
import { Users, UserCheck, ShieldCheck, Clock, ShieldAlert } from 'lucide-react';

interface CustomerSummaryCardsProps {
  stats?: CustomerStats;
  selectedStatus?: string;
  selectedKycStatus?: string;
  onSelectFilter: (type: 'status' | 'kycStatus', value: string) => void;
}

export function CustomerSummaryCards({
  stats,
  selectedStatus,
  selectedKycStatus,
  onSelectFilter,
}: CustomerSummaryCardsProps) {
  const total = stats?.total ?? 0;
  const active = stats?.active ?? 0;
  const kycVerified = stats?.kycVerified ?? 0;
  const kycPending = (stats?.kycPending ?? 0) + (stats?.kycPartial ?? 0);
  const kycRejected = stats?.kycRejected ?? 0;
  const blocked = stats?.blocked ?? 0;
  const kycExpired = stats?.kycExpired ?? 0;
  const flaggedCount = blocked + kycRejected + kycExpired;

  const kycComplianceRate = total > 0 ? ((kycVerified / total) * 100).toFixed(1) : '0.0';

  const cards = [
    {
      id: 'ALL',
      title: 'Total Customers',
      value: total,
      subtext: `${kycComplianceRate}% Verified Compliance`,
      icon: Users,
      active: !selectedStatus && !selectedKycStatus,
      iconBg: 'bg-slate-50 text-slate-700 border-slate-200/80',
      activeBorder: 'border-emerald-800 ring-2 ring-emerald-800/15 shadow-xs',
      inactiveBorder: 'border-slate-200/90 hover:border-slate-300',
      onClick: () => onSelectFilter('status', 'ALL'),
    },
    {
      id: 'ACTIVE',
      title: 'Active Accounts',
      value: active,
      subtext: 'Operational Customer Records',
      icon: UserCheck,
      active: selectedStatus === 'ACTIVE',
      iconBg: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
      activeBorder: 'border-emerald-800 ring-2 ring-emerald-800/15 shadow-xs',
      inactiveBorder: 'border-slate-200/90 hover:border-slate-300',
      onClick: () => onSelectFilter('status', 'ACTIVE'),
    },
    {
      id: 'VERIFIED',
      title: 'KYC Verified',
      value: kycVerified,
      subtext: 'ID & Photo Proof Approved',
      icon: ShieldCheck,
      active: selectedKycStatus === 'VERIFIED',
      iconBg: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
      activeBorder: 'border-emerald-800 ring-2 ring-emerald-800/15 shadow-xs',
      inactiveBorder: 'border-slate-200/90 hover:border-slate-300',
      onClick: () => onSelectFilter('kycStatus', 'VERIFIED'),
    },
    {
      id: 'PENDING',
      title: 'Action Required',
      value: kycPending,
      subtext: kycPending > 0 ? 'Incomplete / Partial Review' : 'All Identity Proofs Clear',
      icon: Clock,
      active: selectedKycStatus === 'PENDING,PARTIAL' || selectedKycStatus === 'PENDING',
      iconBg: kycPending > 0 ? 'bg-amber-50 text-amber-800 border-amber-200/80' : 'bg-slate-50 text-slate-600 border-slate-200',
      activeBorder: 'border-amber-600 ring-2 ring-amber-600/20 shadow-xs',
      inactiveBorder: 'border-slate-200/90 hover:border-slate-300',
      onClick: () => onSelectFilter('kycStatus', 'PENDING,PARTIAL'),
    },
    {
      id: 'FLAGGED',
      title: 'Special Attention',
      value: flaggedCount,
      subtext:
        flaggedCount > 0
          ? `${blocked} Blocked • ${kycRejected} Rejected • ${kycExpired} Expired`
          : 'No Flagged or Blocked Accounts',
      icon: ShieldAlert,
      active: selectedStatus === 'BLOCKED' || selectedKycStatus === 'REJECTED' || selectedKycStatus === 'EXPIRED',
      iconBg: flaggedCount > 0 ? 'bg-rose-50 text-rose-800 border-rose-200/80' : 'bg-slate-50 text-slate-600 border-slate-200',
      activeBorder: 'border-rose-600 ring-2 ring-rose-600/20 shadow-xs',
      inactiveBorder: 'border-slate-200/90 hover:border-slate-300',
      onClick: () => {
        if (blocked > 0) {
          onSelectFilter('status', 'BLOCKED');
        } else if (kycRejected > 0) {
          onSelectFilter('kycStatus', 'REJECTED');
        } else if (kycExpired > 0) {
          onSelectFilter('kycStatus', 'EXPIRED');
        } else {
          onSelectFilter('status', 'BLOCKED');
        }
      },
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-3.5 select-none">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <button
            key={card.id + card.title}
            type="button"
            onClick={card.onClick}
            aria-pressed={card.active}
            aria-label={`${card.title}: ${card.value}. ${card.subtext}`}
            className={`p-4 rounded-2xl bg-white border text-left transition-all relative overflow-hidden flex flex-col justify-between shadow-2xs hover:shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 min-h-[118px] ${
              card.active ? card.activeBorder : card.inactiveBorder
            }`}
          >
            {card.active && (
              <span className="absolute top-3 right-3 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
              </span>
            )}
            <div className="flex items-center justify-between w-full mb-2">
              <div className={`p-1.5 rounded-xl border ${card.iconBg} shadow-2xs`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight leading-none tabular-nums font-mono">
                {card.value.toLocaleString('en-IN')}
              </div>
              <div className="text-xs font-semibold text-slate-700 mt-1.5 leading-snug">
                {card.title}
              </div>
              <div className="text-[11px] font-normal text-slate-400 mt-0.5 leading-tight truncate">
                {card.subtext}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
