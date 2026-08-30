import React from 'react';
import { DepositTransactionType, DepositTransactionStatus, DepositStatus } from '../types';
import { ArrowDownLeft, ArrowUpRight, Plus, Minus, FileText, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface TypeBadgeProps {
  type: DepositTransactionType;
  size?: 'sm' | 'md';
}

export const DepositTypeBadge: React.FC<TypeBadgeProps> = ({ type, size = 'md' }) => {
  const configs: Record<DepositTransactionType, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
    DEPOSIT_RECEIVED: {
      label: 'Deposit Received',
      bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      text: 'text-emerald-400',
      icon: <ArrowDownLeft className="w-3.5 h-3.5 mr-1" />,
    },
    DEPOSIT_ADJUSTMENT_ADD: {
      label: 'Adjustment (+)',
      bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      text: 'text-cyan-400',
      icon: <Plus className="w-3.5 h-3.5 mr-1" />,
    },
    DEPOSIT_ADJUSTMENT_DEDUCT: {
      label: 'Damage Deduction (-)',
      bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      text: 'text-amber-400',
      icon: <Minus className="w-3.5 h-3.5 mr-1" />,
    },
    REFUND_ISSUED: {
      label: 'Refund Disbursed',
      bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      text: 'text-purple-400',
      icon: <ArrowUpRight className="w-3.5 h-3.5 mr-1" />,
    },
    REFUND_REVERSAL: {
      label: 'Refund Reversal',
      bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      text: 'text-blue-400',
      icon: <CheckCircle2 className="w-3.5 h-3.5 mr-1" />,
    },
    LEGACY_IMPORT: {
      label: 'Legacy Migration',
      bg: 'bg-gray-500/10 text-gray-300 border-gray-500/20',
      text: 'text-gray-300',
      icon: <FileText className="w-3.5 h-3.5 mr-1" />,
    },
  };

  const config = configs[type] || {
    label: type,
    bg: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    text: 'text-gray-400',
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

export const DepositTxStatusBadge: React.FC<{ status: DepositTransactionStatus }> = ({ status }) => {
  if (status === 'COMPLETED') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Completed
      </span>
    );
  }
  if (status === 'CANCELLED') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
        <XCircle className="w-3 h-3 mr-1" />
        Cancelled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
      <Clock className="w-3 h-3 mr-1" />
      {status}
    </span>
  );
};

export const DepositCoverageBadge: React.FC<{ status: DepositStatus }> = ({ status }) => {
  const configs: Record<DepositStatus, { label: string; bg: string }> = {
    FULLY_COLLECTED: {
      label: 'Fully Collected',
      bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
    PARTIAL: {
      label: 'Partially Collected',
      bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
    NOT_COLLECTED: {
      label: 'Not Collected',
      bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    },
    OVER_COLLECTED: {
      label: 'Over Collected (Override)',
      bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    },
  };

  const config = configs[status] || {
    label: status,
    bg: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bg}`}>
      {config.label}
    </span>
  );
};
