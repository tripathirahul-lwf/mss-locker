import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Building2,
  Key,
  User,
  FileText,
  DollarSign,
  Ban,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { LockerClosure, ClosureReadinessSummary } from '../types';
import { ClosureStatusBadge } from './ClosureStatusBadge';
import { closureApi } from '../api/closureApi';
import { ConfirmationModal } from '../../../components/common/ConfirmationModal';

interface ClosureDetailModalProps {
  closure: LockerClosure | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onPrint: (closure: LockerClosure) => void;
  userPermissions: string[];
  currentUserId?: string;
  onNavigateToPayments?: (invoiceId?: string) => void;
  onNavigateToDeposits?: (allocationId?: string) => void;
}

export const ClosureDetailModal: React.FC<ClosureDetailModalProps> = ({
  closure,
  isOpen,
  onClose,
  onRefresh,
  onPrint,
  userPermissions,
  currentUserId,
  onNavigateToPayments,
  onNavigateToDeposits,
}) => {
  const [readiness, setReadiness] = useState<ClosureReadinessSummary | null>(null);
  const [loadingReadiness, setLoadingReadiness] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Dialog state
  const [dialogMode, setDialogMode] = useState<
    'NONE' | 'REVIEW' | 'APPROVE' | 'COMPLETE' | 'REJECT' | 'CANCEL'
  >('NONE');
  const [dialogNotes, setDialogNotes] = useState<string>('');
  const [overrideFinancial, setOverrideFinancial] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');

  const canReview = userPermissions.includes('closures.review');
  const canApprove = userPermissions.includes('closures.approve');
  const canComplete = userPermissions.includes('closures.complete');
  const canReject = userPermissions.includes('closures.reject');
  const canCancel = userPermissions.includes('closures.cancel');
  const canPrint = userPermissions.includes('closures.print');
  const canOverride = userPermissions.includes('closures.financial_override');

  const isRequester =
    currentUserId && closure && String(closure.requestedBy?._id) === String(currentUserId);

  useEffect(() => {
    if (!isOpen || !closure) {
      setReadiness(null);
      setDialogMode('NONE');
      setActionError(null);
      return;
    }

    // Fetch real-time readiness
    setLoadingReadiness(true);
    closureApi
      .getClosureReadiness(closure._id, closure.physicalChecklist)
      .then((data) => setReadiness(data))
      .catch((err) => console.error('Error loading readiness:', err))
      .finally(() => setLoadingReadiness(false));
  }, [isOpen, closure]);

  if (!isOpen || !closure) return null;

  const customer = closure.customerId;
  const locker = closure.lockerId;
  const allocation = closure.allocationId;
  const checklist = closure.physicalChecklist;

  const handleAction = async () => {
    setActionLoading(true);
    setActionError(null);

    try {
      if (dialogMode === 'REVIEW') {
        await closureApi.reviewClosure(closure._id, dialogNotes, checklist);
      } else if (dialogMode === 'APPROVE') {
        await closureApi.approveClosure(
          closure._id,
          dialogNotes,
          overrideFinancial,
          overrideReason
        );
      } else if (dialogMode === 'COMPLETE') {
        await closureApi.completeClosure(closure._id, dialogNotes);
      } else if (dialogMode === 'REJECT') {
        await closureApi.rejectClosure(closure._id, dialogNotes);
      } else if (dialogMode === 'CANCEL') {
        await closureApi.cancelClosure(closure._id, dialogNotes);
      }

      setDialogMode('NONE');
      onRefresh();
      onClose();
    } catch (err: any) {
      setActionError(
        err.response?.data?.message || err.message || 'Operation failed'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);

  const handleQuickSubmit = () => {
    setSubmitConfirmOpen(true);
  };

  const handleConfirmQuickSubmit = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await closureApi.submitClosure(closure._id);
      setSubmitConfirmOpen(false);
      onRefresh();
      onClose();
    } catch (err: any) {
      setActionError(
        err.response?.data?.message || err.message || 'Submit failed'
      );
    } finally {
      setActionLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex h-[100dvh] w-screen items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
      <div role="dialog" aria-modal="true" aria-labelledby="closure-detail-title" className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl sm:max-h-[calc(100dvh-3rem)]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">
              <Key className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="closure-detail-title" className="text-lg font-bold text-slate-900 font-mono">
                  {closure.closureNumber}
                </h2>
                <ClosureStatusBadge status={closure.status} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Requested on{' '}
                {new Date(closure.requestedClosureDate).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}{' '}
                by {closure.requestedBy?.name || 'Staff'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canPrint && ['COMPLETED', 'APPROVED'].includes(closure.status) && (
              <button
                onClick={() => onPrint(closure)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Statement
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close closure details"
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {actionError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{actionError}</span>
            </div>
          )}

          {/* 3-Column Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Customer */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <User className="w-3.5 h-3.5" /> Customer Dossier
              </div>
              <div className="font-bold text-slate-900 text-sm">
                {customer?.fullName || 'N/A'}
              </div>
              <div className="text-xs text-slate-600 space-y-0.5 font-mono">
                <div>Code: {customer?.customerCode}</div>
                <div>Phone: {customer?.phone}</div>
                {customer?.city && <div className="font-sans">City: {customer.city}</div>}
              </div>
            </div>

            {/* Locker */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <Building2 className="w-3.5 h-3.5" /> Locker Details
              </div>
              <div className="font-bold text-slate-900 text-sm font-mono">
                Locker #{locker?.lockerNumber || 'N/A'}
              </div>
              <div className="text-xs text-slate-600 space-y-0.5">
                <div>Size: <span className="font-semibold">{locker?.size || 'STD'}</span></div>
                <div>Rack: {locker?.rackNumber || 'N/A'} {locker?.section ? `• ${locker.section}` : ''}</div>
                <div>Floor: {locker?.floor || 'Ground Floor'}</div>
              </div>
            </div>

            {/* Tenancy Agreement */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5" /> Tenancy Coordinates
              </div>
              <div className="font-bold text-slate-900 text-sm font-mono">
                {allocation?.allocationCode || 'N/A'}
              </div>
              <div className="text-xs text-slate-600 space-y-0.5">
                <div>
                  Start:{' '}
                  {allocation?.startDate
                    ? new Date(allocation.startDate).toLocaleDateString('en-IN')
                    : 'N/A'}
                </div>
                <div>Rent Tariff: ₹{(allocation?.annualRent || 0).toLocaleString('en-IN')}/yr</div>
                <div>Caution Deposit: ₹{(allocation?.securityDeposit || 0).toLocaleString('en-IN')}</div>
              </div>
            </div>
          </div>

          {/* Reason & Type Banner */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Surrender Justification
              </span>
              <p className="text-sm font-medium text-slate-800 mt-0.5">
                {closure.closureReason}
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 capitalize whitespace-nowrap">
              {closure.closureType.toLowerCase().replace('_', ' ')}
            </span>
          </div>

          {/* Real-time Financial Readiness Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Live Financial Settlement Ledger
              </h3>
              {loadingReadiness && (
                <span className="text-xs text-slate-400 animate-pulse">
                  Re-verifying ledger...
                </span>
              )}
            </div>

            {readiness ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Rental Invoices Box */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 uppercase">
                      Rental Invoices Balance
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                        readiness.outstandingInvoiceAmount === 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {readiness.outstandingInvoiceAmount === 0 ? 'CLEARED' : 'DUES PENDING'}
                    </span>
                  </div>

                  <div className="text-xl font-bold font-mono text-slate-900">
                    ₹{readiness.outstandingInvoiceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Billed: ₹{readiness.totalBilledAmount.toLocaleString('en-IN')} &bull; Paid: ₹{readiness.totalPaidAmount.toLocaleString('en-IN')}
                  </div>

                  {readiness.outstandingInvoiceAmount > 0 && onNavigateToPayments && (
                    <button
                      onClick={() => onNavigateToPayments(readiness.openInvoices[0]?._id)}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                    >
                      Collect Dues in Payments <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Caution Deposit Box */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 uppercase">
                      Caution Deposit Ledger
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                        readiness.availableRefundableBalance === 0 && readiness.pendingRefundAmount === 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {readiness.availableRefundableBalance === 0 && readiness.pendingRefundAmount === 0
                        ? 'SETTLED'
                        : 'REFUND REQUIRED'}
                    </span>
                  </div>

                  <div className="text-xl font-bold font-mono text-slate-900">
                    ₹{readiness.netDepositHeld.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Refunded: ₹{readiness.totalRefunded.toLocaleString('en-IN')} &bull; Deductions: ₹{readiness.totalDeductions.toLocaleString('en-IN')}
                  </div>

                  {readiness.availableRefundableBalance > 0 && onNavigateToDeposits && (
                    <button
                      onClick={() => onNavigateToDeposits(allocation?._id)}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                    >
                      Process Refund in Deposits <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Physical Checklist Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-700" />
              Physical Custody & Inspection Checklist
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-2">
                <CheckCircle2
                  className={`w-4 h-4 ${
                    checklist.lockerEmptied ? 'text-emerald-600' : 'text-slate-300'
                  }`}
                />
                <span className="font-medium text-slate-800">Locker Emptied</span>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-2">
                <CheckCircle2
                  className={`w-4 h-4 ${
                    checklist.customerKeyReturned ? 'text-emerald-600' : 'text-slate-300'
                  }`}
                />
                <span className="font-medium text-slate-800">Keys Returned</span>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-2">
                <CheckCircle2
                  className={`w-4 h-4 ${
                    checklist.lockerInspected ? 'text-emerald-600' : 'text-slate-300'
                  }`}
                />
                <span className="font-medium text-slate-800">Lock Inspected</span>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-2">
                <CheckCircle2
                  className={`w-4 h-4 ${
                    checklist.physicalAccessRevoked ? 'text-emerald-600' : 'text-slate-300'
                  }`}
                />
                <span className="font-medium text-slate-800">Access Revoked</span>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-2">
                <CheckCircle2
                  className={`w-4 h-4 ${
                    checklist.documentsReturned ? 'text-emerald-600' : 'text-slate-300'
                  }`}
                />
                <span className="font-medium text-slate-800">Surrender Docs</span>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                <span className="font-medium text-slate-600">Condition:</span>
                <span className="font-bold text-slate-900">{checklist.lockerCondition || 'GOOD'}</span>
              </div>
            </div>

            {checklist.damageNotes && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg">
                <strong>Damage Notes:</strong> {checklist.damageNotes}
              </div>
            )}
          </div>

          {/* Maker-Checker Audit Trail */}
          <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-1">
            <div>
              Requested by: <span className="font-semibold text-slate-700">{closure.requestedBy?.name}</span> on{' '}
              {new Date(closure.requestedAt).toLocaleString('en-IN')}
            </div>
            {closure.reviewedBy && (
              <div>
                Reviewed by: <span className="font-semibold text-slate-700">{closure.reviewedBy.name}</span> on{' '}
                {new Date(closure.reviewedAt!).toLocaleString('en-IN')}{' '}
                {closure.reviewNotes && `(${closure.reviewNotes})`}
              </div>
            )}
            {closure.approvedBy && (
              <div>
                Approved by: <span className="font-semibold text-slate-700">{closure.approvedBy.name}</span> on{' '}
                {new Date(closure.approvedAt!).toLocaleString('en-IN')}
              </div>
            )}
            {closure.completedBy && (
              <div>
                Completed by: <span className="font-semibold text-slate-700">{closure.completedBy.name}</span> on{' '}
                {new Date(closure.completedAt!).toLocaleString('en-IN')}
              </div>
            )}
          </div>

          {/* Action Dialog Form (If mode selected) */}
          {dialogMode !== 'NONE' && (
            <div className="p-4 rounded-xl border border-slate-300 bg-slate-50 space-y-3 animate-in fade-in duration-100">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase">
                  {dialogMode === 'REVIEW' && 'Review Operational Clearances'}
                  {dialogMode === 'APPROVE' && 'Authorize Locker Closure (Maker-Checker)'}
                  {dialogMode === 'COMPLETE' && 'Execute Final Locker Release'}
                  {dialogMode === 'REJECT' && 'Reject Closure Request'}
                  {dialogMode === 'CANCEL' && 'Cancel Closure Request'}
                </h4>
                <button
                  onClick={() => setDialogMode('NONE')}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>

              <textarea
                rows={2}
                value={dialogNotes}
                onChange={(e) => setDialogNotes(e.target.value)}
                placeholder={
                  dialogMode === 'REJECT' || dialogMode === 'CANCEL'
                    ? 'Enter mandatory reason...'
                    : 'Add audit remarks...'
                }
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
              />

              {dialogMode === 'APPROVE' && canOverride && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-amber-900">
                    <input
                      type="checkbox"
                      checked={overrideFinancial}
                      onChange={(e) => setOverrideFinancial(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    Authorise Financial Override (Bypass outstanding dues)
                  </label>
                  {overrideFinancial && (
                    <input
                      type="text"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Mandatory financial override justification..."
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-amber-300 rounded-md focus:outline-hidden"
                    />
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDialogMode('NONE')}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
                >
                  Back
                </button>
                <button
                  onClick={handleAction}
                  disabled={actionLoading}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Confirm Action'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {canCancel && !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(closure.status) && (
              <button
                onClick={() => setDialogMode('CANCEL')}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel Request
              </button>
            )}
            {canReject && !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(closure.status) && (
              <button
                onClick={() => setDialogMode('REJECT')}
                className="px-3 py-1.5 text-xs font-semibold text-red-700 hover:text-red-800 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
              >
                Reject Request
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {closure.status === 'DRAFT' && (
              <button
                onClick={handleQuickSubmit}
                disabled={actionLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                Submit for Review
              </button>
            )}

            {canReview && ['PENDING_REVIEW', 'PENDING_SETTLEMENT'].includes(closure.status) && (
              <button
                onClick={() => setDialogMode('REVIEW')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                Review Clearances
              </button>
            )}

            {canApprove &&
              ['READY_FOR_CLOSURE', 'PENDING_REVIEW'].includes(closure.status) &&
              !isRequester && (
                <button
                  onClick={() => setDialogMode('APPROVE')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  Approve Closure
                </button>
              )}

            {canComplete && closure.status === 'APPROVED' && (
              <button
                onClick={() => setDialogMode('COMPLETE')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                Execute Release & Complete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Submit for Review Confirmation Modal */}
      <ConfirmationModal
        isOpen={submitConfirmOpen}
        onClose={() => !actionLoading && setSubmitConfirmOpen(false)}
        onConfirm={handleConfirmQuickSubmit}
        title="Submit Day-End Closure for Review?"
        message={
          <div className="space-y-1.5 text-xs text-slate-600 font-normal">
            <p>
              Submit closure request <strong className="font-semibold text-slate-900">{closure.closureNumber || 'Draft'}</strong> for locker <strong className="font-semibold text-slate-900">#{locker?.lockerNumber}</strong> for verification?
            </p>
            <p className="text-[11px] text-slate-500">
              All physical custody checklist items and financial reconciliations will be forwarded for supervisor sign-off.
            </p>
          </div>
        }
        confirmLabel="Submit for Review"
        cancelLabel="Keep Drafting"
        variant="emerald"
        isLoading={actionLoading}
      />
    </div>,
    document.body
  );
};
