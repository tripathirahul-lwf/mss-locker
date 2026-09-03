import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Layers, Plus, Clock, Download, RefreshCw } from 'lucide-react';
import { allocationApi } from '../features/allocations/api/allocationApi';
import {
  LockerAllocation,
  AllocationQueryParams,
  AllocationStatus,
  CreateAllocationInput,
  ReserveLockerInput,
} from '../features/allocations/types';
import { AllocationSummaryCards } from '../features/allocations/components/AllocationSummaryCards';
import { AllocationActionRibbon } from '../features/allocations/components/AllocationActionRibbon';
import { AllocationFilterPills } from '../features/allocations/components/AllocationFilterPills';
import { AllocationTable } from '../features/allocations/components/AllocationTable';
import { AllocationWizardModal } from '../features/allocations/components/AllocationWizardModal';
import { AllocationDetailModal } from '../features/allocations/components/AllocationDetailModal';
import { usePermission } from '../hooks/usePermission';

export function AllocationsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const canCreate = usePermission('allocations.create');
  const canActivate = usePermission('allocations.activate');
  const canCancel = usePermission('allocations.cancel');

  // Read URL query parameters
  const page = Number(searchParams.get('page')) || 1;
  const limit = Number(searchParams.get('limit')) || 25;
  const search = searchParams.get('search') || undefined;
  const status = (searchParams.get('status') as AllocationStatus | 'ALL') || undefined;
  const size = searchParams.get('size') || undefined;
  const customerId = searchParams.get('customerId') || undefined;
  const lockerId = searchParams.get('lockerId') || undefined;
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

  const queryFilters: AllocationQueryParams = {
    page,
    limit,
    search,
    status: status === 'ALL' ? undefined : status,
    size,
    customerId,
    lockerId,
    sortBy,
    sortOrder,
  };

  const updateFilters = (newFilters: Partial<AllocationQueryParams>) => {
    const updated = new URLSearchParams(searchParams);

    Object.entries(newFilters).forEach(([key, value]) => {
      if (value === undefined || value === '' || value === 'ALL') {
        updated.delete(key);
      } else {
        updated.set(key, String(value));
      }
    });

    setSearchParams(updated);
  };

  // Queries
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['allocation-stats'],
    queryFn: () => allocationApi.getAllocationStats(),
  });

  const {
    data: listData,
    isLoading: isListLoading,
    isFetching,
    refetch: refetchList,
  } = useQuery({
    queryKey: ['allocations', queryFilters],
    queryFn: () => allocationApi.getAllocations(queryFilters),
  });

  const allocations = listData?.allocations || [];
  const pagination = listData?.pagination;

  // Modal States
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState<'allocate' | 'reserve'>('allocate');
  const [viewingAllocation, setViewingAllocation] = useState<LockerAllocation | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreateAllocationInput | ReserveLockerInput) => {
      if (wizardMode === 'reserve') {
        return allocationApi.reserveLocker(data as ReserveLockerInput);
      }
      return allocationApi.createAllocation(data as CreateAllocationInput);
    },
    onSuccess: () => {
      setWizardOpen(false);
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['allocation-stats'] });
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      queryClient.invalidateQueries({ queryKey: ['locker-stats'] });
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => allocationApi.activateReservation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['allocation-stats'] });
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      queryClient.invalidateQueries({ queryKey: ['locker-stats'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => allocationApi.cancelReservation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['allocation-stats'] });
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      queryClient.invalidateQueries({ queryKey: ['locker-stats'] });
    },
  });

  const handleExportCSV = () => {
    if (allocations.length === 0) return;

    const headers = [
      'Agreement Code',
      'Customer Name',
      'Customer Code',
      'Phone',
      'Locker Number',
      'Size',
      'Rack',
      'Start Date',
      'Billing Cycle',
      'Annual Rent',
      'Caution Deposit',
      'Status',
    ];

    const rows = allocations.map((a: LockerAllocation) => [
      `"${a.allocationCode}"`,
      `"${a.customerId?.fullName || ''}"`,
      `"${a.customerId?.customerCode || ''}"`,
      `"${a.customerId?.phone || ''}"`,
      `"${a.lockerId?.lockerNumber || ''}"`,
      `"${a.lockerId?.size || ''}"`,
      `"${a.lockerId?.rackNumber || ''}"`,
      `"${a.startDate?.slice(0, 10) || ''}"`,
      `"${a.billingCycle}"`,
      `"${a.rentSnapshot ?? a.annualRent}"`,
      `"${a.depositSnapshot ?? a.securityDeposit}"`,
      `"${a.status}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Allocations_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 select-none">
      {/* 1. Summary Metric Cards with 1-Click Filtering */}
      <AllocationSummaryCards
        stats={stats}
        selectedStatus={status}
        onSelectStatus={(s) => updateFilters({ status: s, page: 1 })}
      />

      {/* 2. Action Ribbon & Search Toolbar */}
      <AllocationActionRibbon
        searchQuery={search}
        onSearchChange={(q) => updateFilters({ search: q, page: 1 })}
        selectedSize={size}
        onSizeChange={(s) => updateFilters({ size: s, page: 1 })}
        onNewAllocation={() => {
          setWizardMode('allocate');
          setWizardOpen(true);
        }}
        onReserveLocker={() => {
          setWizardMode('reserve');
          setWizardOpen(true);
        }}
        onExportCSV={handleExportCSV}
        onRefresh={() => {
          refetchList();
          refetchStats();
        }}
        isRefreshing={isFetching}
        canCreate={canCreate}
      />

      {/* 3. Horizontal Touch Filter Pills */}
      <AllocationFilterPills
        selectedStatus={status}
        onSelectStatus={(s) => updateFilters({ status: s, page: 1 })}
      />

      {/* 4. Allocations Table */}
      <AllocationTable
        allocations={allocations}
        pagination={pagination}
        isLoading={isListLoading}
        filters={queryFilters}
        onPageChange={(p) => updateFilters({ page: p })}
        onView={(a) => {
          setIsEditMode(false);
          setViewingAllocation(a);
        }}
        onActivate={(a) => activateMutation.mutate(a._id)}
        onCancel={(a) => cancelMutation.mutate(a._id)}
        onEdit={(a) => {
          setIsEditMode(true);
          setViewingAllocation(a);
        }}
        onNewAllocation={() => {
          setWizardMode('allocate');
          setWizardOpen(true);
        }}
      />

      {/* 5. Allocation Wizard Modal */}
      {wizardOpen && (
        <AllocationWizardModal
          mode={wizardMode}
          onClose={() => setWizardOpen(false)}
          onSubmit={async (data) => {
            await createMutation.mutateAsync(data);
          }}
          isSubmitting={createMutation.isPending}
        />
      )}

      {/* 6. Allocation Detail & Edit Modal */}
      {viewingAllocation && (
        <AllocationDetailModal
          allocation={viewingAllocation}
          initialEditMode={isEditMode}
          onClose={() => setViewingAllocation(null)}
          onActivate={(a) => activateMutation.mutate(a._id)}
          onCancel={(a) => cancelMutation.mutate(a._id)}
        />
      )}
    </div>
  );
}
