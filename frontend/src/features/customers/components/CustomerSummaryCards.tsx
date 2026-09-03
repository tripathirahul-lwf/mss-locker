import React from 'react';
import { CustomerStats } from '../types';
import { Users, UserCheck, ShieldCheck, Clock, ShieldAlert, Ban, CalendarX2 } from 'lucide-react';

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

  const kycComplianceRate = total > 0 ? ((kycVerified / total) * 100).toFixed(1) : '0.0';

  const cards = [
    {
      id: 'ALL',
      title: 'Total Customers',
      value: total,
      subtext: `${kycComplianceRate}% Verified Compliance`,
      icon: Users,
      active: !selectedStatus && !selectedKycStatus,
      iconBg: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
      activeBorder: 'border-emerald-700 ring-2 ring-emerald-700/20 shadow-xs',
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
      activeBorder: 'border-emerald-700 ring-2 ring-emerald-700/20 shadow-xs',
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
      activeBorder: 'border-emerald-700 ring-2 ring-emerald-700/20 shadow-xs',
      inactiveBorder: 'border-slate-200/90 hover:border-slate-300',
      onClick: () => onSelectFilter('kycStatus', 'VERIFIED'),
    },
    {
      id: 'PENDING',
      title: 'KYC Incomplete',
      value: kycPending,
      subtext: 'Pending Verification',
      icon: Clock,
      active: selectedKycStatus === 'PENDING,PARTIAL',
      iconBg: 'bg-amber-50 text-amber-800 border-amber-200/80',
      activeBorder: 'border-amber-600 ring-2 ring-amber-600/20 shadow-xs',
      inactiveBorder: 'border-slate-200/90 hover:border-slate-300',
      onClick: () => onSelectFilter('kycStatus', 'PENDING,PARTIAL'),
    },
    {
      id: 'EXPIRED',
      title: 'KYC Expired',
      value: kycExpired,
      subtext: 'Renewal Required',
      icon: CalendarX2,
      active: selectedKycStatus === 'EXPIRED',
      iconBg: 'bg-orange-50 text-orange-800 border-orange-200/80',
      activeBorder: 'border-orange-600 ring-2 ring-orange-600/20 shadow-xs',
      inactiveBorder: 'border-slate-200/90 hover:border-slate-300',
      onClick: () => onSelectFilter('kycStatus', 'EXPIRED'),
    },
    {
      id: 'REJECTED',
      title: 'KYC Rejected',
      value: kycRejected,
      subtext: 'Action / Re-upload Needed',
      icon: ShieldAlert,
      active: selectedKycStatus === 'REJECTED',
      iconBg: 'bg-rose-50 text-rose-800 border-rose-200/80',
      activeBorder: 'border-rose-600 ring-2 ring-rose-600/20 shadow-xs',
      inactiveBorder: 'border-slate-200/90 hover:border-slate-300',
      onClick: () => onSelectFilter('kycStatus', 'REJECTED'),
    },
    {
      id: 'BLOCKED',
      title: 'Blocked Records',
      value: blocked,
      subtext: 'Restricted Customer Access',
      icon: Ban,
      active: selectedStatus === 'BLOCKED',
      iconBg: 'bg-purple-50 text-purple-800 border-purple-200/80',
      activeBorder: 'border-purple-600 ring-2 ring-purple-600/20 shadow-xs',
      inactiveBorder: 'border-slate-200/90 hover:border-slate-300',
      onClick: () => onSelectFilter('status', 'BLOCKED'),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2.5 sm:gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <button
            key={card.id + card.title}
            type="button"
            onClick={card.onClick}
            aria-pressed={card.active}
            aria-label={`${card.title}: ${card.value}. ${card.subtext}`}
            className={`p-3.5 rounded-2xl bg-white border text-left transition-all relative overflow-hidden flex flex-col justify-between shadow-2xs hover:shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 ${
              card.active ? card.activeBorder : card.inactiveBorder
            }`}
          >
            {card.active && (
              <span className="absolute top-2.5 right-2.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
              </span>
            )}
            <div className="flex items-center justify-between w-full mb-2">
              <div className={`p-1.5 rounded-xl border ${card.iconBg} shadow-2xs`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>

            <div>
              <div className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight leading-none tabular-nums font-sans">
                {card.value.toLocaleString()}
              </div>
              <div className="text-[10.5px] uppercase tracking-wider font-medium text-slate-500 mt-1.5 leading-snug">
                {card.title}
              </div>
              <div className="text-[10px] font-normal text-slate-400 mt-0.5 leading-tight truncate">
                {card.subtext}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
