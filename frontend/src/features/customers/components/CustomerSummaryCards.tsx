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
      iconBg: 'bg-blue-50 text-blue-700',
      activeBorder: 'border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/40',
      inactiveBorder: 'bg-white border-slate-200 hover:border-blue-300',
      onClick: () => onSelectFilter('status', 'ALL'),
    },
    {
      id: 'ACTIVE',
      title: 'Active Accounts',
      value: active,
      subtext: 'Operational Customer Records',
      icon: UserCheck,
      active: selectedStatus === 'ACTIVE',
      iconBg: 'bg-emerald-50 text-emerald-700',
      activeBorder: 'border-emerald-600 ring-2 ring-emerald-600/20 bg-emerald-50/40',
      inactiveBorder: 'bg-white border-slate-200 hover:border-emerald-300',
      onClick: () => onSelectFilter('status', 'ACTIVE'),
    },
    {
      id: 'VERIFIED',
      title: 'KYC Verified',
      value: kycVerified,
      subtext: 'ID & Photo Proof Approved',
      icon: ShieldCheck,
      active: selectedKycStatus === 'VERIFIED',
      iconBg: 'bg-sky-50 text-sky-700',
      activeBorder: 'border-sky-600 ring-2 ring-sky-600/20 bg-sky-50/40',
      inactiveBorder: 'bg-white border-slate-200 hover:border-sky-300',
      onClick: () => onSelectFilter('kycStatus', 'VERIFIED'),
    },
    {
      id: 'PENDING',
      title: 'KYC Incomplete',
      value: kycPending,
      subtext: 'Pending Verification',
      icon: Clock,
      active: selectedKycStatus === 'PENDING,PARTIAL',
      iconBg: 'bg-amber-50 text-amber-700',
      activeBorder: 'border-amber-600 ring-2 ring-amber-600/20 bg-amber-50/40',
      inactiveBorder: 'bg-white border-slate-200 hover:border-amber-300',
      onClick: () => onSelectFilter('kycStatus', 'PENDING,PARTIAL'),
    },
    {
      id: 'EXPIRED',
      title: 'KYC Expired',
      value: kycExpired,
      subtext: 'Renewal Required',
      icon: CalendarX2,
      active: selectedKycStatus === 'EXPIRED',
      iconBg: 'bg-orange-50 text-orange-700',
      activeBorder: 'border-orange-600 ring-2 ring-orange-600/20 bg-orange-50/40',
      inactiveBorder: 'bg-white border-slate-200 hover:border-orange-300',
      onClick: () => onSelectFilter('kycStatus', 'EXPIRED'),
    },
    {
      id: 'REJECTED',
      title: 'KYC Rejected',
      value: kycRejected,
      subtext: 'Action / Re-upload Needed',
      icon: ShieldAlert,
      active: selectedKycStatus === 'REJECTED',
      iconBg: 'bg-rose-50 text-rose-700',
      activeBorder: 'border-rose-600 ring-2 ring-rose-600/20 bg-rose-50/40',
      inactiveBorder: 'bg-white border-slate-200 hover:border-rose-300',
      onClick: () => onSelectFilter('kycStatus', 'REJECTED'),
    },
    {
      id: 'BLOCKED',
      title: 'Blocked Records',
      value: blocked,
      subtext: 'Restricted Customer Access',
      icon: Ban,
      active: selectedStatus === 'BLOCKED',
      iconBg: 'bg-purple-50 text-purple-700',
      activeBorder: 'border-purple-600 ring-2 ring-purple-600/20 bg-purple-50/40',
      inactiveBorder: 'bg-white border-slate-200 hover:border-purple-300',
      onClick: () => onSelectFilter('status', 'BLOCKED'),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <button
            key={card.id + card.title}
            type="button"
            onClick={card.onClick}
            aria-pressed={card.active}
            aria-label={`${card.title}: ${card.value}. ${card.subtext}`}
            className={`min-h-28 p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between shadow-2xs hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
              card.active ? card.activeBorder : card.inactiveBorder
            }`}
          >
            <div className="flex items-center justify-between w-full mb-2.5">
              <span className="text-xs font-semibold text-slate-700 leading-tight">
                {card.title}
              </span>
              <div className={`p-1.5 rounded-lg ${card.iconBg}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>

            <div>
              <div className="text-2xl font-extrabold text-slate-900 tracking-tight leading-none">
                {card.value.toLocaleString()}
              </div>
              <div className="text-[11px] font-medium text-slate-500 mt-1.5 leading-snug">
                {card.subtext}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
