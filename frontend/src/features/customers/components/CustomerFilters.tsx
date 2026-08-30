import React, { useState, useEffect } from 'react';
import { Search, Filter, X, RotateCcw, SlidersHorizontal } from 'lucide-react';
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
    <div className="space-y-3">
      {/* Top Search & Fast Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            aria-label="Search customers"
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, customer code, phone, or email..."
            className="pl-10 h-10 text-xs sm:text-sm bg-white border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                onFilterChange({ search: undefined, page: 1 });
              }}
              className="absolute right-0 top-1/2 -translate-y-1/2 h-11 w-11 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
              aria-label="Clear customer search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Desktop / Large Screen Quick Filters */}
        <div className="hidden md:flex items-center gap-2">
          {/* Customer Status */}
          <select
            aria-label="Filter by account status"
            value={filters.status || 'ALL'}
            onChange={(e) =>
              onFilterChange({
                status: e.target.value === 'ALL' ? undefined : e.target.value,
                page: 1,
              })
            }
            className="h-10 px-3 text-xs bg-white border border-slate-300 rounded-md text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium"
          >
            <option value="ALL">All Account Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="BLOCKED">Blocked</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          {/* KYC Status */}
          <select
            aria-label="Filter by KYC status"
            value={filters.kycStatus || 'ALL'}
            onChange={(e) =>
              onFilterChange({
                kycStatus: e.target.value === 'ALL' ? undefined : e.target.value,
                page: 1,
              })
            }
            className="h-10 px-3 text-xs bg-white border border-slate-300 rounded-md text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium"
          >
            <option value="ALL">All KYC Status</option>
            <option value="VERIFIED">Verified</option>
            <option value="PENDING,PARTIAL">Incomplete (Pending + Partial)</option>
            <option value="PARTIAL">Incomplete / Partial</option>
            <option value="PENDING">Pending Documents</option>
            <option value="REJECTED">Rejected</option>
            <option value="EXPIRED">Expired</option>
          </select>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="h-10 px-3 text-xs flex items-center gap-1.5 text-slate-600 hover:text-slate-900"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </Button>
          )}
        </div>

        {/* Mobile / Tablet Filter Button */}
        <div className="flex md:hidden items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMobileDrawerOpen(true)}
            className="h-10 flex-1 flex items-center justify-center gap-2 text-xs font-semibold"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filters {hasActiveFilters && '(Active)'}</span>
          </Button>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="h-10 px-3 text-xs"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Mobile / Tablet Filter Drawer Modal */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm select-none">
          <div role="dialog" aria-modal="true" aria-labelledby="customer-filter-title" className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-700" />
                <h3 id="customer-filter-title" className="text-sm font-bold text-slate-900">Filter Customer Records</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="h-11 w-11 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label="Close customer filters"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Account Status</label>
                <select
                  value={filters.status || 'ALL'}
                  onChange={(e) =>
                    onFilterChange({
                      status: e.target.value === 'ALL' ? undefined : e.target.value,
                      page: 1,
                    })
                  }
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-md"
                >
                  <option value="ALL">All Account Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="BLOCKED">Blocked</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">KYC Verification State</label>
                <select
                  value={filters.kycStatus || 'ALL'}
                  onChange={(e) =>
                    onFilterChange({
                      kycStatus: e.target.value === 'ALL' ? undefined : e.target.value,
                      page: 1,
                    })
                  }
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-md"
                >
                  <option value="ALL">All KYC Status</option>
                  <option value="VERIFIED">Verified</option>
                  <option value="PENDING,PARTIAL">Incomplete (Pending + Partial)</option>
                  <option value="PARTIAL">Incomplete / Partial</option>
                  <option value="PENDING">Pending Documents</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="EXPIRED">Expired</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">City</label>
                <Input
                  type="text"
                  value={filters.city || ''}
                  onChange={(e) =>
                    onFilterChange({ city: e.target.value || undefined, page: 1 })
                  }
                  placeholder="e.g. Mumbai, Delhi"
                  className="h-10 text-xs bg-slate-50 border-slate-300"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">State</label>
                <Input
                  type="text"
                  value={filters.state || ''}
                  onChange={(e) =>
                    onFilterChange({ state: e.target.value || undefined, page: 1 })
                  }
                  placeholder="e.g. Maharashtra, Gujarat"
                  className="h-10 text-xs bg-slate-50 border-slate-300"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClearFilters();
                  setIsMobileDrawerOpen(false);
                }}
                className="flex-1"
              >
                Reset All
              </Button>
              <Button
                size="sm"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="flex-1"
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
