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
    <div className="flex flex-wrap items-center gap-2 select-none overflow-x-auto pb-1">
      {pills.map((pill) => {
        const isActive = selectedStatus === pill.id;
        return (
          <button
            key={pill.id}
            type="button"
            onClick={() => onSelectStatus(pill.id)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all min-h-[38px] cursor-pointer ${
              isActive
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
            }`}
          >
            {pill.label}
          </button>
        );
      })}
    </div>
  );
}
