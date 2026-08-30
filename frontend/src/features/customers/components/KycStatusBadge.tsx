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
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      <span>{config.label}</span>
    </span>
  );
}
