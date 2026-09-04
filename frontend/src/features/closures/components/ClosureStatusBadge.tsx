import React from 'react';
import { ClosureStatus } from '../types';
import {
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ThumbsUp,
  XCircle,
  Ban,
} from 'lucide-react';

interface ClosureStatusBadgeProps {
  status: ClosureStatus;
  size?: 'sm' | 'md';
}

export const ClosureStatusBadge: React.FC<ClosureStatusBadgeProps> = ({
  status,
  size = 'md',
}) => {
  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';

  switch (status) {
    case 'DRAFT':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 ${sizeClasses}`}
        >
          <FileText className="w-3.5 h-3.5 text-slate-500" />
          Draft
        </span>
      );

    case 'PENDING_REVIEW':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 ${sizeClasses}`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          Pending Review
        </span>
      );

    case 'PENDING_SETTLEMENT':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 ${sizeClasses}`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          Pending Settlement
        </span>
      );

    case 'READY_FOR_CLOSURE':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 ${sizeClasses}`}
        >
          <ThumbsUp className="w-3.5 h-3.5 text-blue-600" />
          Ready for Closure
        </span>
      );

    case 'APPROVED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 ${sizeClasses}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
          Approved
        </span>
      );

    case 'COMPLETED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 ${sizeClasses}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Completed
        </span>
      );

    case 'REJECTED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-red-50 text-red-800 border border-red-200 ${sizeClasses}`}
        >
          <XCircle className="w-3.5 h-3.5 text-red-600" />
          Rejected
        </span>
      );

    case 'CANCELLED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200 ${sizeClasses}`}
        >
          <Ban className="w-3.5 h-3.5 text-gray-500" />
          Cancelled
        </span>
      );

    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 ${sizeClasses}`}
        >
          {status}
        </span>
      );
  }
};
