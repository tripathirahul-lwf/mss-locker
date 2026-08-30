import React from 'react';
import { RefundStatus } from '../types';
import { Clock, CheckCircle, XCircle, DollarSign, FileEdit, Ban } from 'lucide-react';

interface RefundStatusBadgeProps {
  status: RefundStatus;
  size?: 'sm' | 'md';
}

export const RefundStatusBadge: React.FC<RefundStatusBadgeProps> = ({ status, size = 'md' }) => {
  const configs: Record<RefundStatus, { label: string; bg: string; icon: React.ReactNode }> = {
    DRAFT: {
      label: 'Draft',
      bg: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      icon: <FileEdit className="w-3.5 h-3.5 mr-1" />,
    },
    PENDING_APPROVAL: {
      label: 'Pending Approval',
      bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse',
      icon: <Clock className="w-3.5 h-3.5 mr-1" />,
    },
    APPROVED: {
      label: 'Approved (Ready to Pay)',
      bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      icon: <CheckCircle className="w-3.5 h-3.5 mr-1" />,
    },
    REJECTED: {
      label: 'Rejected',
      bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      icon: <XCircle className="w-3.5 h-3.5 mr-1" />,
    },
    PAID: {
      label: 'Paid / Disbursed',
      bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      icon: <DollarSign className="w-3.5 h-3.5 mr-1" />,
    },
    CANCELLED: {
      label: 'Cancelled',
      bg: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      icon: <Ban className="w-3.5 h-3.5 mr-1" />,
    },
  };

  const config = configs[status] || {
    label: status,
    bg: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    icon: null,
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      } ${config.bg}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
};
