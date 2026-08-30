import React from 'react';
import { LockerStatus, OperationalStatus } from '../types';
import { LOCKER_STATUS_CONFIG, OPERATIONAL_STATUS_CONFIG } from '../constants';

interface LockerStatusBadgeProps {
  status: LockerStatus;
  className?: string;
}

export function LockerStatusBadge({ status, className = '' }: LockerStatusBadgeProps) {
  const config = LOCKER_STATUS_CONFIG[status] || {
    label: status,
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      <span>{config.label}</span>
    </span>
  );
}

interface OperationalStatusBadgeProps {
  status: OperationalStatus;
  className?: string;
}

export function OperationalStatusBadge({
  status,
  className = '',
}: OperationalStatusBadgeProps) {
  const config = OPERATIONAL_STATUS_CONFIG[status] || {
    label: status,
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      <span>{config.label}</span>
    </span>
  );
}
