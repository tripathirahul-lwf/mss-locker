import React, { useState, useEffect } from 'react';
import { Search, Filter, X, RotateCcw, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { LOCKER_SIZES } from '../constants';
import { LockerQueryParams } from '../types';

interface LockerFiltersProps {
  filters: LockerQueryParams;
  onFilterChange: (filters: Partial<LockerQueryParams>) => void;
  onClearFilters: () => void;
}

export function LockerFilters({
  filters,
  onFilterChange,
  onClearFilters,
}: LockerFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  useEffect(() => {
    if (!isMobileDrawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileDrawerOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isMobileDrawerOpen]);

  // Sync internal search input with incoming prop
  useEffect(() => {
    setSearchInput(filters.search || '');
  }, [filters.search]);

  // Debounce search input
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
      (filters.size && filters.size !== 'ALL') ||
      (filters.status && filters.status !== 'ALL') ||
      (filters.operationalStatus && filters.operationalStatus !== 'ALL') ||
      filters.rackNumber ||
      filters.section ||
      filters.isActive === false
  );

  return (
    <div className="space-y-3">
      {/* Search & Main Filter Bar */}
      <div className="flex min-w-0 flex-col items-stretch gap-3 lg:flex-row lg:items-center">
        {/* Search Bar */}
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            aria-label="Search locker register"
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search locker number, code, rack, or section..."
            className="pl-10 h-10 text-xs sm:text-sm bg-white border-slate-300 rounded-xl font-medium text-slate-900 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                onFilterChange({ search: undefined, page: 1 });
              }}
              aria-label="Clear locker search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Desktop / Tablet Quick Filter Selectors */}
        <div className="hidden min-w-0 flex-wrap items-center gap-2 md:flex lg:flex-nowrap">
          {/* Size Filter */}
          <div className="relative">
            <select
              aria-label="Filter by locker size"
              value={filters.size || 'ALL'}
              onChange={(e) =>
                onFilterChange({
                  size: e.target.value === 'ALL' ? undefined : e.target.value,
                  page: 1,
                })
              }
              className="h-10 pl-3.5 pr-8 text-xs bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 font-medium appearance-none cursor-pointer shadow-2xs"
            >
              <option value="ALL">All Sizes</option>
              {LOCKER_SIZES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label} ({s.code})
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </div>

          {/* Occupancy Status Filter */}
          <div className="relative">
            <select
              aria-label="Filter by occupancy status"
              value={filters.status || 'ALL'}
              onChange={(e) =>
                onFilterChange({
                  status: e.target.value === 'ALL' ? undefined : e.target.value,
                  page: 1,
                })
              }
              className="h-10 pl-3.5 pr-8 text-xs bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 font-medium appearance-none cursor-pointer shadow-2xs"
            >
              <option value="ALL">All Occupancy</option>
              <option value="VACANT">Vacant</option>
              <option value="OCCUPIED">Occupied</option>
              <option value="RESERVED">Reserved</option>
              <option value="BLOCKED">Blocked</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </div>

          {/* Operational Status Filter */}
          <div className="relative">
            <select
              aria-label="Filter by operational status"
              value={filters.operationalStatus || 'ALL'}
              onChange={(e) =>
                onFilterChange({
                  operationalStatus: e.target.value === 'ALL' ? undefined : e.target.value,
                  page: 1,
                })
              }
              className="h-10 pl-3.5 pr-8 text-xs bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 font-medium appearance-none cursor-pointer shadow-2xs"
            >
              <option value="ALL">All Ops Status</option>
              <option value="ACTIVE">Active Unit</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="DAMAGED">Damaged</option>
              <option value="DECOMMISSIONED">Decommissioned</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="h-10 px-3 text-xs flex items-center gap-1.5 text-slate-600 hover:text-slate-900 border-slate-300 rounded-xl font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Clear</span>
            </Button>
          )}
        </div>

        {/* Mobile / Compact Tablet Filter Button */}
        <div className="flex md:hidden items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMobileDrawerOpen(true)}
            className="h-10 flex-1 flex items-center justify-center gap-2 text-xs font-medium border-slate-300 rounded-xl"
          >
            <SlidersHorizontal className="w-4 h-4 text-emerald-800" />
            <span>Filters {hasActiveFilters && '(Active)'}</span>
          </Button>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="h-10 px-3 text-xs border-slate-300 rounded-xl"
            >
              <RotateCcw className="w-4 h-4 text-slate-500" />
            </Button>
          )}
        </div>
      </div>

      {/* Mobile / Tablet Filter Drawer Modal */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-[2px]">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="locker-filters-title"
            className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4 max-h-[90dvh] overflow-y-auto shadow-2xl border border-slate-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center">
                  <Filter className="w-4 h-4" />
                </div>
                <h3 id="locker-filters-title" className="text-sm font-semibold text-slate-900">
                  Filter Physical Lockers
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                aria-label="Close locker filters"
                className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-slate-700 text-xs block">Locker Size</label>
                <div className="relative">
                  <select
                    aria-label="Filter by locker size"
                    value={filters.size || 'ALL'}
                    onChange={(e) =>
                      onFilterChange({
                        size: e.target.value === 'ALL' ? undefined : e.target.value,
                        page: 1,
                      })
                    }
                    className="w-full h-10 pl-3.5 pr-9 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 text-xs appearance-none cursor-pointer"
                  >
                    <option value="ALL">All Sizes</option>
                    {LOCKER_SIZES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.label} ({s.code})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-slate-700 text-xs block">Occupancy Status</label>
                <div className="relative">
                  <select
                    aria-label="Filter by occupancy status"
                    value={filters.status || 'ALL'}
                    onChange={(e) =>
                      onFilterChange({
                        status: e.target.value === 'ALL' ? undefined : e.target.value,
                        page: 1,
                      })
                    }
                    className="w-full h-10 pl-3.5 pr-9 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 text-xs appearance-none cursor-pointer"
                  >
                    <option value="ALL">All Occupancy</option>
                    <option value="VACANT">Vacant (Available)</option>
                    <option value="OCCUPIED">Occupied (Allocated)</option>
                    <option value="RESERVED">Reserved</option>
                    <option value="BLOCKED">Blocked</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-slate-700 text-xs block">Operational Status</label>
                <div className="relative">
                  <select
                    aria-label="Filter by operational status"
                    value={filters.operationalStatus || 'ALL'}
                    onChange={(e) =>
                      onFilterChange({
                        operationalStatus: e.target.value === 'ALL' ? undefined : e.target.value,
                        page: 1,
                      })
                    }
                    className="w-full h-10 pl-3.5 pr-9 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 text-xs appearance-none cursor-pointer"
                  >
                    <option value="ALL">All Operational Statuses</option>
                    <option value="ACTIVE">Active Unit</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="DAMAGED">Damaged</option>
                    <option value="DECOMMISSIONED">Decommissioned</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-slate-700 text-xs block">Rack Identifier</label>
                <Input
                  aria-label="Filter by rack identifier"
                  type="text"
                  value={filters.rackNumber || ''}
                  onChange={(e) =>
                    onFilterChange({ rackNumber: e.target.value || undefined, page: 1 })
                  }
                  placeholder="e.g. Rack-01 or R12"
                  className="h-10 text-xs bg-white border-slate-300 rounded-xl font-medium text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-slate-700 text-xs block">Vault Section</label>
                <Input
                  aria-label="Filter by vault section"
                  type="text"
                  value={filters.section || ''}
                  onChange={(e) =>
                    onFilterChange({ section: e.target.value || undefined, page: 1 })
                  }
                  placeholder="e.g. Vault A or Main Hall"
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
