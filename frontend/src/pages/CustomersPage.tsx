import React, { lazy, Suspense, useCallback, useState, useMemo, useEffect } from 'react';
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Users,
  UserPlus,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { customerApi } from '../features/customers/api/customerApi';
import {
  Customer,
  CustomerQueryParams,
  CreateCustomerInput,
  UpdateCustomerInput,
} from '../features/customers/types';
import { CustomerSummaryCards } from '../features/customers/components/CustomerSummaryCards';
import { CustomerFilters } from '../features/customers/components/CustomerFilters';
import { CustomerTable } from '../features/customers/components/CustomerTable';
import { Button } from '../components/ui/button';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { usePermission } from '../hooks/usePermission';

const CustomerFormModal = lazy(() => import('../features/customers/components/CustomerFormModal').then((module) => ({ default: module.CustomerFormModal })));
const CustomerQuickPreview = lazy(() => import('../features/customers/components/CustomerQuickPreview').then((module) => ({ default: module.CustomerQuickPreview })));
const KycDocumentModal = lazy(() => import('../features/customers/components/KycDocumentModal').then((module) => ({ default: module.KycDocumentModal })));

const allowedStatuses = new Set(['ACTIVE', 'INACTIVE', 'BLOCKED', 'ARCHIVED']);
const allowedKycStatuses = new Set(['PENDING', 'PARTIAL', 'PENDING,PARTIAL', 'VERIFIED', 'REJECTED', 'EXPIRED']);
const allowedSortFields = new Set(['customerCode', 'fullName', 'phone', 'status', 'kycStatus', 'createdAt']);

export function CustomersPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const canCreate = usePermission('customers.create');

  // Modal & Preview States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [previewCustomer, setPreviewCustomer] = useState<Customer | null>(null);
  const [kycCustomerId, setKycCustomerId] = useState<string | null>(null);
  const [archiveCustomer, setArchiveCustomer] = useState<Customer | null>(null);

  // Restore saved query params from sessionStorage if landed on bare /customers
  useEffect(() => {
    if (!location.search) {
      const saved = sessionStorage.getItem('customer_list_params');
      if (saved) {
        navigate(`/customers?${saved}`, { replace: true });
      }
    } else {
      sessionStorage.setItem('customer_list_params', location.search.replace(/^\?/, ''));
    }
  }, [location.search, navigate]);

  // Extract query filters from URL
  const filters: CustomerQueryParams = useMemo(() => {
    const rawPage = Number(searchParams.get('page'));
    const rawLimit = Number(searchParams.get('limit'));
    const status = searchParams.get('status');
    const kycStatus = searchParams.get('kycStatus');
    const sortBy = searchParams.get('sortBy');
    const sortOrder = searchParams.get('sortOrder');
    return {
      page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
      limit: [15, 25, 50, 100].includes(rawLimit) ? rawLimit : 25,
      search: searchParams.get('search') || undefined,
      status: status && allowedStatuses.has(status) ? status : undefined,
      kycStatus: kycStatus && allowedKycStatuses.has(kycStatus) ? kycStatus : undefined,
      city: searchParams.get('city') || undefined,
      state: searchParams.get('state') || undefined,
      sortBy: sortBy && allowedSortFields.has(sortBy) ? sortBy : 'createdAt',
      sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
    };
  }, [searchParams]);

  const updateFilters = useCallback((newFilters: Partial<CustomerQueryParams>) => {
    const updated = { ...filters, ...newFilters };
    const params = new URLSearchParams();

    Object.entries(updated).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params.set(key, String(val));
      }
    });

    const queryStr = params.toString();
    if (queryStr) {
      sessionStorage.setItem('customer_list_params', queryStr);
    }
    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  const clearFilters = () => {
    sessionStorage.removeItem('customer_list_params');
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  // Queries
  const { data: statsData, isError: isStatsError } = useQuery({
    queryKey: ['customer-stats'],
    queryFn: ({ signal }) => customerApi.getCustomerStats(signal),
    staleTime: 30_000,
  });

  const {
    data: customerData,
    isLoading,
    isFetching,
    refetch,
    isError,
    error,
  } = useQuery({
    queryKey: ['customers', filters],
    queryFn: ({ signal }) => customerApi.getCustomers(filters, signal),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreateCustomerInput) => customerApi.createCustomer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-stats'] });
      setIsFormModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCustomerInput }) =>
      customerApi.updateCustomer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-stats'] });
      setIsFormModalOpen(false);
      setEditingCustomer(null);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => customerApi.deactivateCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-stats'] });
    },
  });

  const handleCreateOrUpdate = async (
    data: CreateCustomerInput | UpdateCustomerInput
  ) => {
    if (editingCustomer) {
      await updateMutation.mutateAsync({
        id: editingCustomer._id,
        data: data as UpdateCustomerInput,
      });
    } else {
      await createMutation.mutateAsync(data as CreateCustomerInput);
    }
  };

  const handleDeactivate = (customer: Customer) => {
    setArchiveCustomer(customer);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 flex items-center justify-center shadow-2xs">
            <Users className="w-5 h-5 text-emerald-800" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
                Customer Management & KYC
              </h1>
              {isFetching && (
                <RefreshCw className="w-3.5 h-3.5 text-emerald-800 animate-spin" />
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-normal">
              Manage customer profiles, contact details, identification records, and KYC compliance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => Promise.all([refetch(), queryClient.refetchQueries({ queryKey: ['customer-stats'] })])}
            className="flex items-center gap-1.5 text-xs font-medium h-10 px-3.5 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isFetching ? 'animate-spin text-emerald-800' : ''}`} />
            <span>Refresh</span>
          </Button>

          {canCreate && (
            <Button
              size="sm"
              onClick={() => {
                setEditingCustomer(null);
                setIsFormModalOpen(true);
              }}
              className="bg-emerald-800 hover:bg-emerald-900 text-white flex items-center gap-1.5 text-xs font-medium shadow-xs h-10 px-4 rounded-xl cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Customer</span>
            </Button>
          )}
        </div>
      </div>

      {/* 6 Top Summary Cards */}
      <CustomerSummaryCards
        stats={statsData}
        selectedStatus={filters.status}
        selectedKycStatus={filters.kycStatus}
        onSelectFilter={(type, value) => {
          if (type === 'status') {
            updateFilters({
              status: value === 'ALL' ? undefined : value,
              kycStatus: undefined,
              page: 1,
            });
          } else {
            updateFilters({
              kycStatus: value === 'ALL' ? undefined : value,
              status: undefined,
              page: 1,
            });
          }
        }}
      />

      {(isError || isStatsError) && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 font-normal">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <div><strong className="font-semibold">Customer data could not be refreshed.</strong><div className="text-xs mt-0.5 text-rose-700">{error instanceof Error ? error.message : 'Check the server connection and try again.'}</div></div>
        </div>
      )}

      {/* Filter Bar */}
      <CustomerFilters
        filters={filters}
        onFilterChange={updateFilters}
        onClearFilters={clearFilters}
      />

      {/* Main Customers Table */}
      <CustomerTable
        customers={customerData?.customers || []}
        pagination={customerData?.pagination}
        isLoading={isLoading}
        filters={filters}
        onSortChange={(sortBy) => {
          const isSame = filters.sortBy === sortBy;
          const nextOrder = isSame && filters.sortOrder === 'asc' ? 'desc' : 'asc';
          updateFilters({ sortBy, sortOrder: nextOrder });
        }}
        onPageChange={(page) => updateFilters({ page })}
        onLimitChange={(limit) => updateFilters({ limit, page: 1 })}
        onView={(customer) =>
          navigate(`/customers/${customer._id}`, {
            state: { from: location.pathname + location.search },
          })
        }
        onEdit={async (customer) => {
          const fullCustomer = await queryClient.fetchQuery({ queryKey: ['customer', customer._id], queryFn: ({ signal }) => customerApi.getCustomerById(customer._id, signal), staleTime: 30_000 });
          setEditingCustomer(fullCustomer);
          setIsFormModalOpen(true);
        }}
        onManageKyc={(customer) => setKycCustomerId(customer._id)}
        onQuickPreview={(customer) => setPreviewCustomer(customer)}
        onDeactivate={handleDeactivate}
      />

      {/* Create / Edit Customer Modal */}
      <Suspense fallback={null}>{isFormModalOpen && (
        <CustomerFormModal
          customer={editingCustomer}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingCustomer(null);
          }}
          onSubmit={handleCreateOrUpdate}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
        />
      )}</Suspense>

      {/* Walk-in Quick Preview Drawer */}
      <Suspense fallback={null}>{previewCustomer && (
        <CustomerQuickPreview
          customer={previewCustomer}
          onClose={() => setPreviewCustomer(null)}
          onEdit={(customer) => {
            setEditingCustomer(customer);
            setIsFormModalOpen(true);
          }}
          onManageKyc={(customer) => {
            setKycCustomerId(customer._id);
          }}
        />
      )}</Suspense>

      {/* KYC Document Upload / Verification Modal */}
      <Suspense fallback={null}>
        {kycCustomerId && (() => {
          const selectedCustomer = customerData?.customers?.find((c) => c._id === kycCustomerId);
          return (
            <KycDocumentModal
              customerId={kycCustomerId}
              customerName={selectedCustomer?.fullName}
              customerCode={selectedCustomer?.customerCode}
              onClose={() => setKycCustomerId(null)}
              onSubmit={async (data) => {
                await customerApi.addKycDocument(kycCustomerId, data as any);
                setKycCustomerId(null);
                queryClient.invalidateQueries({ queryKey: ['customers'] });
                queryClient.invalidateQueries({ queryKey: ['customer-stats'] });
              }}
              isSubmitting={false}
            />
          );
        })()}
      </Suspense>

      <ConfirmationModal
        isOpen={Boolean(archiveCustomer)}
        onClose={() => setArchiveCustomer(null)}
        onConfirm={() => {
          if (archiveCustomer) {
            deactivateMutation.mutate(archiveCustomer._id, {
              onSuccess: () => setArchiveCustomer(null),
            });
          }
        }}
        title="Archive Customer Profile?"
        message={
          archiveCustomer
            ? `${archiveCustomer.fullName} (${archiveCustomer.customerCode}) will be removed from active safe-deposit workflows. Historical records, past allocations, and financial logs will remain preserved.`
            : ''
        }
        confirmLabel="Archive Customer"
        variant="danger"
        isLoading={deactivateMutation.isPending}
      />
    </div>
  );
}
