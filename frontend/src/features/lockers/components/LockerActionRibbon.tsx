import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  FileSpreadsheet,
  Download,
  Layers,
  RefreshCw,
  X,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';

interface LockerActionRibbonProps {
  searchQuery?: string;
  onSearchChange: (query: string) => void;
  onAddLocker: () => void;
  onImportCSV: () => void;
  onExportCSV: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  canCreate: boolean;
  canImport?: boolean;
  isExporting?: boolean;
  showSearch?: boolean;
  showPrimaryAction?: boolean;
}

export function LockerActionRibbon({
  searchQuery = '',
  onSearchChange,
  onAddLocker,
  onImportCSV,
  onExportCSV,
  onRefresh,
  isRefreshing,
  canCreate,
  canImport = canCreate,
  isExporting = false,
  showSearch = true,
  showPrimaryAction = true,
}: LockerActionRibbonProps) {
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
    <div className={`flex flex-col md:flex-row items-stretch md:items-center gap-3 ${showSearch ? 'justify-between' : 'justify-end'}`} aria-label="Registry actions">
      {/* Search Input */}
      {showSearch && <div className="relative flex-1 max-w-xl">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search locker no, code, rack, or section..."
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
      </div>}

      {/* Action Buttons Toolbar */}
      <div className="hidden flex-wrap items-center gap-2 sm:flex">
        {canCreate && showPrimaryAction && (
          <Button
            size="sm"
            onClick={onAddLocker}
            className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium shadow-sm flex items-center gap-1.5 h-10 px-4 rounded-xl text-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Locker</span>
          </Button>
        )}

        {canImport && (
          <Button
            variant="outline"
            size="sm"
            onClick={onImportCSV}
            className="h-10 px-3.5 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 border-slate-300 flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Import CSV/Excel</span>
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onExportCSV}
          disabled={isExporting}
          className="h-10 px-3.5 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 border-slate-300 flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-4 h-4 text-emerald-800" />
          <span>{isExporting ? 'Exporting…' : 'Export All'}</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-10 px-3 rounded-xl border-slate-300 cursor-pointer"
          title="Refresh Registry"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-700' : 'text-slate-600'}`} />
        </Button>
      </div>
      <details className="relative sm:hidden">
        <summary className="flex min-h-[42px] cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs font-medium text-slate-700">
          <MoreHorizontal className="h-4 w-4" /> More actions
        </summary>
        <div className="absolute right-0 top-full z-20 mt-2 grid min-w-[210px] gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          {canImport && (
            <button type="button" onClick={onImportCSV} className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-left text-xs font-medium text-slate-700 hover:bg-slate-50">
              <FileSpreadsheet className="h-4 w-4 text-emerald-700" /> Import CSV/Excel
            </button>
          )}
          <button type="button" onClick={onExportCSV} disabled={isExporting} className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Download className="h-4 w-4 text-emerald-800" /> {isExporting ? 'Preparing export…' : 'Export all matches'}
          </button>
          <button type="button" onClick={onRefresh} disabled={isRefreshing} className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-left text-xs font-medium text-slate-700 hover:bg-slate-50">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-emerald-700' : ''}`} /> Refresh registry
          </button>
        </div>
      </details>
    </div>
  );
}
