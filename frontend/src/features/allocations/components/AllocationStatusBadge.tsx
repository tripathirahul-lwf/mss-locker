import React from 'react';
import { AllocationStatus } from '../types';
import { ALLOCATION_STATUS_CONFIG } from '../constants';

interface AllocationStatusBadgeProps {
  status: AllocationStatus;
}

export function AllocationStatusBadge({ status }: AllocationStatusBadgeProps) {
  const config = ALLOCATION_STATUS_CONFIG[status] || ALLOCATION_STATUS_CONFIG.ACTIVE;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${config.bg} select-none`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      <span>{config.label}</span>
    </span>
  );
}
