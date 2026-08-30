import React from 'react';
import { LockerStatus } from '../types';

interface LockerFilterPillsProps {
  selectedStatus?: string;
  selectedOpStatus?: string;
  onSelectStatus: (status?: string) => void;
  onSelectOpStatus: (opStatus?: string) => void;
}

export function LockerFilterPills({
  selectedStatus,
  selectedOpStatus,
  onSelectStatus,
  onSelectOpStatus,
}: LockerFilterPillsProps) {
  const isAll = !selectedStatus && !selectedOpStatus;

  const pills = [
    {
      id: 'ALL',
      label: 'All',
      isActive: isAll,
      onClick: () => {
        onSelectStatus(undefined);
        onSelectOpStatus(undefined);
      },
    },
    {
      id: 'VACANT',
      label: 'Vacant (Available)',
      isActive: selectedStatus === 'VACANT',
      onClick: () => {
        onSelectStatus('VACANT');
        onSelectOpStatus(undefined);
      },
    },
    {
      id: 'OCCUPIED',
      label: 'Occupied',
      isActive: selectedStatus === 'OCCUPIED',
      onClick: () => {
        onSelectStatus('OCCUPIED');
        onSelectOpStatus(undefined);
      },
    },
    {
      id: 'RESERVED',
      label: 'Renewal Due / Reserved',
      isActive: selectedStatus === 'RESERVED',
      onClick: () => {
        onSelectStatus('RESERVED');
        onSelectOpStatus(undefined);
      },
    },
    {
      id: 'BLOCKED',
      label: 'Blocked',
      isActive: selectedStatus === 'BLOCKED',
      onClick: () => {
        onSelectStatus('BLOCKED');
        onSelectOpStatus(undefined);
      },
    },
    {
      id: 'MAINTENANCE',
      label: 'Maintenance',
      isActive: selectedOpStatus === 'MAINTENANCE',
      onClick: () => {
        onSelectOpStatus('MAINTENANCE');
        onSelectStatus(undefined);
      },
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 select-none overflow-x-auto pb-1">
      {pills.map((pill) => (
        <button
          key={pill.id}
          type="button"
          onClick={pill.onClick}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all min-h-[38px] cursor-pointer ${
            pill.isActive
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
          }`}
        >
          {pill.label}
        </button>
      ))}
    </div>
  );
}
