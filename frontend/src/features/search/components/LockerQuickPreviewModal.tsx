import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  X,
  KeyRound,
  Building2,
  User,
  ShieldCheck,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  PlusCircle,
  Wrench,
} from 'lucide-react';
import { searchApi } from '../api/searchApi';
import { LockerQuickPreviewData } from '../types';

interface LockerQuickPreviewModalProps {
  lockerId: string | null;
  isOpen: boolean;
  onClose: () => void;
  userPermissions?: string[];
}

export const LockerQuickPreviewModal: React.FC<LockerQuickPreviewModalProps> = ({
  lockerId,
  isOpen,
  onClose,
  userPermissions = [],
}) => {
  const navigate = useNavigate();
  const [data, setData] = useState<LockerQuickPreviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const canAllocate = userPermissions.includes('allocations.create');
  const canViewLocker = userPermissions.includes('lockers.view');

  useEffect(() => {
    if (!isOpen || !lockerId) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    searchApi
      .getLockerQuickPreview(lockerId)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        console.error('Error loading locker quick preview:', err);
        setError('Failed to load locker information.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, lockerId]);

  if (!isOpen || !lockerId) return null;

  const locker = data?.locker;
  const tenant = data?.currentTenant;
  const dues = data?.dues;

  const modalContent = (
    <div
      className="fixed inset-0 z-[110] w-screen h-screen flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs select-none animate-in fade-in-0 duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Locker Quick Preview
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mb-3" />
              <p className="font-medium">Loading locker specs...</p>
            </div>
          ) : error || !locker ? (
            <div className="p-8 text-center text-rose-600 text-sm font-medium">
              {error || 'Locker not found.'}
            </div>
          ) : (
            <>
              {/* Locker Hero Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-tr from-slate-50 to-blue-50/30 border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 rounded-2xl bg-white border border-slate-200 text-slate-900 font-mono font-black text-xl shadow-xs">
                    #{locker.lockerNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-black text-slate-900">
                        Size {locker.size} Locker
                      </h2>
                      <span className="px-2 py-0.5 rounded-md bg-slate-200/70 font-bold text-[10px] text-slate-800 font-mono">
                        {locker.lockerCode}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Rack {locker.rackNumber} &bull; {locker.section || 'Main Section'} &bull; {locker.floor || 'Ground Floor'}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full font-bold text-xs ${
                      locker.status === 'VACANT'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : locker.status === 'OCCUPIED'
                        ? 'bg-blue-50 text-blue-800 border border-blue-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {locker.status}
                  </span>
                  <div className="text-[10px] text-slate-400 mt-1 uppercase font-semibold">
                    Op: {locker.operationalStatus}
                  </div>
                </div>
              </div>

              {/* Status Banner */}
              {data.isAvailableForAllocation ? (
                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/70 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-900 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    Available for Tenant Allocation
                  </div>
                  <span className="text-xs text-emerald-700 font-medium">
                    Rent: ₹{locker.annualRent.toLocaleString('en-IN')}/yr
                  </span>
                </div>
              ) : locker.operationalStatus !== 'ACTIVE' ? (
                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 flex items-center gap-2 text-amber-900 text-xs font-bold">
                  <Wrench className="w-4 h-4 text-amber-600 shrink-0" />
                  Not Available for Allocation ({locker.operationalStatus})
                </div>
              ) : null}

              {/* Occupant Section (If occupied) */}
              {tenant && (
                <div className="p-4 rounded-2xl border border-slate-200/90 bg-white space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <User className="w-3.5 h-3.5" /> Current Tenant
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-700">
                      {tenant.allocationCode}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {tenant.photoUrl ? (
                      <img
                        src={tenant.photoUrl}
                        alt={tenant.fullName}
                        className="w-11 h-11 rounded-xl object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-slate-100 font-bold text-slate-700 flex items-center justify-center text-sm border border-slate-200">
                        {tenant.fullName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        {tenant.fullName}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {tenant.customerCode} &bull; {tenant.phone}
                      </div>
                    </div>
                  </div>

                  {/* Dues breakdown */}
                  {dues && (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                          Current Rental Dues
                        </span>
                        <span
                          className={`font-black font-mono text-sm ${
                            dues.outstandingAmount > 0
                              ? 'text-rose-600'
                              : 'text-emerald-700'
                          }`}
                        >
                          ₹{dues.outstandingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                          Renewal Due
                        </span>
                        <span className="font-semibold text-slate-800">
                          {tenant.nextRenewalDueDate
                            ? new Date(tenant.nextRenewalDueDate).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Master Key Security (if permitted) */}
              {locker.masterKeyReference && (
                <div className="p-3 bg-slate-900 text-white rounded-xl text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Master Key Reference:</span>
                  </div>
                  <span className="font-mono font-bold tracking-wider text-emerald-400">
                    {locker.masterKeyReference}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {locker && (
          <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between">
            {canViewLocker && (
              <button
                onClick={() => {
                  onClose();
                  navigate(`/lockers/${locker._id}`);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <Building2 className="w-3.5 h-3.5" />
                Full Locker Ledger
              </button>
            )}

            {data?.isAvailableForAllocation && canAllocate && (
              <button
                onClick={() => {
                  onClose();
                  navigate('/allocations');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Allocate This Locker
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
