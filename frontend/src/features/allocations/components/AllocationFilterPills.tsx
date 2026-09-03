import React from 'react';
import { AllocationStatus } from '../types';

interface AllocationFilterPillsProps {
  selectedStatus?: AllocationStatus | 'ALL';
  onSelectStatus: (status: AllocationStatus | 'ALL') => void;
}

export function AllocationFilterPills({
  selectedStatus = 'ALL',
  onSelectStatus,
}: AllocationFilterPillsProps) {
  const pills: { id: AllocationStatus | 'ALL'; label: string }[] = [
    { id: 'ALL', label: 'All Agreements' },
    { id: 'ACTIVE', label: 'Active Tenancies' },
    { id: 'RESERVED', label: 'On Hold (Reserved)' },
    { id: 'CLOSED', label: 'Closed' },
    { id: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5 select-none overflow-x-auto pb-1">
      {pills.map((pill) => {
        const isActive = selectedStatus === pill.id;
        return (
          <button
            key={pill.id}
            type="button"
            onClick={() => onSelectStatus(pill.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs transition-all h-8 cursor-pointer ${
              isActive
                ? 'bg-emerald-800 text-white font-medium shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200/90 hover:bg-slate-50 hover:text-slate-900 font-normal'
            }`}
          >
            {pill.label}
          </button>
        );
      })}
    </div>
  );
}
