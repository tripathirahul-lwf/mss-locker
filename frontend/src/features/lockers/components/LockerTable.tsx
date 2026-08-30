import React from 'react';
import { Eye, Edit3, Trash2, KeyRound, ArrowUpDown, ChevronLeft, ChevronRight, Ban } from 'lucide-react';
import { Locker, LockerQueryParams } from '../types';
import { LockerStatusBadge, OperationalStatusBadge } from './LockerStatusBadge';
import { formatINR } from '../utils/formatters';
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
}: LockerTableProps) {
  const canUpdate = usePermission('lockers.update');
  const canDelete = usePermission('lockers.delete');

  const currentPage = pagination?.page || 1;
  const totalPages = pagination?.totalPages || 1;
  const totalRecords = pagination?.total || 0;
  const limit = pagination?.limit || 25;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden flex flex-col">
      <div className="divide-y divide-slate-100 md:hidden">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-[92px] animate-pulse bg-gradient-to-r from-white via-slate-50 to-white p-4"><div className="h-4 w-28 rounded bg-slate-200" /><div className="mt-3 h-3 w-44 rounded bg-slate-100" /></div>)
        ) : lockers.length === 0 ? (
          <div className="px-5 py-12 text-center"><KeyRound className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-800">No lockers found</p><p className="mt-1 text-xs leading-relaxed text-slate-500">Try clearing the current search or filters.</p></div>
        ) : lockers.map((locker) => (
          <article key={locker._id} className="relative p-4 active:bg-slate-50">
            <button type="button" onClick={() => onView(locker)} className="block w-full pr-12 text-left" aria-label={`View locker ${locker.lockerNumber}`}>
              <div className="flex flex-wrap items-center gap-2"><strong className="text-base text-slate-950">Locker {locker.lockerNumber}</strong><LockerStatusBadge status={locker.status} /></div>
              <p className="mt-1.5 text-xs font-medium text-slate-600">Size {locker.size} · {locker.rackNumber} · {locker.section || 'Main Vault'}</p>
              <div className="mt-2 flex items-center gap-3 text-[11px]"><OperationalStatusBadge status={locker.operationalStatus} /><span className="font-mono font-bold text-slate-800">{formatINR(locker.annualRent)}/yr</span></div>
            </button>
            <div className="absolute right-2 top-2 flex flex-col gap-1">
              {canUpdate && <button type="button" onClick={() => onEdit(locker)} className="grid h-11 w-11 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label={`Edit locker ${locker.lockerNumber}`}><Edit3 className="h-4 w-4" /></button>}
              {canDelete && locker.isActive && <button type="button" onClick={() => onDeactivate(locker)} className="grid h-11 w-11 place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Deactivate locker ${locker.lockerNumber}`}><Trash2 className="h-4 w-4" /></button>}
            </div>
          </article>
        ))}
      </div>
      {/* Table Content Wrapper */}
      <div className="hidden overflow-x-auto min-h-[320px] md:block" role="region" aria-label="Locker directory table" aria-busy={isLoading} tabIndex={0}>
        <table className="w-full text-left text-xs border-collapse">
          <caption className="sr-only">Locker register. Activate a sortable column heading to change its sort order.</caption>
          {/* Table Header */}
          <thead className="bg-slate-50/95 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10 backdrop-blur-sm">
            <tr>
              <th
                scope="col"
                aria-sort={filters.sortBy === 'lockerNumber' ? (filters.sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                className="p-0"
              >
                <button type="button" onClick={() => onSortChange('lockerNumber')} className="flex min-h-11 w-full items-center gap-1.5 px-4 py-3 text-left hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600" aria-label="Sort by locker identifier">
                  <span>Locker Identifier</span>
                  <ArrowUpDown aria-hidden="true" className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th
                scope="col"
                aria-sort={filters.sortBy === 'size' ? (filters.sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                className="p-0"
              >
                <button type="button" onClick={() => onSortChange('size')} className="flex min-h-11 w-full items-center gap-1.5 px-3 py-3 text-left hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600" aria-label="Sort by locker size">
                  <span>Size</span>
                  <ArrowUpDown aria-hidden="true" className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th
                scope="col"
                aria-sort={filters.sortBy === 'rackNumber' ? (filters.sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                className="p-0"
              >
                <button type="button" onClick={() => onSortChange('rackNumber')} className="flex min-h-11 w-full items-center gap-1.5 px-3 py-3 text-left hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600" aria-label="Sort by rack and section">
                  <span>Rack & Section</span>
                  <ArrowUpDown aria-hidden="true" className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th
                scope="col"
                aria-sort={filters.sortBy === 'status' ? (filters.sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                className="p-0"
              >
                <button type="button" onClick={() => onSortChange('status')} className="flex min-h-11 w-full items-center gap-1.5 px-3 py-3 text-left hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600" aria-label="Sort by occupancy status">
                  <span>Occupancy</span>
                  <ArrowUpDown aria-hidden="true" className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th scope="col" className="py-3 px-3">Ops Status</th>
              <th
                scope="col"
                aria-sort={filters.sortBy === 'annualRent' ? (filters.sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                className="p-0 text-right"
              >
                <button type="button" onClick={() => onSortChange('annualRent')} className="flex min-h-11 w-full items-center justify-end gap-1.5 px-3 py-3 text-right hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600" aria-label="Sort by annual rent">
                  <span>Annual Rent</span>
                  <ArrowUpDown aria-hidden="true" className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th scope="col" className="py-3 px-3 text-right">Security Deposit</th>
              <th scope="col" className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100">
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
                    <p className="text-sm font-bold text-slate-800">No lockers found</p>
                    <p className="text-xs text-slate-500">
                      Try clearing filters or search criteria, or add a new physical locker to the master directory.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              lockers.map((locker) => (
                <tr
                  key={locker._id}
                  className="hover:bg-slate-50/80 transition-colors group"
                >
                  {/* Locker Number & Code */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-slate-900 text-sm">
                        {locker.lockerNumber}
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono bg-slate-50 border-slate-200 text-slate-600 font-semibold"
                      >
                        {locker.lockerCode}
                      </Badge>
                    </div>
                    {locker.position && (
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        {locker.position}
                      </span>
                    )}
                  </td>

                  {/* Size */}
                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-800">
                      Size {locker.size}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {locker.floor || 'Ground'}
                    </span>
                  </td>

                  {/* Rack & Section */}
                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-800 font-mono">
                      {locker.rackNumber}
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {locker.section || 'Main Vault'}
                    </span>
                  </td>

                  {/* Occupancy Status */}
                  <td className="py-3 px-3">
                    <LockerStatusBadge status={locker.status} />
                  </td>

                  {/* Operational Status */}
                  <td className="py-3 px-3">
                    <OperationalStatusBadge status={locker.operationalStatus} />
                  </td>

                  {/* Annual Rent */}
                  <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900">
                    {formatINR(locker.annualRent)}
                  </td>

                  {/* Security Deposit */}
                  <td className="py-3 px-3 text-right font-mono text-slate-600">
                    {formatINR(locker.securityDeposit)}
                  </td>

                  {/* Row Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onView(locker)}
                        className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
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
                          className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
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
                          className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Deactivate Locker"
                          aria-label={`Deactivate locker ${locker.lockerNumber}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & Summary Bar */}
      <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span>
            Showing <strong>{lockers.length}</strong> of{' '}
            <strong>{totalRecords.toLocaleString()}</strong> physical lockers
          </span>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5">
            <span>Per page:</span>
            <select
              aria-label="Rows per page"
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="h-7 px-2 bg-white border border-slate-300 rounded text-xs font-semibold focus:outline-none"
            >
              <option value="15">15</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
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
              className="h-8 px-2 text-xs"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Prev</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || isLoading}
              className="h-8 px-2 text-xs"
            >
              <span className="hidden sm:inline mr-1">Next</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
