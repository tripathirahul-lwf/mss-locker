import React from 'react';
import {
  Eye,
  Edit3,
  Trash2,
  Users,
  ShieldCheck,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Phone,
  Mail,
  MapPin,
  CalendarDays,
} from 'lucide-react';
import { Customer, CustomerQueryParams } from '../types';
import { CustomerStatusBadge } from './CustomerStatusBadge';
import { KycStatusBadge } from './KycStatusBadge';
import { formatPhone } from '../utils/phoneFormatter';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { usePermission } from '../../../hooks/usePermission';

interface CustomerTableProps {
  customers: Customer[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  isLoading: boolean;
  filters: CustomerQueryParams;
  onSortChange: (sortBy: string) => void;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onView: (customer: Customer) => void;
  onEdit: (customer: Customer) => void;
  onManageKyc: (customer: Customer) => void;
  onQuickPreview: (customer: Customer) => void;
  onDeactivate: (customer: Customer) => void;
}

export function CustomerTable({
  customers,
  pagination,
  isLoading,
  filters,
  onSortChange,
  onPageChange,
  onLimitChange,
  onView,
  onEdit,
  onManageKyc,
  onQuickPreview,
  onDeactivate,
}: CustomerTableProps) {
  const canUpdate = usePermission('customers.update');
  const canDelete = usePermission('customers.delete');
  const canManageKyc = usePermission('customers.kyc.manage');

  const currentPage = pagination?.page || 1;
  const totalPages = pagination?.totalPages || 1;
  const totalRecords = pagination?.total || 0;
  const limit = pagination?.limit || 25;
  const firstRecord = totalRecords === 0 ? 0 : (currentPage - 1) * limit + 1;
  const lastRecord = Math.min(currentPage * limit, totalRecords);
  const sortDirection = (field: string): 'ascending' | 'descending' | 'none' =>
    filters.sortBy === field ? (filters.sortOrder === 'asc' ? 'ascending' : 'descending') : 'none';

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden flex flex-col">
      <p className="sr-only" role="status" aria-live="polite">
        {isLoading ? 'Loading customers' : `${totalRecords} customer records available`}
      </p>

      {/* Phone and tablet view */}
      <div className="lg:hidden p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/60">
        {isLoading ? Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-56 rounded-xl border border-slate-200 bg-white animate-pulse" />
        )) : customers.length === 0 ? (
          <div className="sm:col-span-2 py-10 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400"><Users className="w-5 h-5" /></div>
            <p className="text-sm font-semibold text-slate-800">No customers found</p>
            <p className="text-xs text-slate-500 font-normal">Clear search or filters to see more records.</p>
          </div>
        ) : customers.map((customer) => (
          <article key={customer._id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-start justify-between gap-3">
              <button type="button" onClick={() => onQuickPreview(customer)} className="min-w-0 flex items-center gap-3 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 cursor-pointer" aria-label={`Quick preview for ${customer.fullName}`}>
                {customer.photoUrl ? (
                  <img src={customer.photoUrl} alt="" loading="lazy" decoding="async" className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center font-semibold border border-emerald-200/80 shrink-0 text-xs font-sans tracking-wide">
                    {customer.fullName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="min-w-0">
                  <span className="font-semibold text-sm text-slate-900 truncate block font-sans">{customer.fullName}</span>
                  <span className="font-sans font-medium text-[11.5px] text-slate-500 tabular-nums">{customer.customerCode}</span>
                </span>
              </button>
              <CustomerStatusBadge status={customer.status} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-sans font-medium text-[13px] tracking-tight tabular-nums truncate text-slate-900">
                  {formatPhone(customer.phone)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate text-slate-600 font-normal">{customer.city || 'Main Vault'}</span>
              </div>
              {customer.email && (
                <div className="col-span-2 flex items-center gap-1.5 min-w-0 text-slate-600 font-normal">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate font-sans text-xs">{customer.email}</span>
                </div>
              )}
              <div className="col-span-2 flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <KycStatusBadge status={customer.kycStatus} />
                <span className="inline-flex items-center gap-1 text-[10.5px] text-slate-500 font-normal">
                  <CalendarDays className="w-3 h-3" />
                  {new Date(customer.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => onView(customer)} className="h-9 text-xs gap-1.5 rounded-xl border-slate-300 font-medium text-slate-700 cursor-pointer hover:bg-slate-50"><Eye className="w-3.5 h-3.5 text-slate-500" /> Profile</Button>
              {canManageKyc && <Button variant="outline" size="sm" onClick={() => onManageKyc(customer)} className="h-9 text-xs gap-1.5 rounded-xl border-emerald-300 text-emerald-800 bg-emerald-50/50 hover:bg-emerald-50 font-medium cursor-pointer"><ShieldCheck className="w-3.5 h-3.5 text-emerald-800" /> KYC</Button>}
              {canUpdate && <Button variant="outline" size="sm" onClick={() => onEdit(customer)} className="h-9 text-xs gap-1.5 rounded-xl border-slate-300 font-medium text-slate-700 cursor-pointer hover:bg-slate-50"><Edit3 className="w-3.5 h-3.5 text-slate-500" /> Edit</Button>}
              {canDelete && customer.isActive && <Button variant="outline" size="sm" onClick={() => onDeactivate(customer)} className="h-9 text-xs gap-1.5 rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 font-medium cursor-pointer"><Trash2 className="w-3.5 h-3.5 text-rose-600" /> Archive</Button>}
            </div>
          </article>
        ))}
      </div>

      {/* Table Wrapper */}
      <div className="hidden lg:block overflow-x-auto min-h-[320px]">
        <table className="w-full text-left text-xs border-collapse">
          <caption className="sr-only">Customer profiles, contact details, KYC status and account status</caption>
          {/* Table Header */}
          <thead className="bg-slate-50/95 border-b border-slate-200 text-slate-500 font-medium uppercase tracking-wider text-[11px] sticky top-0 z-10 backdrop-blur-sm">
            <tr>
              <th
                aria-sort={sortDirection('fullName')}
                className="py-3 px-4"
              >
                <button type="button" onClick={() => onSortChange('fullName')} className="flex items-center gap-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 cursor-pointer hover:text-slate-800">
                  <span>Customer Profile</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th
                aria-sort={sortDirection('phone')}
                className="py-3 px-3"
              >
                <button type="button" onClick={() => onSortChange('phone')} className="flex items-center gap-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 cursor-pointer hover:text-slate-800">
                  <span>Phone & Contact</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3 px-3">Location</th>
              <th
                aria-sort={sortDirection('kycStatus')}
                className="py-3 px-3"
              >
                <button type="button" onClick={() => onSortChange('kycStatus')} className="flex items-center gap-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 cursor-pointer hover:text-slate-800">
                  <span>KYC Compliance</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th
                aria-sort={sortDirection('status')}
                className="py-3 px-3"
              >
                <button type="button" onClick={() => onSortChange('status')} className="flex items-center gap-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 cursor-pointer hover:text-slate-800">
                  <span>Account State</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th
                aria-sort={sortDirection('createdAt')}
                className="py-3 px-3 text-right"
              >
                <button type="button" onClick={() => onSortChange('createdAt')} className="ml-auto flex items-center justify-end gap-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 cursor-pointer hover:text-slate-800">
                  <span>Registered</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, idx) => (
                <tr key={`skel-${idx}`} className="animate-pulse">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-slate-200 rounded-full shrink-0" />
                      <div>
                        <div className="h-4 w-28 bg-slate-200 rounded mb-1" />
                        <div className="h-3 w-16 bg-slate-100 rounded" />
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="h-4 w-24 bg-slate-200 rounded mb-1" />
                    <div className="h-3 w-32 bg-slate-100 rounded" />
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="h-4 w-16 bg-slate-200 rounded" />
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="h-5 w-20 bg-slate-200 rounded-full" />
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="h-5 w-16 bg-slate-200 rounded-full" />
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <div className="h-4 w-16 bg-slate-200 rounded ml-auto" />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="h-8 w-24 bg-slate-200 rounded ml-auto" />
                  </td>
                </tr>
              ))
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 px-4 text-center">
                  <div className="max-w-sm mx-auto space-y-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                      <Users className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">No customers found</p>
                    <p className="text-xs text-slate-500 font-normal">
                      Try clearing search or filters, or register a new safe-deposit customer profile.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr
                  key={customer._id}
                  className="hover:bg-emerald-50/30 transition-colors group"
                >
                  {/* Customer Photo & Name */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {customer.photoUrl ? (
                        <img
                          src={customer.photoUrl}
                          alt={customer.fullName}
                          className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center font-semibold shrink-0 border border-emerald-200/80 text-xs font-sans tracking-wide">
                          {customer.fullName.slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      <div className="space-y-0.5">
                        <button
                          type="button"
                          onClick={() => onQuickPreview(customer)}
                          className="font-semibold text-slate-900 text-[13.5px] sm:text-sm font-sans hover:text-emerald-800 text-left transition-colors truncate block max-w-[200px] cursor-pointer"
                        >
                          {customer.fullName}
                        </button>
                        <Badge
                          variant="outline"
                          className="text-[11px] font-sans bg-slate-100/80 border-slate-200 text-slate-600 font-medium px-2 py-0.5 rounded-md tabular-nums tracking-normal"
                        >
                          {customer.customerCode}
                        </Badge>
                      </div>
                    </div>
                  </td>

                  {/* Phone & Email */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2 font-sans font-medium text-[13.5px] text-slate-900 tracking-tight tabular-nums">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{formatPhone(customer.phone)}</span>
                    </div>
                    {customer.email && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate max-w-[180px] font-normal font-sans mt-0.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{customer.email}</span>
                      </div>
                    )}
                  </td>

                  {/* Location */}
                  <td className="py-3 px-3 text-slate-600 font-normal">
                    <span className="font-medium text-slate-800">
                      {customer.city || 'Main Vault'}
                    </span>
                    <span className="text-[10.5px] text-slate-400 block font-normal">
                      {customer.state || 'Operational'}
                    </span>
                  </td>

                  {/* KYC Compliance */}
                  <td className="py-3 px-3">
                    <KycStatusBadge status={customer.kycStatus} />
                  </td>

                  {/* Account State */}
                  <td className="py-3 px-3">
                    <CustomerStatusBadge status={customer.status} />
                  </td>

                  {/* Registered Date */}
                  <td className="py-3 px-3 text-right font-sans text-xs text-slate-600 font-normal tabular-nums">
                    {new Date(customer.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>

                  {/* Row Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onView(customer)}
                        className="h-8 w-8 p-0 text-slate-500 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg cursor-pointer"
                        title="View Customer Profile"
                        aria-label={`View ${customer.fullName}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>

                      {canManageKyc && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onManageKyc(customer)}
                          className="h-8 px-2 text-xs text-emerald-800 hover:bg-emerald-50 rounded-lg cursor-pointer flex items-center gap-1 font-medium"
                          title="Manage KYC Documents"
                          aria-label={`Manage KYC for ${customer.fullName}`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                          <span className="text-[11px]">KYC</span>
                        </Button>
                      )}

                      {canUpdate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(customer)}
                          className="h-8 w-8 p-0 text-slate-500 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg cursor-pointer"
                          title="Edit Customer"
                          aria-label={`Edit ${customer.fullName}`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                      )}

                      {canDelete && customer.isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeactivate(customer)}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Archive Customer"
                          aria-label={`Archive ${customer.fullName}`}
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

      {/* Pagination Bar */}
      <div className="p-3.5 bg-slate-50/80 border-t border-slate-200/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-normal">
        <div className="flex items-center gap-2">
          <span>
            Showing <span className="font-semibold text-slate-800">{firstRecord}–{lastRecord}</span> of{' '}
            <span className="font-semibold text-slate-800">{totalRecords.toLocaleString()}</span> customers
          </span>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5">
            <span>Per page:</span>
            <div className="relative">
              <select
                value={limit}
                onChange={(e) => onLimitChange(Number(e.target.value))}
                aria-label="Customers per page"
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
              aria-label="Previous customer page"
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
              aria-label="Next customer page"
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
