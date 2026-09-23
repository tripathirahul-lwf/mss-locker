import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  KeyRound,
  Shield,
  Layers,
  MapPin,
  IndianRupee,
  Clock,
  User,
  ShieldAlert,
  CheckCircle2,
  Edit3,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { lockerApi } from '../features/lockers/api/lockerApi';
import { LockerStatusBadge, OperationalStatusBadge } from '../features/lockers/components/LockerStatusBadge';
import { formatINR, isLockerAvailable } from '../features/lockers/utils/formatters';
import { LockerFormModal } from '../features/lockers/components/LockerFormModal';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { usePermission } from '../hooks/usePermission';

export function LockerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const canUpdate = usePermission('lockers.update');
  const canDelete = usePermission('lockers.delete');
  const canViewSensitive = usePermission('lockers.view_sensitive');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false);

  const {
    data: locker,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['locker', id],
    queryFn: () => lockerApi.getLockerById(id!),
    enabled: Boolean(id),
  });

  const deactivateMutation = useMutation({
    mutationFn: () => lockerApi.deactivateLocker(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      queryClient.invalidateQueries({ queryKey: ['locker-stats'] });
      navigate('/lockers');
    },
  });

  if (isLoading) {
    return (
      <div className="py-16 text-center">
        <LoadingSpinner size="lg" label="Loading locker details..." />
      </div>
    );
  }

  if (error || !locker) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 space-y-3">
        <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
        <h3 className="text-base font-bold text-slate-900">Locker Not Found</h3>
        <p className="text-xs text-slate-500">
          The requested physical locker does not exist or has been removed.
        </p>
        <Link to="/lockers">
          <Button variant="outline" size="sm" className="mt-2">
            Back to Lockers Directory
          </Button>
        </Link>
      </div>
    );
  }

  const available = isLockerAvailable(locker);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex items-center justify-between">
        <Link to="/lockers">
          <Button variant="outline" size="sm" className="flex items-center gap-1.5 text-xs">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Lockers Master</span>
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          {canUpdate && (
            <Button
              size="sm"
              onClick={() => setEditModalOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 text-xs font-semibold"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Locker</span>
            </Button>
          )}

          {canDelete && locker.isActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDeactivateOpen(true)}
              className="text-rose-600 hover:bg-rose-50 border-rose-200 text-xs"
              title="Deactivate Locker"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Locker Inspection Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Card Header Banner */}
        <div className="p-6 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-slate-900 text-white shadow-md">
              <KeyRound className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-extrabold text-slate-900">
                  Locker {locker.lockerNumber}
                </h1>
                <Badge variant="outline" className="font-mono text-xs bg-white">
                  {locker.lockerCode}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Size {locker.size} &bull; {locker.rackNumber} &bull; {locker.section || 'Main Vault'}
              </p>
            </div>
          </div>

          <div>
            {available ? (
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold py-1 px-3 border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Available for Allotment
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs py-1 px-3">
                Allocation Locked
              </Badge>
            )}
          </div>
        </div>

        {/* Card Body Details */}
        <div className="p-6 space-y-6 text-xs">
          {/* Status Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Occupancy Status
              </span>
              <LockerStatusBadge status={locker.status} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Operational State
              </span>
              <OperationalStatusBadge status={locker.operationalStatus} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Size Category
              </span>
              <span className="font-bold text-slate-900 font-mono text-sm">
                Size {locker.size}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Record Status
              </span>
              <span
                className={`font-semibold ${
                  locker.isActive ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {locker.isActive ? 'Active Master Record' : 'Deactivated / Archived'}
              </span>
            </div>
          </div>

          {/* Physical Location Coordinates */}
          <div className="p-5 rounded-xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs flex items-center gap-2 pb-2 border-b border-slate-100">
              <MapPin className="w-4 h-4 text-slate-500" />
              <span>Physical Vault Coordinates</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <span className="text-slate-400 block mb-0.5">Rack Identifier</span>
                <span className="font-bold text-slate-900 font-mono text-base">
                  {locker.rackNumber}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Vault Section</span>
                <span className="font-semibold text-slate-800 text-sm">
                  {locker.section || 'Main Vault'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Floor Level</span>
                <span className="font-semibold text-slate-800 text-sm">
                  {locker.floor || 'Ground Floor'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Grid Position</span>
                <span className="font-semibold text-slate-800 text-sm">
                  {locker.position || 'Not specified'}
                </span>
              </div>
            </div>
          </div>

          {/* Financial Tariffs */}
          <div className="p-5 rounded-xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs flex items-center gap-2 pb-2 border-b border-slate-100">
              <IndianRupee className="w-4 h-4 text-slate-500" />
              <span>Financial Tariff Matrix</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-slate-500 block text-xs">Standard Annual Rent</span>
                <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                  {formatINR(locker.annualRent)}
                </span>
                <span className="text-[11px] text-slate-400 block mt-1">Per annum (inc. GST)</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-slate-500 block text-xs">Security Caution Deposit</span>
                <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                  {formatINR(locker.securityDeposit)}
                </span>
                <span className="text-[11px] text-slate-400 block mt-1">Refundable deposit</span>
              </div>
            </div>
          </div>

          {/* Sensitive Master Key Reference */}
          {canViewSensitive && (
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Confidential: Physical Master-Key Reference</span>
              </div>
              <div className="font-mono text-base font-bold text-amber-950 bg-white p-3 rounded-lg border border-amber-300 inline-block">
                {locker.masterKeyReference || 'No master key reference assigned'}
              </div>
              <p className="text-[11px] text-amber-700">
                Restricted to administrators. Do not share key coordinates verbally outside vault area.
              </p>
            </div>
          )}

          {/* Remarks */}
          {locker.remarks && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-700 block mb-1 text-xs">Operational Notes:</span>
              <p className="text-slate-600">{locker.remarks}</p>
            </div>
          )}

          {/* Audit Trail Info */}
          <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-500 font-mono">
            <div>
              <span>Created At: </span>
              <span className="text-slate-800">
                {new Date(locker.createdAt).toLocaleString('en-IN')}
              </span>
              {locker.createdBy && <span> by {locker.createdBy.name}</span>}
            </div>
            <div className="sm:text-right">
              <span>Last Modified: </span>
              <span className="text-slate-800">
                {new Date(locker.updatedAt).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editModalOpen && (
        <LockerFormModal
          locker={locker}
          onClose={() => setEditModalOpen(false)}
          onSubmit={async (data) => {
            await lockerApi.updateLocker(locker._id, data);
            setEditModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['locker', id] });
            queryClient.invalidateQueries({ queryKey: ['lockers'] });
          }}
          isSubmitting={false}
        />
      )}

      {/* Deactivate Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmDeactivateOpen}
        onClose={() => setConfirmDeactivateOpen(false)}
        onConfirm={() => {
          deactivateMutation.mutate();
          setConfirmDeactivateOpen(false);
        }}
        title="Deactivate Vault Locker?"
        message={`Are you sure you want to deactivate Locker ${locker.lockerNumber} (${locker.lockerCode})? This unit will be marked as decommissioned and excluded from active allotment.`}
        confirmLabel="Deactivate Locker"
        variant="danger"
        isLoading={deactivateMutation.isPending}
      />
    </div>
  );
}
