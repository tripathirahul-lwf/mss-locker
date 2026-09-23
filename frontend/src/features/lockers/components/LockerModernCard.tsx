import React from 'react';
import { ChevronRight, Wrench, Clock, User, AlertCircle } from 'lucide-react';
import { Locker } from '../types';
import { LOCKER_SIZES } from '../constants';

interface LockerModernCardProps {
  locker: Locker;
  onView: (locker: Locker) => void;
  onAllocate?: (locker: Locker) => void;
  canAllocate?: boolean;
}

export const LockerModernCard: React.FC<LockerModernCardProps> = React.memo(({
  locker,
  onView,
  onAllocate,
  canAllocate = true,
}) => {
  // Determine display status and styling
  const isClosed = !locker.isActive || locker.operationalStatus === 'DECOMMISSIONED';
  const isMaintenance =
    !isClosed &&
    (locker.operationalStatus === 'MAINTENANCE' ||
      locker.operationalStatus === 'DAMAGED' ||
      locker.status === 'BLOCKED');
  const isReserved = !isClosed && !isMaintenance && locker.status === 'RESERVED';
  const isRenewalDue = !isClosed && !isMaintenance && Boolean(locker.isRenewalDue);
  const isOccupied = !isClosed && !isMaintenance && !isRenewalDue && locker.status === 'OCCUPIED';
  const isAvailable = !isClosed && !isMaintenance && !isReserved && !isOccupied && !isRenewalDue && locker.status === 'VACANT';

  const sizeDef = LOCKER_SIZES.find((s) => s.code === locker.size);

  // Status configuration:
  // 1. EMPTY / VACANT -> GREEN
  // 2. FULL / OCCUPIED -> RED
  // 3. RENEWAL DUE -> YELLOW
  let statusConfig = {
    cardBg: 'bg-white border-slate-200/90 hover:border-slate-300',
    pill: 'bg-slate-100 text-slate-700 border-slate-300',
    dot: 'bg-slate-400',
    label: 'Closed',
    btnBg: 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80',
    btnLabel: 'View Archived Unit',
    glow: '',
  };

  if (isRenewalDue) {
    // YELLOW: Renewal Due
    statusConfig = {
      cardBg: 'bg-gradient-to-b from-amber-50/80 via-amber-50/20 to-white border-amber-300 hover:border-amber-400',
      pill: 'bg-amber-100 text-amber-950 border-amber-300 font-bold',
      dot: 'bg-amber-600 animate-ping',
      label: 'Renewal Due',
      btnBg: 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-2xs border border-amber-500',
      btnLabel: 'Renew Locker',
      glow: 'shadow-[0_2px_12px_rgba(245,158,11,0.1)]',
    };
  } else if (isOccupied) {
    // RED: Full / Occupied
    statusConfig = {
      cardBg: 'bg-gradient-to-b from-rose-50/60 via-rose-50/20 to-white border-rose-200 hover:border-rose-300',
      pill: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
      dot: 'bg-rose-600',
      label: 'Occupied',
      btnBg: 'bg-rose-600 hover:bg-rose-700 text-white shadow-2xs font-semibold',
      btnLabel: 'View Details',
      glow: 'shadow-[0_2px_10px_rgba(244,63,94,0.06)]',
    };
  } else if (isAvailable) {
    // GREEN: Empty / Available
    statusConfig = {
      cardBg: 'bg-gradient-to-b from-emerald-50/50 via-emerald-50/15 to-white border-emerald-200 hover:border-emerald-300',
      pill: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold',
      dot: 'bg-emerald-600 animate-pulse',
      label: 'Available',
      btnBg: 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs font-semibold',
      btnLabel: '+ Allocate Locker',
      glow: 'shadow-[0_2px_10px_rgba(16,185,129,0.06)]',
    };
  } else if (isReserved) {
    statusConfig = {
      cardBg: 'bg-amber-50/30 border-amber-200 hover:border-amber-300',
      pill: 'bg-amber-100 text-amber-900 border-amber-200',
      dot: 'bg-amber-600',
      label: 'Reserved',
      btnBg: 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80',
      btnLabel: 'View Reservation',
      glow: '',
    };
  } else if (isMaintenance) {
    statusConfig = {
      cardBg: 'bg-slate-50 border-slate-200 hover:border-slate-300',
      pill: 'bg-slate-200 text-slate-800 border-slate-300',
      dot: 'bg-slate-500',
      label: 'Maintenance',
      btnBg: 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/80',
      btnLabel: 'Maintenance Details',
      glow: '',
    };
  }

  return (
    <div
      onClick={() => onView(locker)}
      className={`group relative overflow-hidden rounded-2xl border p-4 sm:p-4.5 transition-all duration-200 shadow-xs hover:-translate-y-0.5 flex flex-col justify-between cursor-pointer select-none ${statusConfig.cardBg} ${statusConfig.glow}`}
    >
      <div>
        {/* Header: Locker Number, Size & Status */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold tracking-tight text-slate-900 font-mono">
              #{locker.lockerNumber}
            </h3>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100/90 text-slate-700 border border-slate-200">
              Size {locker.size}
            </span>
          </div>

          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border shrink-0 ${statusConfig.pill}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${statusConfig.dot}`} />
            {statusConfig.label}
          </span>
        </div>

        {/* Required Info (Clean, Minimal, No redundant nested boxes) */}
        <div className="mt-3.5 pt-2.5 border-t border-slate-200/60 space-y-1.5 text-xs">
          {/* Row 1: Rack & Annual Rent */}
          <div className="flex items-center justify-between text-slate-600">
            <span className="font-medium text-slate-600">
              {locker.rackNumber || 'Rack N/A'}
            </span>
            <span className="font-semibold text-slate-900 tabular-nums">
              ₹{(locker.annualRent || 0).toLocaleString('en-IN')}<span className="text-[11px] font-normal text-slate-500">/yr</span>
            </span>
          </div>

          {/* Row 2: Tenant Name or Available Specs */}
          {locker.tenantName ? (
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-800 truncate" title={locker.tenantName}>
                {locker.tenantName}
              </span>
              {isRenewalDue ? (
                <span className="text-[11px] font-bold text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded shrink-0">
                  {locker.renewalBalanceAmount ? `₹${locker.renewalBalanceAmount.toLocaleString('en-IN')} Due` : 'Renewal Due'}
                </span>
              ) : (
                <span className="text-[11px] font-medium text-emerald-700 shrink-0">
                  Active
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Dimensions</span>
              <span className="font-mono text-slate-600">
                {sizeDef?.dimensions ? sizeDef.dimensions.replace(/ mm$/, '') : 'Standard'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Button */}
      <div className="mt-3.5 pt-1">
        {isAvailable && onAllocate && canAllocate ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAllocate(locker);
            }}
            className={`w-full py-2 px-3 rounded-xl font-semibold text-xs tracking-wide transition-all cursor-pointer flex items-center justify-center shadow-2xs active:scale-[0.98] ${statusConfig.btnBg}`}
          >
            <span>+ Allocate Locker</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onView(locker);
            }}
            className={`w-full py-2 px-3 rounded-xl font-semibold text-xs tracking-wide transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98] ${statusConfig.btnBg}`}
          >
            {isMaintenance && <Wrench className="h-3.5 w-3.5" />}
            {isRenewalDue && <Clock className="h-3.5 w-3.5 text-slate-950" />}
            <span>{statusConfig.btnLabel}</span>
            <ChevronRight className="h-3.5 w-3.5 opacity-70 group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}
      </div>
    </div>
  );
});

