import React, { useState, useEffect } from 'react';
import { Search, Plus, Clock, Download, RefreshCw, X, Filter } from 'lucide-react';
import { Button } from '../../../components/ui/button';

interface AllocationActionRibbonProps {
  searchQuery?: string;
  onSearchChange: (query: string) => void;
  selectedSize?: string;
  onSizeChange?: (size: string) => void;
  selectedRack?: string;
  onRackChange?: (rack: string) => void;
  onNewAllocation: () => void;
  onReserveLocker: () => void;
  onExportCSV: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  canCreate: boolean;
}

export function AllocationActionRibbon({
  searchQuery = '',
  onSearchChange,
  selectedSize = '',
  onSizeChange,
  selectedRack = '',
  onRackChange,
  onNewAllocation,
  onReserveLocker,
  onExportCSV,
  onRefresh,
  isRefreshing,
  canCreate,
}: AllocationActionRibbonProps) {
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
      {/* Search & Quick Filters */}
      <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-3xl">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search agreement code, customer, phone, or locker no..."
            className="w-full h-11 pl-10 pr-10 text-xs sm:text-sm bg-white border border-slate-200 focus:border-blue-500 rounded-2xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium shadow-2xs transition-all"
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => {
                setLocalSearch('');
                onSearchChange('');
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Size Filter Dropdown */}
        <select
          value={selectedSize}
          onChange={(e) => onSizeChange?.(e.target.value)}
          className="h-11 px-3 text-xs bg-white border border-slate-200 focus:border-blue-500 rounded-2xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs cursor-pointer shrink-0"
        >
          <option value="">All Sizes (A to G2)</option>
          {['A', 'B', 'B1', 'C', 'D', 'D1', 'E', 'F', 'F1', 'G', 'G1', 'G2'].map((s) => (
            <option key={s} value={s}>
              Size {s}
            </option>
          ))}
        </select>
      </div>

      {/* Action Buttons Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {canCreate && (
          <Button
            size="sm"
            onClick={onNewAllocation}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5 h-11 px-4 rounded-2xl text-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Allocation</span>
          </Button>
        )}

        {canCreate && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReserveLocker}
            className="h-11 px-3.5 rounded-2xl text-xs font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 border-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Reserve Locker</span>
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onExportCSV}
          className="h-11 px-3.5 rounded-2xl text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 border-slate-200 flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-4 h-4 text-blue-600" />
          <span>Export CSV</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-11 px-3 rounded-2xl border-slate-200 cursor-pointer"
          title="Refresh Agreements"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
        </Button>
      </div>
    </div>
  );
}
