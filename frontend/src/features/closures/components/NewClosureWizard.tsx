import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Key,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Lock,
} from 'lucide-react';
import { allocationApi } from '../../allocations/api/allocationApi';
import { LockerAllocation } from '../../allocations/types';
import { closureApi } from '../api/closureApi';
import {
  ClosureType,
  LockerCondition,
  PhysicalChecklist,
  ClosureReadinessSummary,
} from '../types';

interface NewClosureWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const NewClosureWizard: React.FC<NewClosureWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Allocation Search
  const [allocSearch, setAllocSearch] = useState<string>('');
  const [allocations, setAllocations] = useState<LockerAllocation[]>([]);
  const [loadingAllocations, setLoadingAllocations] = useState<boolean>(false);
  const [selectedAllocation, setSelectedAllocation] =
    useState<LockerAllocation | null>(null);

  // Step 2: Reason & Type
  const [closureType, setClosureType] =
    useState<ClosureType>('CUSTOMER_REQUEST');
  const [requestedClosureDate, setRequestedClosureDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [closureReason, setClosureReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Step 3: Financial Readiness
  const [readiness, setReadiness] = useState<ClosureReadinessSummary | null>(
    null
  );
  const [loadingReadiness, setLoadingReadiness] = useState<boolean>(false);

  // Step 4: Physical Checklist
  const [checklist, setChecklist] = useState<PhysicalChecklist>({
    lockerEmptied: true,
    lockerInspected: true,
    lockerCondition: 'GOOD',
    customerKeyReturned: true,
    masterKeyCheckCompleted: true,
    documentsReturned: true,
    physicalAccessRevoked: true,
    damageNotes: '',
    keyReplacementRequired: false,
  });

  // Search active allocations
  useEffect(() => {
    if (!isOpen) return;

    const fetchAllocations = async () => {
      setLoadingAllocations(true);
      try {
        const res = await allocationApi.getAllocations({
          status: 'ACTIVE',
          search: allocSearch,
          limit: 10,
        });
        setAllocations(res.allocations);
      } catch (err: any) {
        console.error('Error fetching allocations:', err);
      } finally {
        setLoadingAllocations(false);
      }
    };

    const timer = setTimeout(fetchAllocations, 250);
    return () => clearTimeout(timer);
  }, [allocSearch, isOpen]);

  // Fetch readiness when allocation is selected and navigating to Step 3
  useEffect(() => {
    if (selectedAllocation && currentStep === 3) {
      setLoadingReadiness(true);
      closureApi
        .getClosureReadiness(selectedAllocation._id, checklist)
        .then((data) => setReadiness(data))
        .catch((err) => console.error('Error calculating readiness:', err))
        .finally(() => setLoadingReadiness(false));
    }
  }, [selectedAllocation, currentStep]);

  if (!isOpen) return null;

  const handleNext = () => {
    setError(null);
    if (currentStep === 1 && !selectedAllocation) {
      setError('Please select an active locker allocation to continue.');
      return;
    }
    if (currentStep === 2 && (!closureReason || closureReason.trim().length < 3)) {
      setError('Please provide a specific reason for the locker closure.');
      return;
    }
    setCurrentStep((prev) => prev + 1);
  };

  const handlePrev = () => {
    setError(null);
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleSubmit = async () => {
    if (!selectedAllocation) return;

    setSubmitting(true);
    setError(null);

    try {
      await closureApi.createClosure({
        allocationId: selectedAllocation._id,
        closureType,
        closureReason,
        requestedClosureDate,
        physicalChecklist: checklist,
        notes,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to initiate locker closure workflow'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Initiate Locker Surrender & Closure
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Step {currentStep} of 5 &bull;{' '}
              {currentStep === 1 && 'Select Active Allocation'}
              {currentStep === 2 && 'Closure Reason & Timeline'}
              {currentStep === 3 && 'Financial Readiness Verification'}
              {currentStep === 4 && 'Physical Custody Checklist'}
              {currentStep === 5 && 'Review & Initiate Workflow'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-1">
          <div
            className="bg-emerald-600 h-1 transition-all duration-300"
            style={{ width: `${(currentStep / 5) * 100}%` }}
          />
        </div>

        {/* Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Select Active Allocation */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={allocSearch}
                  onChange={(e) => setAllocSearch(e.target.value)}
                  placeholder="Search customer name, phone, locker #, or agreement code..."
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  autoFocus
                />
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {loadingAllocations ? (
                  <div className="p-6 text-center text-sm text-slate-500">
                    Loading active agreements...
                  </div>
                ) : allocations.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">
                    No active allocations found matching your search.
                  </div>
                ) : (
                  allocations.map((alloc: any) => {
                    const isSelected = selectedAllocation?._id === alloc._id;
                    const cust = alloc.customerId;
                    const lock = alloc.lockerId;

                    return (
                      <div
                        key={alloc._id}
                        onClick={() => setSelectedAllocation(alloc)}
                        className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-emerald-50/80 border-emerald-500'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700 font-mono font-bold text-xs">
                            #{lock?.lockerNumber || 'N/A'}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 text-sm">
                              {cust?.fullName || 'Customer Record'}
                            </div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">
                              {alloc.allocationCode} &bull; Phone: {cust?.phone} &bull; Size {lock?.size}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="p-1 rounded-full bg-emerald-600 text-white">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Closure Reason & Details */}
          {currentStep === 2 && selectedAllocation && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase">
                    Target Tenancy
                  </span>
                  <div className="font-bold text-slate-900 text-sm">
                    Locker #{(selectedAllocation.lockerId as any)?.lockerNumber} &bull;{' '}
                    {(selectedAllocation.customerId as any)?.fullName}
                  </div>
                </div>
                <span className="text-xs font-mono bg-white px-2 py-1 border rounded-md text-slate-600">
                  {selectedAllocation.allocationCode}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Closure Type
                  </label>
                  <select
                    value={closureType}
                    onChange={(e) => setClosureType(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="CUSTOMER_REQUEST">Customer Voluntary Surrender</option>
                    <option value="NORMAL">Standard Tenure Expiration</option>
                    <option value="NON_RENEWAL">Non-Renewal Default</option>
                    <option value="ADMINISTRATIVE">Administrative Termination</option>
                    <option value="LEGACY_IMPORT">Historical Legacy Record</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Requested Closure Date
                  </label>
                  <input
                    type="date"
                    value={requestedClosureDate}
                    onChange={(e) => setRequestedClosureDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Surrender / Closure *
                </label>
                <textarea
                  rows={2}
                  value={closureReason}
                  onChange={(e) => setClosureReason(e.target.value)}
                  placeholder="e.g. Relocating to another city, no longer requiring safe deposit locker custody..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Internal Remarks / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional cashier remarks or handover instructions..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* STEP 3: Financial Readiness */}
          {currentStep === 3 && (
            <div className="space-y-4">
              {loadingReadiness ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  Calculating live billing dues & deposit ledger...
                </div>
              ) : readiness ? (
                <>
                  {/* Status Box */}
                  <div
                    className={`p-4 rounded-xl border flex items-start gap-3 ${
                      readiness.isFinanciallyCleared
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50/70 border-rose-200 text-rose-900'
                    }`}
                  >
                    {readiness.isFinanciallyCleared ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-bold text-sm">
                        {readiness.isFinanciallyCleared
                          ? 'Financially Cleared for Closure'
                          : 'Financial Settlement Pending'}
                      </div>
                      <p className="text-xs mt-0.5 opacity-90">
                        {readiness.isFinanciallyCleared
                          ? 'All rental invoices are fully paid and caution money is settled.'
                          : 'Financial settlement is required before final locker release.'}
                      </p>
                    </div>
                  </div>

                  {/* 2-Column Ledger Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Invoices */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-xs font-semibold text-slate-600 uppercase">
                        Rental Dues
                      </span>
                      <div className="text-lg font-bold text-slate-900 font-mono mt-1">
                        ₹{readiness.outstandingInvoiceAmount.toLocaleString('en-IN')}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {readiness.outstandingInvoicesCount} open invoice(s)
                      </div>
                    </div>

                    {/* Deposit */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-xs font-semibold text-slate-600 uppercase">
                        Available Refundable Deposit
                      </span>
                      <div className="text-lg font-bold text-slate-900 font-mono mt-1">
                        ₹{readiness.availableRefundableBalance.toLocaleString('en-IN')}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Deposit Held: ₹{readiness.netDepositHeld.toLocaleString('en-IN')} &bull; Refund Pending: ₹{readiness.pendingRefundAmount.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {readiness.blockers.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="text-xs font-bold text-amber-800 mb-1">
                        Identified Action Items:
                      </div>
                      <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                        {readiness.blockers.map((b, idx) => (
                          <li key={idx}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}

          {/* STEP 4: Physical Checklist */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="text-xs text-slate-600 font-medium">
                Verify that physical handover protocols have been completed by the counter staff:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-white transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.lockerEmptied}
                    onChange={(e) =>
                      setChecklist({ ...checklist, lockerEmptied: e.target.checked })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Locker Completely Emptied
                  </span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-white transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.customerKeyReturned}
                    onChange={(e) =>
                      setChecklist({
                        ...checklist,
                        customerKeyReturned: e.target.checked,
                      })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Customer Keys Returned to Vault
                  </span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-white transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.lockerInspected}
                    onChange={(e) =>
                      setChecklist({
                        ...checklist,
                        lockerInspected: e.target.checked,
                      })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Lock & Hinges Inspected
                  </span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-white transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.physicalAccessRevoked}
                    onChange={(e) =>
                      setChecklist({
                        ...checklist,
                        physicalAccessRevoked: e.target.checked,
                      })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Biometric / Vault Access Revoked
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Locker Physical Condition
                  </label>
                  <select
                    value={checklist.lockerCondition}
                    onChange={(e) =>
                      setChecklist({
                        ...checklist,
                        lockerCondition: e.target.value as LockerCondition,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="GOOD">Good / Ready for Re-allocation</option>
                    <option value="MINOR_DAMAGE">Minor Damage (Scratches/Cosmetic)</option>
                    <option value="DAMAGED">Damaged / Requires Repair</option>
                    <option value="KEY_ISSUE">Key Issue / Lock Replacement Required</option>
                    <option value="OTHER">Other Issue</option>
                  </select>
                </div>

                {checklist.lockerCondition !== 'GOOD' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Damage / Maintenance Notes *
                    </label>
                    <input
                      type="text"
                      value={checklist.damageNotes}
                      onChange={(e) =>
                        setChecklist({ ...checklist, damageNotes: e.target.value })
                      }
                      placeholder="Specify damage details..."
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: Review & Submit */}
          {currentStep === 5 && selectedAllocation && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                  <span className="text-xs font-semibold text-slate-500">Customer & Locker</span>
                  <span className="text-xs font-bold text-slate-900">
                    {(selectedAllocation.customerId as any)?.fullName} &bull; Locker #{(selectedAllocation.lockerId as any)?.lockerNumber}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                  <span className="text-xs font-semibold text-slate-500">Closure Reason</span>
                  <span className="text-xs font-medium text-slate-800">{closureReason}</span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                  <span className="text-xs font-semibold text-slate-500">Locker Condition</span>
                  <span className="text-xs font-semibold text-slate-800">{checklist.lockerCondition}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Initial Status</span>
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    DRAFT &rarr; PENDING REVIEW
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Submitting will create an authoritative Locker Closure workflow. The reviewer/approver will verify physical checklist documents and financial clearance before the locker is released.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentStep === 1 || submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold text-xs rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Previous
          </button>

          {currentStep < 5 ? (
            <button
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Next Step
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Creating Workflow...' : 'Initiate Closure Workflow'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
