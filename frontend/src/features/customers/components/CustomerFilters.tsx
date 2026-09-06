import React, { useState, useEffect } from 'react';
import { Search, Filter, X, RotateCcw, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { CustomerQueryParams } from '../types';

interface CustomerFiltersProps {
  filters: CustomerQueryParams;
  onFilterChange: (filters: Partial<CustomerQueryParams>) => void;
  onClearFilters: () => void;
}

export function CustomerFilters({
  filters,
  onFilterChange,
  onClearFilters,
}: CustomerFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  useEffect(() => {
    setSearchInput(filters.search || '');
  }, [filters.search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== (filters.search || '')) {
        onFilterChange({ search: searchInput || undefined, page: 1 });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, filters.search, onFilterChange]);

  const hasActiveFilters = Boolean(
    filters.search ||
      (filters.status && filters.status !== 'ALL') ||
      (filters.kycStatus && filters.kycStatus !== 'ALL') ||
      filters.city ||
      filters.state ||
      filters.isActive === false
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3 sm:p-3.5 space-y-2.5">
      {/* Top Search & Fast Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            aria-label="Search customers"
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by customer name, code (CUS-...), mobile number, or email..."
            className="pl-10 pr-9 h-9.5 text-xs bg-slate-50/50 border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                onFilterChange({ search: undefined, page: 1 });
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
              aria-label="Clear customer search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Desktop / Large Screen Quick Filters */}
        <div className="hidden md:flex items-center gap-2">
          {/* Customer Status */}
          <div className="relative">
            <select
              aria-label="Filter by account status"
              value={filters.status || 'ALL'}
              onChange={(e) =>
                onFilterChange({
                  status: e.target.value === 'ALL' ? undefined : e.target.value,
                  page: 1,
                })
              }
              className="h-9.5 pl-3 pr-7.5 text-xs bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 font-medium appearance-none cursor-pointer"
            >
              <option value="ALL">All Account Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="BLOCKED">Blocked</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          </div>

          {/* KYC Status */}
          <div className="relative">
            <select
              aria-label="Filter by KYC status"
              value={filters.kycStatus || 'ALL'}
              onChange={(e) =>
                onFilterChange({
                  kycStatus: e.target.value === 'ALL' ? undefined : e.target.value,
                  page: 1,
                })
              }
              className="h-9.5 pl-3 pr-7.5 text-xs bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 font-medium appearance-none cursor-pointer"
            >
              <option value="ALL">All KYC Status</option>
              <option value="VERIFIED">KYC Verified</option>
              <option value="PENDING,PARTIAL">Incomplete / Partial</option>
              <option value="PENDING">Pending Documents</option>
              <option value="REJECTED">Rejected</option>
              <option value="EXPIRED">Expired</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="h-9.5 px-3 text-xs flex items-center gap-1.5 text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50 rounded-xl font-medium cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset</span>
            </Button>
          )}
        </div>

        {/* Mobile / Tablet Filter Button */}
        <div className="flex md:hidden items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMobileDrawerOpen(true)}
            className="h-9.5 flex-1 flex items-center justify-center gap-2 text-xs font-medium border-slate-200 rounded-xl"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-800" />
            <span>Filters {hasActiveFilters && '(Active)'}</span>
          </Button>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="h-9.5 px-2.5 text-xs border-slate-200 rounded-xl"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            </Button>
          )}
        </div>
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100 text-xs">
          <span className="text-[11px] font-medium text-slate-400 mr-1">Active Filters:</span>
          {filters.search && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200">
              <span>Search: "{filters.search}"</span>
              <button
                type="button"
                onClick={() => onFilterChange({ search: undefined, page: 1 })}
                className="hover:text-slate-950 p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.status && filters.status !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200">
              <span>Status: {filters.status}</span>
              <button
                type="button"
                onClick={() => onFilterChange({ status: undefined, page: 1 })}
                className="hover:text-slate-950 p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.kycStatus && filters.kycStatus !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200">
              <span>KYC: {filters.kycStatus}</span>
              <button
                type="button"
                onClick={() => onFilterChange({ kycStatus: undefined, page: 1 })}
                className="hover:text-slate-950 p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={onClearFilters}
            className="text-[11px] font-medium text-emerald-800 hover:text-emerald-950 underline ml-1 cursor-pointer"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Mobile / Tablet Filter Drawer Modal */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-[2px] select-none">
          <div role="dialog" aria-modal="true" aria-labelledby="customer-filter-title" className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center">
                  <Filter className="w-4 h-4" />
                </div>
                <h3 id="customer-filter-title" className="text-sm font-semibold text-slate-900">Filter Customer Records</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="Close customer filters"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-slate-700 text-xs block">Account Status</label>
                <div className="relative">
                  <select
                    value={filters.status || 'ALL'}
                    onChange={(e) =>
                      onFilterChange({
                        status: e.target.value === 'ALL' ? undefined : e.target.value,
                        page: 1,
                      })
                    }
                    className="w-full h-10 pl-3.5 pr-9 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 text-xs appearance-none cursor-pointer"
                  >
                    <option value="ALL">All Account Status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="BLOCKED">Blocked</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-slate-700 text-xs block">KYC Verification State</label>
                <div className="relative">
                  <select
                    value={filters.kycStatus || 'ALL'}
                    onChange={(e) =>
                      onFilterChange({
                        kycStatus: e.target.value === 'ALL' ? undefined : e.target.value,
                        page: 1,
                      })
                    }
                    className="w-full h-10 pl-3.5 pr-9 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 text-xs appearance-none cursor-pointer"
                  >
                    <option value="ALL">All KYC Status</option>
                    <option value="VERIFIED">Verified</option>
                    <option value="PENDING,PARTIAL">Incomplete (Pending + Partial)</option>
                    <option value="PARTIAL">Incomplete / Partial</option>
                    <option value="PENDING">Pending Documents</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="EXPIRED">Expired</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-slate-700 text-xs block">City</label>
                <Input
                  type="text"
                  value={filters.city || ''}
                  onChange={(e) =>
                    onFilterChange({ city: e.target.value || undefined, page: 1 })
                  }
                  placeholder="e.g. Mumbai, Delhi"
                  className="h-10 text-xs bg-white border-slate-300 rounded-xl font-medium text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-slate-700 text-xs block">State</label>
                <Input
                  type="text"
                  value={filters.state || ''}
                  onChange={(e) =>
                    onFilterChange({ state: e.target.value || undefined, page: 1 })
                  }
                  placeholder="e.g. Maharashtra, Gujarat"
                  className="h-10 text-xs bg-white border-slate-300 rounded-xl font-medium text-slate-900"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClearFilters();
                  setIsMobileDrawerOpen(false);
                }}
                className="flex-1 rounded-xl border-slate-300 text-slate-700 font-medium text-xs h-9.5"
              >
                Reset All
              </Button>
              <Button
                size="sm"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="flex-1 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-medium text-xs h-9.5 shadow-xs"
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
