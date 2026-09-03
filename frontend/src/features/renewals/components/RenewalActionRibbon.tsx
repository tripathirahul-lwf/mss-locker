import React, { useState, useEffect } from 'react';
import { Search, Plus, Download, RefreshCw, X, ChevronDown } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { PaymentStatus, DueStatus } from '../types';

interface RenewalActionRibbonProps {
  searchQuery?: string;
  onSearchChange: (query: string) => void;
  selectedPaymentStatus?: PaymentStatus | 'ALL';
  onPaymentStatusChange: (status: PaymentStatus | 'ALL') => void;
  selectedDueStatus?: DueStatus | 'ALL';
  onDueStatusChange: (due: DueStatus | 'ALL') => void;
  onGenerateRenewal: () => void;
  onExportCSV: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  canCreate: boolean;
}

export function RenewalActionRibbon({
  searchQuery = '',
  onSearchChange,
  selectedPaymentStatus = 'ALL',
  onPaymentStatusChange,
  selectedDueStatus = 'ALL',
  onDueStatusChange,
  onGenerateRenewal,
  onExportCSV,
  onRefresh,
  isRefreshing,
  canCreate,
}: RenewalActionRibbonProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchQuery) {
        onSearchChange(localSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, searchQuery, onSearchChange]);

  return (
    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 select-none">
      {/* Search & Quick Dropdowns */}
      <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-3xl">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search invoice number, customer, phone, or locker..."
            className="w-full h-10 pl-10 pr-9 text-xs bg-slate-50/80 border border-slate-300 focus:border-emerald-700 rounded-xl placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 font-normal shadow-2xs transition-all font-sans"
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => {
                setLocalSearch('');
                onSearchChange('');
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Payment Status Dropdown */}
        <div className="relative shrink-0">
          <select
            value={selectedPaymentStatus}
            onChange={(e) => onPaymentStatusChange(e.target.value as any)}
            className="w-full sm:w-auto h-10 pl-3 pr-8 text-xs bg-slate-50/80 border border-slate-300 focus:border-emerald-700 rounded-xl font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 shadow-2xs cursor-pointer appearance-none font-sans"
          >
            <option value="ALL">All Payment States</option>
            <option value="UNPAID">Unpaid Invoices</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid in Full</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Due Urgency Dropdown */}
        <div className="relative shrink-0">
          <select
            value={selectedDueStatus}
            onChange={(e) => onDueStatusChange(e.target.value as any)}
            className="w-full sm:w-auto h-10 pl-3 pr-8 text-xs bg-slate-50/80 border border-slate-300 focus:border-emerald-700 rounded-xl font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 shadow-2xs cursor-pointer appearance-none font-sans"
          >
            <option value="ALL">All Due Schedules</option>
            <option value="DUE_TODAY">Due Today</option>
            <option value="OVERDUE">Overdue Notice</option>
            <option value="UPCOMING">Upcoming Cycles</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {canCreate && (
          <Button
            size="sm"
            onClick={onGenerateRenewal}
            className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium shadow-xs flex items-center gap-1.5 h-10 px-4 rounded-xl text-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Renewal</span>
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onExportCSV}
          className="h-10 px-3.5 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 border-slate-300 flex items-center gap-1.5 cursor-pointer bg-white"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export CSV</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-10 px-2.5 rounded-xl border-slate-300 cursor-pointer bg-white hover:bg-slate-50 text-slate-700"
          title="Refresh Renewals"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-800' : ''}`} />
        </Button>
      </div>
    </div>
  );
}
