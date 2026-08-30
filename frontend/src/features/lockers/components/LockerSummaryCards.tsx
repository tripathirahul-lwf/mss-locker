import React from 'react';
import { LockerStats } from '../types';
import { Layers, CheckCircle2, UserCheck, Clock, Ban, Wrench } from 'lucide-react';

interface LockerSummaryCardsProps {
  stats?: LockerStats;
  selectedStatus?: string;
  selectedOpStatus?: string;
  onSelectFilter: (type: 'status' | 'operationalStatus', value: string) => void;
}

export function LockerSummaryCards({
  stats,
  selectedStatus,
  selectedOpStatus,
  onSelectFilter,
}: LockerSummaryCardsProps) {
  const total = stats?.total ?? 0;
  const vacant = stats?.vacant ?? 0;
  const occupied = stats?.occupied ?? 0;
  const reserved = stats?.reserved ?? 0;
  const blocked = stats?.blocked ?? 0;
  const maintenance = stats?.maintenance ?? 0;

  const occupancyRate = total > 0 ? ((occupied / total) * 100).toFixed(1) : '0.0';

  const cards = [
    {
      id: 'ALL',
      title: 'Total Master Lockers',
      value: total,
      subtext: `${occupancyRate}% Vault Occupancy`,
      icon: Layers,
      active: !selectedStatus && !selectedOpStatus,
      iconBg: 'bg-blue-50 text-blue-700',
      activeBorder: 'border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/40',
      inactiveBorder: 'bg-white border-slate-200 hover:border-blue-300',
      onClick: () => onSelectFilter('status', 'ALL'),
    },
    {
      id: 'VACANT',
      title: 'Vacant Available',
      value: vacant,
      subtext: 'Ready for Allotment',
      icon: CheckCircle2,
      active: selectedStatus === 'VACANT',
      iconBg: 'bg-emerald-50 text-emerald-700',
      activeBorder: 'border-emerald-600 ring-2 ring-emerald-600/20 bg-emerald-50/40',
      inactiveBorder: 'bg-white border-slate-200 hover:border-emerald-300',
      onClick: () => onSelectFilter('status', 'VACANT'),
    },
    {
      id: 'OCCUPIED',
      title: 'Occupied Lockers',
      value: occupied,
      subtext: 'Active Customer Tenancy',
      icon: UserCheck,
      active: selectedStatus === 'OCCUPIED',
      iconBg: 'bg-sky-50 text-sky-700',
      activeBorder: 'border-sky-600 ring-2 ring-sky-600/20 bg-sky-50/40',
      inactiveBorder: 'bg-white border-slate-200 hover:border-sky-300',
      onClick: () => onSelectFilter('status', 'OCCUPIED'),
    },
    {
      id: 'RESERVED',
      title: 'Reserved Units',
      value: reserved,
      subtext: 'Application Hold',
      icon: Clock,
      active: selectedStatus === 'RESERVED',
      iconBg: 'bg-amber-50 text-amber-700',
      activeBorder: 'border-amber-600 ring-2 ring-amber-600/20 bg-amber-50/40',
      inactiveBorder: 'bg-white border-slate-200 hover:border-amber-300',
      onClick: () => onSelectFilter('status', 'RESERVED'),
    },
    {
      id: 'BLOCKED',
      title: 'Blocked / Restricted',
      value: blocked,
      subtext: 'Operational Lock',
      icon: Ban,
      active: selectedStatus === 'BLOCKED',
      iconBg: 'bg-rose-50 text-rose-700',
      activeBorder: 'border-rose-600 ring-2 ring-rose-600/20 bg-rose-50/40',
      inactiveBorder: 'bg-white border-slate-200 hover:border-rose-300',
      onClick: () => onSelectFilter('status', 'BLOCKED'),
    },
    {
      id: 'MAINTENANCE',
      title: 'Maintenance',
      value: maintenance,
      subtext: 'Under Inspection',
      icon: Wrench,
      active: selectedOpStatus === 'MAINTENANCE',
      iconBg: 'bg-orange-50 text-orange-700',
      activeBorder: 'border-orange-600 ring-2 ring-orange-600/20 bg-orange-50/40',
      inactiveBorder: 'bg-white border-slate-200 hover:border-orange-300',
      onClick: () => onSelectFilter('operationalStatus', 'MAINTENANCE'),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 select-none">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <button
            key={card.id + card.title}
            type="button"
            onClick={card.onClick}
            className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between shadow-2xs hover:shadow-sm ${
              card.active ? card.activeBorder : card.inactiveBorder
            }`}
          >
            <div className="flex items-center justify-between w-full mb-2.5">
              <span className="text-xs font-semibold text-slate-700 truncate">
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
              <div className="text-[11px] font-medium text-slate-500 mt-1.5 truncate">
                {card.subtext}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
