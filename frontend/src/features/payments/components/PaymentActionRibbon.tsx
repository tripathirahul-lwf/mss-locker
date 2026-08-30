import React, { useState, useEffect } from 'react';
import { Search, Plus, Download, RefreshCw, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { PaymentMethod, PaymentStatus } from '../types';

interface PaymentActionRibbonProps {
  searchQuery?: string;
  onSearchChange: (query: string) => void;
  selectedMethod?: PaymentMethod | 'ALL';
  onMethodChange: (method: PaymentMethod | 'ALL') => void;
  selectedStatus?: PaymentStatus | 'ALL';
  onStatusChange: (status: PaymentStatus | 'ALL') => void;
  onRecordPayment: () => void;
  onExportCSV: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  canCreate: boolean;
}

export function PaymentActionRibbon({
  searchQuery = '',
  onSearchChange,
  selectedMethod = 'ALL',
  onMethodChange,
  selectedStatus = 'ALL',
  onStatusChange,
  onRecordPayment,
  onExportCSV,
  onRefresh,
  isRefreshing,
  canCreate,
}: PaymentActionRibbonProps) {
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
    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 select-none">
      {/* Search & Quick Dropdowns */}
      <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-3xl">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search payment #, receipt #, customer, phone, or reference..."
            className="w-full h-11 pl-10 pr-10 text-xs sm:text-sm bg-white border border-slate-200 focus:border-blue-500 rounded-2xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium shadow-2xs transition-all"
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => {
                setLocalSearch('');
                onSearchChange('');
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Payment Method Dropdown */}
        <select
          value={selectedMethod}
          onChange={(e) => onMethodChange(e.target.value as any)}
          className="h-11 px-3 text-xs bg-white border border-slate-200 focus:border-blue-500 rounded-2xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs cursor-pointer shrink-0"
        >
          <option value="ALL">All Payment Methods</option>
          <option value="CASH">Cash Transactions</option>
          <option value="UPI">UPI / QR Collections</option>
          <option value="BANK_TRANSFER">Bank Transfers</option>
          <option value="CARD">Card Swipes</option>
          <option value="CHEQUE">Cheque Clearances</option>
        </select>

        {/* Payment Status Dropdown */}
        <select
          value={selectedStatus}
          onChange={(e) => onStatusChange(e.target.value as any)}
          className="h-11 px-3 text-xs bg-white border border-slate-200 focus:border-blue-500 rounded-2xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs cursor-pointer shrink-0"
        >
          <option value="ALL">All Statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {canCreate && (
          <Button
            size="sm"
            onClick={onRecordPayment}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 h-11 px-4 rounded-2xl text-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record Payment</span>
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onExportCSV}
          className="h-11 px-3.5 rounded-2xl text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 border-slate-200 flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-4 h-4 text-emerald-600" />
          <span>Export CSV</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-11 px-3 rounded-2xl border-slate-200 cursor-pointer"
          title="Refresh Payments"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
        </Button>
      </div>
    </div>
  );
}
