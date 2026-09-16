import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  RefreshCw,
  UserPlus,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit3,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  Copy,
  Check,
  X,
} from 'lucide-react';
import { customerApi } from '../../customers/api/customerApi';
import { Customer, CustomerQueryParams } from '../../customers/types';
import { CustomerStatusBadge } from '../../customers/components/CustomerStatusBadge';
import { KycStatusBadge } from '../../customers/components/KycStatusBadge';
import { formatPhone } from '../../customers/utils/phoneFormatter';
import { Button } from '../../../components/ui/button';
import { usePermission } from '../../../hooks/usePermission';

function getInitials(name: string): string {
  if (!name) return 'CU';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface DashboardCustomersWorkspaceProps {
  initialKycStatus?: string;
  onViewCustomer: (customer: Customer) => void;
  onAddCustomer: () => void;
  onEditCustomer?: (customer: Customer) => void;
}

export function DashboardCustomersWorkspace({
  initialKycStatus = 'ALL',
  onViewCustomer,
  onAddCustomer,
  onEditCustomer,
}: DashboardCustomersWorkspaceProps) {
  const navigate = useNavigate();
  const canCreate = usePermission('customers.create');
  const canUpdate = usePermission('customers.update');

  const [kycFilter, setKycFilter] = useState<string>(initialKycStatus);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(15);
  const [search, setSearch] = useState<string>('');
  const [localSearch, setLocalSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

  const handleCopyCode = (e: React.MouseEvent, id: string, code: string) => {
    e.stopPropagation();
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 1800);
  };

  const handleCopyPhone = (e: React.MouseEvent, id: string, phone: string) => {
    e.stopPropagation();
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedPhoneId(id);
    setTimeout(() => setCopiedPhoneId(null), 1800);
  };

  // Sync with prop
  useEffect(() => {
    if (initialKycStatus) {
      setKycFilter(initialKycStatus);
      setPage(1);
    }
  }, [initialKycStatus]);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localSearch !== search) {
        setSearch(localSearch);
        setPage(1);
      }
    }, 350);
    return () => clearTimeout(handler);
  }, [localSearch, search]);

  // Customer stats
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['customer-stats'],
    queryFn: () => customerApi.getCustomerStats(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const totalCustomers = stats?.total ?? 0;
  const kycVerified = stats?.kycVerified ?? 0;
  const kycPending = (stats?.kycPending ?? 0) + (stats?.kycPartial ?? 0);

  // Query filters
  let apiKycStatus: string | undefined = undefined;
  if (kycFilter === 'PENDING_KYC') {
    apiKycStatus = 'PENDING,PARTIAL';
  } else if (kycFilter === 'VERIFIED') {
    apiKycStatus = 'VERIFIED';
  }

  const queryFilters: CustomerQueryParams = {
    page,
    limit,
    search: search || undefined,
    kycStatus: apiKycStatus,
    sortBy,
    sortOrder,
  };

  const {
    data: listData,
    isLoading,
    isFetching,
    refetch: refetchCustomers,
  } = useQuery({
    queryKey: ['customers', queryFilters],
    queryFn: () => customerApi.getCustomers(queryFilters),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const customers = listData?.customers || [];
  const pagination = listData?.pagination;
  const total = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;

  const refreshAll = () => {
    refetchCustomers();
    refetchStats();
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Upper Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs">
        {/* Left: Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => {
              setKycFilter('ALL');
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer select-none shrink-0 ${
              kycFilter === 'ALL'
                ? 'bg-emerald-800 text-white shadow-2xs font-bold'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <span>All Clients</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                kycFilter === 'ALL' ? 'bg-emerald-900 text-white' : 'bg-white text-slate-700'
              }`}
            >
              {totalCustomers}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setKycFilter('VERIFIED');
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer select-none shrink-0 ${
              kycFilter === 'VERIFIED'
                ? 'bg-emerald-800 text-white shadow-2xs font-bold'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>KYC Verified</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                kycFilter === 'VERIFIED' ? 'bg-emerald-900 text-white' : 'bg-white text-slate-700'
              }`}
            >
              {kycVerified}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setKycFilter('PENDING_KYC');
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer select-none shrink-0 ${
              kycFilter === 'PENDING_KYC'
                ? 'bg-amber-600 text-white shadow-2xs font-bold'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>KYC Pending</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                kycFilter === 'PENDING_KYC' ? 'bg-amber-700 text-white' : 'bg-white text-slate-700'
              }`}
            >
              {kycPending}
            </span>
          </button>
        </div>

        {/* Right: Quick actions */}
        <div className="flex items-center gap-2 shrink-0">
          {canCreate && (
            <Button
              size="sm"
              onClick={onAddCustomer}
              className="h-8 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs px-3 shadow-2xs cursor-pointer gap-1"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>+ Customer</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={isFetching}
            className="h-8 rounded-xl border-slate-200 px-2.5 text-slate-600 hover:text-slate-900 cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin text-emerald-700' : ''}`} />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/customers')}
            className="h-8 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold gap-1 px-2.5 cursor-pointer"
          >
            <span>Full View</span>
            <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-2.5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search by customer code, full name, phone number, or city..."
            className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => {
                setLocalSearch('');
                setSearch('');
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={`${sortBy}:${sortOrder}`}
            onChange={(e) => {
              const [sb, so] = e.target.value.split(':');
              setSortBy(sb);
              setSortOrder(so as 'asc' | 'desc');
              setPage(1);
            }}
            className="text-xs py-1.5 px-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-700 font-medium focus:outline-none cursor-pointer"
          >
            <option value="createdAt:desc">Joined (Newest First)</option>
            <option value="createdAt:asc">Joined (Oldest First)</option>
            <option value="fullName:asc">Name (A → Z)</option>
            <option value="customerCode:asc">Customer Code</option>
          </select>

          <span className="text-[11px] font-semibold text-slate-400 px-1">
            {total} Client{total !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Customer Directory Table */}
      {isLoading ? (
        <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-12 text-center text-slate-400 font-medium animate-pulse shadow-2xs text-xs">
          Loading customer registry...
        </div>
      ) : customers.length === 0 ? (
        <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-12 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto border border-emerald-200/80">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No customers found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {search ? 'No clients match your search query.' : 'There are no clients in this list.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3.5">Customer Profile</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3">City / Address</th>
                  <th className="py-2.5 px-3 text-center">KYC Compliance</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr
                    key={c._id}
                    onClick={() => onViewCustomer(c)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-2.5 px-3.5">
                      <div className="flex items-center gap-2.5">
                        {c.photoUrl ? (
                          <img
                            src={c.photoUrl}
                            alt={c.fullName}
                            className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 flex items-center justify-center font-bold text-[11px] shrink-0 select-none">
                            {getInitials(c.fullName)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 group-hover:text-emerald-800 transition-colors truncate max-w-[180px]">
                            {c.fullName}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <button
                              type="button"
                              onClick={(e) => handleCopyCode(e, c._id, c.customerCode)}
                              className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-600 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded transition cursor-pointer"
                              title="Click to copy customer code"
                            >
                              <span>{c.customerCode || 'CU-N/A'}</span>
                              {copiedCodeId === c._id ? (
                                <Check className="w-2.5 h-2.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-2.5 h-2.5 text-slate-400 opacity-60 hover:opacity-100" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={(e) => handleCopyPhone(e, c._id, c.phone)}
                        className="font-mono text-slate-700 text-xs flex items-center gap-1 hover:text-emerald-800 transition cursor-pointer group/phone text-left"
                        title="Click to copy phone"
                      >
                        <Phone className="w-3 h-3 text-slate-400 group-hover/phone:text-emerald-700 shrink-0" />
                        <span>{formatPhone(c.phone)}</span>
                        {copiedPhoneId === c._id ? (
                          <Check className="w-2.5 h-2.5 text-emerald-600 ml-0.5" />
                        ) : (
                          <Copy className="w-2.5 h-2.5 text-slate-300 group-hover/phone:text-slate-500 opacity-0 group-hover/phone:opacity-100 transition-opacity ml-0.5" />
                        )}
                      </button>
                      {c.email && (
                        <div className="text-[10.5px] text-slate-400 flex items-center gap-1 truncate max-w-[160px] mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{c.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {c.city && c.city.toLowerCase() !== 'main vault' ? (
                        <div>
                          <div className="flex items-center gap-1 truncate max-w-[150px] font-medium text-slate-700">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{c.city}</span>
                          </div>
                          {c.address && (
                            <div className="text-[10px] text-slate-400 truncate max-w-[160px] pl-4">
                              {c.address}
                            </div>
                          )}
                        </div>
                      ) : c.address ? (
                        <div className="flex items-center gap-1 truncate max-w-[160px] text-slate-600">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{c.address}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <KycStatusBadge status={c.kycStatus} />
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <CustomerStatusBadge status={c.status} className="text-[10.5px] px-2 py-0.5" />
                    </td>
                    <td className="py-2.5 px-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onViewCustomer(c)}
                          className="inline-flex items-center gap-1 py-1 px-2.5 rounded-lg border border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 text-slate-700 text-xs font-semibold transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>Dossier</span>
                        </button>
                        {canUpdate && onEditCustomer && (
                          <button
                            type="button"
                            onClick={() => onEditCustomer(c)}
                            className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                            title="Edit profile"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200/90 text-xs">
          <span className="text-slate-500 font-medium">
            Page {page} of {totalPages} ({total} total clients)
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
