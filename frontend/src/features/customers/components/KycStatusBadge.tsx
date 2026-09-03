import React from 'react';
import { KycStatus } from '../types';
import { KYC_STATUS_CONFIG } from '../constants';

interface KycStatusBadgeProps {
  status: KycStatus;
  className?: string;
  showIcon?: boolean;
}

export function KycStatusBadge({
  status,
  className = '',
}: KycStatusBadgeProps) {
  const config = KYC_STATUS_CONFIG[status] || {
    label: status,
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-medium border shrink-0 whitespace-nowrap ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      <span>{config.label}</span>
    </span>
  );
}
