import React from 'react';
import { Search, Plus, RotateCw, Filter } from 'lucide-react';
import { ClosureStatus, ClosureType } from '../types';

interface ClosureActionRibbonProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  closureType: string;
  onClosureTypeChange: (value: string) => void;
  onRefresh: () => void;
  onNewClosure: () => void;
  canCreate: boolean;
}

export const ClosureActionRibbon: React.FC<ClosureActionRibbonProps> = ({
  search,
  onSearchChange,
  status,
  onStatusChange,
  closureType,
  onClosureTypeChange,
  onRefresh,
  onNewClosure,
  canCreate,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs mb-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
      {/* Left: Search & Filter inputs */}
      <div className="flex flex-1 flex-wrap items-center gap-2.5">
        {/* Search input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search closure #, customer, phone, locker #..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="px-2.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="PENDING_SETTLEMENT">Pending Settlement</option>
            <option value="READY_FOR_CLOSURE">Ready for Closure</option>
            <option value="APPROVED">Approved</option>
            <option value="COMPLETED">Completed</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {/* Closure Type filter */}
        <select
          value={closureType}
          onChange={(e) => onClosureTypeChange(e.target.value)}
          className="px-2.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700"
        >
          <option value="ALL">All Types</option>
          <option value="CUSTOMER_REQUEST">Customer Request</option>
          <option value="NORMAL">Normal</option>
          <option value="NON_RENEWAL">Non-Renewal</option>
          <option value="ADMINISTRATIVE">Administrative</option>
          <option value="LEGACY_IMPORT">Legacy Import</option>
        </select>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          title="Refresh closures"
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Right: + New Closure Button */}
      {canCreate && (
        <button
          onClick={onNewClosure}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New Closure
        </button>
      )}
    </div>
  );
};
