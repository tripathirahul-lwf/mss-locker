import React, { useState, useEffect } from 'react';
import { Search, Plus, Clock, Download, RefreshCw, X, ChevronDown } from 'lucide-react';
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
      <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5 max-w-3xl">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search agreement code, customer, phone, or locker no..."
            className="w-full h-10 pl-9 pr-9 text-xs bg-white border border-slate-300 focus:border-emerald-700 rounded-xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 font-medium shadow-2xs transition-all font-sans"
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => {
                setLocalSearch('');
                onSearchChange('');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Size Filter Dropdown */}
        <div className="relative shrink-0">
          <select
            value={selectedSize}
            onChange={(e) => onSizeChange?.(e.target.value)}
            className="h-10 pl-3.5 pr-9 text-xs bg-white border border-slate-300 focus:border-emerald-700 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 shadow-2xs cursor-pointer appearance-none shrink-0 font-sans"
          >
            <option value="">All Sizes (A to G2)</option>
            {['A', 'B', 'B1', 'C', 'D', 'D1', 'E', 'F', 'F1', 'G', 'G1', 'G2'].map((s) => (
              <option key={s} value={s}>
                Size {s}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        </div>
      </div>

      {/* Action Buttons Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {canCreate && (
          <Button
            size="sm"
            onClick={onNewAllocation}
            className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium shadow-xs flex items-center gap-1.5 h-10 px-3.5 rounded-xl text-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Allocation</span>
          </Button>
        )}

        {canCreate && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReserveLocker}
            className="h-10 px-3.5 rounded-xl text-xs font-medium text-amber-900 bg-white hover:bg-amber-50/60 border-slate-300 flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Reserve Locker</span>
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onExportCSV}
          className="h-10 px-3.5 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 border-slate-300 flex items-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export CSV</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-10 w-10 p-0 rounded-xl border-slate-300 text-slate-600 hover:bg-slate-50 cursor-pointer shadow-2xs flex items-center justify-center"
          title="Refresh Agreements"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-800' : ''}`} />
        </Button>
      </div>
    </div>
  );
}
