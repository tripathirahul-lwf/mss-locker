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
      bg: 'bg-slate-100 text-slate-700 border-slate-200',
      icon: <FileEdit className="w-3.5 h-3.5 mr-1" />,
    },
    PENDING_APPROVAL: {
      label: 'Pending Approval',
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: <Clock className="w-3.5 h-3.5 mr-1" />,
    },
    APPROVED: {
      label: 'Approved (Ready to Pay)',
      bg: 'bg-sky-50 text-sky-700 border-sky-200',
      icon: <CheckCircle className="w-3.5 h-3.5 mr-1" />,
    },
    REJECTED: {
      label: 'Rejected',
      bg: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: <XCircle className="w-3.5 h-3.5 mr-1" />,
    },
    PAID: {
      label: 'Paid / Disbursed',
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: <DollarSign className="w-3.5 h-3.5 mr-1" />,
    },
    CANCELLED: {
      label: 'Cancelled',
      bg: 'bg-slate-100 text-slate-700 border-slate-200',
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
