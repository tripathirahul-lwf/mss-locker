import React from 'react';
import { Eye, Edit3, Trash2, KeyRound, ArrowUpDown, ChevronLeft, ChevronRight, ChevronDown, Ban } from 'lucide-react';
import { Locker, LockerQueryParams } from '../types';
import { LockerStatusBadge, OperationalStatusBadge } from './LockerStatusBadge';
import { formatINR } from '../utils/formatters';
import { LOCKER_SIZES } from '../constants';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { usePermission } from '../../../hooks/usePermission';

interface LockerTableProps {
  lockers: Locker[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  isLoading: boolean;
  filters: LockerQueryParams;
  onSortChange: (sortBy: string) => void;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onView: (locker: Locker) => void;
  onEdit: (locker: Locker) => void;
  onDeactivate: (locker: Locker) => void;
  onAllocate?: (locker: Locker) => void;
  canAllocate?: boolean;
}

export function LockerTable({
  lockers,
  pagination,
  isLoading,
  filters,
  onSortChange,
  onPageChange,
  onLimitChange,
  onView,
  onEdit,
  onDeactivate,
  onAllocate,
  canAllocate = false,
}: LockerTableProps) {
  const canUpdate = usePermission('lockers.update');
  const canDelete = usePermission('lockers.delete');

  const currentPage = pagination?.page || 1;
  const totalPages = pagination?.totalPages || 1;
  const totalRecords = pagination?.total || 0;
  const limit = pagination?.limit || 25;

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden flex flex-col">
      <div className="divide-y divide-slate-100 md:hidden">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-[92px] animate-pulse bg-gradient-to-r from-white via-slate-50 to-white p-4">
              <div className="h-4 w-28 rounded bg-slate-200" />
              <div className="mt-3 h-3 w-44 rounded bg-slate-100" />
            </div>
          ))
        ) : lockers.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <KeyRound className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-800">No lockers found</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 font-normal">
              Try clearing the current search or filters.
            </p>
          </div>
        ) : (
          lockers.map((locker) => (
            <article key={locker._id} className="relative p-4 active:bg-slate-50">
              <button
                type="button"
                onClick={() => onView(locker)}
                className="block w-full pr-14 text-left"
                aria-label={`View locker ${locker.lockerNumber}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-slate-900">
                    Locker {locker.lockerNumber}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono bg-slate-100/80 border-slate-200 text-slate-600 font-medium px-1.5 py-0.5 rounded-md"
                  >
                    {locker.lockerCode}
                  </Badge>
                  <LockerStatusBadge status={locker.status} />
                </div>
                <p className="mt-1.5 text-xs font-normal text-slate-600">
                  Size {locker.size} &bull; {locker.rackNumber} &bull; {locker.floor || 'Ground Floor'}
                </p>
                <div className="mt-2 flex items-center gap-3 text-[11px]">
                  <OperationalStatusBadge status={locker.operationalStatus} />
                  <span className="font-sans font-semibold tabular-nums text-slate-900">
                    {formatINR(locker.annualRent)}/yr
                  </span>
                </div>
              </button>
              <div className="absolute right-2 top-2 flex flex-col gap-1">
                {canAllocate && onAllocate && locker.status === 'VACANT' && locker.operationalStatus === 'ACTIVE' && locker.isActive && (
                  <button
                    type="button"
                    onClick={() => onAllocate(locker)}
                    className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                    aria-label={`Allocate locker ${locker.lockerNumber}`}
                    title="Allocate Locker"
                  >
                    <KeyRound className="h-4 w-4" />
                  </button>
                )}
                {canUpdate && (
                  <button
                    type="button"
                    onClick={() => onEdit(locker)}
                    className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
                    aria-label={`Edit locker ${locker.lockerNumber}`}
                    title="Edit Locker"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                )}
                {canDelete && locker.isActive && (
                  <button
                    type="button"
                    onClick={() => onDeactivate(locker)}
                    className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                    aria-label={`Deactivate locker ${locker.lockerNumber}`}
                    title="Deactivate Locker"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </div>
      {/* Table Content Wrapper */}
      <div className="hidden overflow-x-auto min-h-[320px] md:block" role="region" aria-label="Locker directory table" aria-busy={isLoading} tabIndex={0}>
        <table className="w-full text-left text-xs border-collapse">
          <caption className="sr-only">Locker register. Activate a sortable column heading to change its sort order.</caption>
          {/* Table Header */}
          <thead className="bg-slate-50/95 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px] sticky top-0 z-10 backdrop-blur-sm">
            <tr>
              <th
                scope="col"
                aria-sort={filters.sortBy === 'lockerNumber' ? (filters.sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                className="p-0"
              >
                <button
                  type="button"
                  onClick={() => onSortChange('lockerNumber')}
                  className="flex min-h-11 w-full items-center gap-1.5 px-4 py-3 text-left hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700 cursor-pointer uppercase tracking-wider text-[11px] font-semibold text-slate-500"
                  aria-label="Sort by locker identifier"
                >
                  <span>LOCKER IDENTIFIER</span>
                  <ArrowUpDown aria-hidden="true" className="w-3 h-3 text-slate-400 shrink-0" />
                </button>
              </th>
              <th
                scope="col"
                aria-sort={filters.sortBy === 'size' ? (filters.sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                className="p-0"
              >
                <button
                  type="button"
                  onClick={() => onSortChange('size')}
                  className="flex min-h-11 w-full items-center gap-1.5 px-3 py-3 text-left hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700 cursor-pointer uppercase tracking-wider text-[11px] font-semibold text-slate-500"
                  aria-label="Sort by locker size"
                >
                  <span>SIZE</span>
                  <ArrowUpDown aria-hidden="true" className="w-3 h-3 text-slate-400 shrink-0" />
                </button>
              </th>
              <th
                scope="col"
                aria-sort={filters.sortBy === 'rackNumber' ? (filters.sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                className="p-0"
              >
                <button
                  type="button"
                  onClick={() => onSortChange('rackNumber')}
                  className="flex min-h-11 w-full items-center gap-1.5 px-3 py-3 text-left hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700 cursor-pointer uppercase tracking-wider text-[11px] font-semibold text-slate-500"
                  aria-label="Sort by rack and section"
                >
                  <span>RACK &amp; SECTION</span>
                  <ArrowUpDown aria-hidden="true" className="w-3 h-3 text-slate-400 shrink-0" />
                </button>
              </th>
              <th
                scope="col"
                aria-sort={filters.sortBy === 'status' ? (filters.sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                className="p-0"
              >
                <button
                  type="button"
                  onClick={() => onSortChange('status')}
                  className="flex min-h-11 w-full items-center gap-1.5 px-3 py-3 text-left hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700 cursor-pointer uppercase tracking-wider text-[11px] font-semibold text-slate-500"
                  aria-label="Sort by occupancy status"
                >
                  <span>OCCUPANCY</span>
                  <ArrowUpDown aria-hidden="true" className="w-3 h-3 text-slate-400 shrink-0" />
                </button>
              </th>
              <th scope="col" className="py-3 px-3 uppercase tracking-wider text-[11px] font-semibold text-slate-500">
                OPS STATUS
              </th>
              <th
                scope="col"
                aria-sort={filters.sortBy === 'annualRent' ? (filters.sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                className="p-0 text-right"
              >
                <button
                  type="button"
                  onClick={() => onSortChange('annualRent')}
                  className="flex min-h-11 w-full items-center justify-end gap-1.5 px-3 py-3 text-right hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700 cursor-pointer uppercase tracking-wider text-[11px] font-semibold text-slate-500"
                  aria-label="Sort by annual rent"
                >
                  <span>ANNUAL RENT</span>
                  <ArrowUpDown aria-hidden="true" className="w-3 h-3 text-slate-400 shrink-0" />
                </button>
              </th>
              <th scope="col" className="py-3 px-3 text-right uppercase tracking-wider text-[11px] font-semibold text-slate-500">
                SECURITY DEPOSIT
              </th>
              <th scope="col" className="py-3 px-4 text-right uppercase tracking-wider text-[11px] font-semibold text-slate-500">
                ACTIONS
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, idx) => (
                <tr key={`skel-${idx}`} className="animate-pulse">
                  <td className="py-3.5 px-4">
                    <div className="h-4 w-24 bg-slate-200 rounded mb-1" />
                    <div className="h-3 w-16 bg-slate-100 rounded" />
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="h-5 w-12 bg-slate-200 rounded" />
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="h-4 w-20 bg-slate-200 rounded mb-1" />
                    <div className="h-3 w-14 bg-slate-100 rounded" />
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="h-5 w-16 bg-slate-200 rounded-full" />
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="h-4 w-16 bg-slate-200 rounded" />
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <div className="h-4 w-16 bg-slate-200 rounded ml-auto" />
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <div className="h-4 w-16 bg-slate-200 rounded ml-auto" />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="h-8 w-20 bg-slate-200 rounded ml-auto" />
                  </td>
                </tr>
              ))
            ) : lockers.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 px-4 text-center">
                  <div className="max-w-sm mx-auto space-y-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">No lockers found</p>
                    <p className="text-xs text-slate-500 font-normal">
                      Try clearing filters or search criteria, or add a new physical locker to the master directory.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              lockers.map((locker) => {
                const sizeItem = LOCKER_SIZES.find((s) => s.code === locker.size);
                const sizeCategory = sizeItem
                  ? sizeItem.label.replace(/^Size\s+[^\s(]+\s*\((.*?)\)$/, '$1')
                  : 'Standard';
                const sizeDims = sizeItem
                  ? sizeItem.dimensions.split(' x ').slice(0, 2).join('×') + ' mm'
                  : '';

                const rawSection = locker.section || '';
                const cleanSec = rawSection
                  .replace(new RegExp(`^${locker.rackNumber}\\s*`, 'i'), '')
                  .trim();
                const displaySection = cleanSec || 'Main Vault';
                const displayLocation = `${locker.floor || 'Ground Floor'} • ${displaySection}`;

                const isAvailable =
                  locker.status === 'VACANT' &&
                  locker.operationalStatus === 'ACTIVE' &&
                  locker.isActive;

                return (
                  <tr
                    key={locker._id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* Locker Number & Code */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-sm tracking-tight">
                          {locker.lockerNumber}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono bg-slate-100/80 border-slate-200 text-slate-600 font-medium px-1.5 py-0.5 rounded-md"
                        >
                          {locker.lockerCode}
                        </Badge>
                      </div>
                      {locker.position && (
                        <span className="text-[11px] text-slate-400 block mt-0.5 font-normal">
                          {locker.position}
                        </span>
                      )}
                    </td>

                    {/* Size */}
                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-slate-800">
                        Size {locker.size}
                      </div>
                      <span className="text-[11px] text-slate-500 font-normal block mt-0.5">
                        {sizeDims ? `${sizeCategory} • ${sizeDims}` : sizeCategory}
                      </span>
                    </td>

                    {/* Rack & Section */}
                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-slate-800 font-mono">
                        {locker.rackNumber}
                      </div>
                      <span className="text-[11px] text-slate-500 font-normal block mt-0.5">
                        {displayLocation}
                      </span>
                    </td>

                    {/* Occupancy Status */}
                    <td className="py-3.5 px-3">
                      <LockerStatusBadge status={locker.status} />
                    </td>

                    {/* Operational Status */}
                    <td className="py-3.5 px-3">
                      <OperationalStatusBadge status={locker.operationalStatus} />
                    </td>

                    {/* Annual Rent */}
                    <td className="py-3.5 px-3 text-right font-sans font-semibold tabular-nums text-slate-900">
                      {formatINR(locker.annualRent)}
                    </td>

                    {/* Security Deposit */}
                    <td className="py-3.5 px-3 text-right font-sans font-normal tabular-nums text-slate-600">
                      {formatINR(locker.securityDeposit)}
                    </td>

                    {/* Row Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canAllocate && onAllocate && isAvailable && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onAllocate(locker)}
                            className="h-8 px-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-900 rounded-lg cursor-pointer transition gap-1.5 border border-emerald-200 shadow-2xs mr-0.5"
                            title="Quick Allocate Locker"
                            aria-label={`Allocate locker ${locker.lockerNumber}`}
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">Allocate</span>
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onView(locker)}
                          className="h-8 w-8 p-0 text-slate-500 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg cursor-pointer"
                          title="View Locker Details"
                          aria-label={`View locker ${locker.lockerNumber}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>

                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(locker)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg cursor-pointer"
                            title="Edit Locker"
                            aria-label={`Edit locker ${locker.lockerNumber}`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                        )}

                        {canDelete && locker.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeactivate(locker)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Deactivate Locker"
                            aria-label={`Deactivate locker ${locker.lockerNumber}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & Summary Bar */}
      <div className="p-3.5 bg-slate-50/80 border-t border-slate-200/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-normal">
        <div className="flex items-center gap-2">
          <span>
            Showing <span className="font-semibold text-slate-800">{lockers.length}</span> of{' '}
            <span className="font-semibold text-slate-800">{totalRecords.toLocaleString()}</span> physical lockers
          </span>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5">
            <span>Per page:</span>
            <div className="relative">
              <select
                aria-label="Rows per page"
                value={limit}
                onChange={(e) => onLimitChange(Number(e.target.value))}
                className="h-8 pl-2.5 pr-6 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 appearance-none cursor-pointer shadow-2xs"
              >
                <option value="15">15</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-700">
            Page {currentPage} of {totalPages}
          </span>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isLoading}
              className="h-8 px-2.5 text-xs rounded-lg border-slate-300 text-slate-700 font-medium hover:bg-slate-50 cursor-pointer disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline ml-1">Prev</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || isLoading}
              className="h-8 px-2.5 text-xs rounded-lg border-slate-300 text-slate-700 font-medium hover:bg-slate-50 cursor-pointer disabled:opacity-40"
            >
              <span className="hidden sm:inline mr-1">Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
