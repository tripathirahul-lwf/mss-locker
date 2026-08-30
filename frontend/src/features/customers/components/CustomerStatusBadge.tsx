import React from 'react';
import { CustomerStatus } from '../types';
import { CUSTOMER_STATUS_CONFIG } from '../constants';

interface CustomerStatusBadgeProps {
  status: CustomerStatus;
  className?: string;
}

export function CustomerStatusBadge({
  status,
  className = '',
}: CustomerStatusBadgeProps) {
  const config = CUSTOMER_STATUS_CONFIG[status] || {
    label: status,
    bg: 'bg-slate-50',
    text: 'text-slate-600',
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
