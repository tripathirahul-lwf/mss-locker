import React from 'react';
import { KeyRound, ChevronRight, Wrench } from 'lucide-react';
import { Locker } from '../types';
import { LOCKER_SIZES } from '../constants';

interface LockerModernCardProps {
  locker: Locker;
  onView: (locker: Locker) => void;
  onAllocate?: (locker: Locker) => void;
  canAllocate?: boolean;
}

export const LockerModernCard: React.FC<LockerModernCardProps> = ({
  locker,
  onView,
  onAllocate,
  canAllocate = true,
}) => {
  // Determine display status and styling
  const isClosed = !locker.isActive || locker.operationalStatus === 'DECOMMISSIONED';
  const isOccupied = !isClosed && locker.status === 'OCCUPIED';
  const isReserved = !isClosed && locker.status === 'RESERVED';
  const isMaintenance =
    !isClosed && (locker.operationalStatus === 'MAINTENANCE' || locker.operationalStatus === 'DAMAGED' || locker.status === 'BLOCKED');
  const isAvailable = !isClosed && !isOccupied && !isReserved && !isMaintenance;

  const sizeDef = LOCKER_SIZES.find((s) => s.code === locker.size);

  let statusConfig = {
    pill: 'bg-rose-50 text-rose-800 border-rose-200/90',
    dot: 'bg-rose-600',
    label: 'Closed',
    btnBg: 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80',
    btnLabel: 'View Archived Unit',
  };

  if (isOccupied) {
    statusConfig = {
      pill: 'bg-sky-50 text-sky-800 border-sky-200/90',
      dot: 'bg-sky-600',
      label: 'Occupied',
      btnBg: 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/80',
      btnLabel: 'View Locker Details',
    };
  } else if (isAvailable) {
    statusConfig = {
      pill: 'bg-emerald-50 text-emerald-800 border-emerald-200/90',
      dot: 'bg-emerald-600',
      label: 'Available',
      btnBg: 'bg-emerald-800 hover:bg-emerald-900 text-white shadow-2xs',
      btnLabel: '+ Allocate Locker',
    };
  } else if (isReserved) {
    statusConfig = {
      pill: 'bg-amber-50 text-amber-800 border-amber-200/90',
      dot: 'bg-amber-600',
      label: 'Reserved',
      btnBg: 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80',
      btnLabel: 'View Reservation',
    };
  } else if (isMaintenance) {
    statusConfig = {
      pill: 'bg-amber-50 text-amber-800 border-amber-200/90',
      dot: 'bg-amber-600',
      label: 'Maintenance',
      btnBg: 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/80',
      btnLabel: 'Maintenance Details',
    };
  }

  // Clean size label formatting
  const sizeFriendlyName = sizeDef?.label
    ? sizeDef.label.replace(/^Size\s+[A-Z0-9]+\s*/i, '').replace(/[()]/g, '').trim()
    : '';

  return (
    <div
      onClick={() => onView(locker)}
      className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 transition-all duration-200 shadow-xs hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5 flex flex-col justify-between cursor-pointer select-none"
    >
      <div>
        {/* Top Row: Locker Number & Status Badge */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-semibold text-slate-400">#</span>
              <h3 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {locker.lockerNumber}
              </h3>
            </div>
            <p className="text-xs font-semibold text-slate-700 mt-1 flex items-center">
              <span className="text-slate-400 font-medium mr-0.5">₹</span>
              <span className="tabular-nums font-bold text-slate-900">
                {(locker.annualRent || 0).toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] font-normal text-slate-400 ml-1">/ year</span>
            </p>
          </div>

          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusConfig.pill}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${statusConfig.dot}`} />
            {statusConfig.label}
          </span>
        </div>

        {/* Middle Specs: Physical Rack & Size with Dimensions */}
        <div className="mt-3.5 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100/90">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block">
              Rack Location
            </span>
            <span className="font-semibold text-slate-800 truncate block mt-0.5">
              {locker.rackNumber || 'RACK-01'}
            </span>
            <span className="text-[11px] text-slate-500 block truncate mt-0.5">
              {locker.floor || locker.section || 'Main Vault'}
            </span>
          </div>

          <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100/90">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block">
              Compartment Size
            </span>
            <span className="font-semibold text-slate-800 truncate block mt-0.5">
              Size {locker.size} {sizeFriendlyName ? `• ${sizeFriendlyName}` : ''}
            </span>
            <span className="text-[11px] text-slate-500 block truncate mt-0.5 font-mono">
              {sizeDef?.dimensions ? sizeDef.dimensions.replace(/ mm$/, '') : 'Standard'}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Action Button */}
      <div className="mt-4 pt-1">
        {isAvailable && onAllocate && canAllocate ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAllocate(locker);
            }}
            className={`w-full py-2.5 px-3.5 rounded-xl font-semibold text-xs tracking-wide transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs active:scale-[0.98] ${statusConfig.btnBg}`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>+ Allocate Locker</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onView(locker);
            }}
            className={`w-full py-2.5 px-3.5 rounded-xl font-semibold text-xs tracking-wide transition-all cursor-pointer flex items-center justify-center gap-1.5 group-hover:bg-slate-200/90 active:scale-[0.98] ${statusConfig.btnBg}`}
          >
            {isMaintenance ? <Wrench className="h-3.5 w-3.5" /> : null}
            <span>{statusConfig.btnLabel}</span>
            {!isMaintenance && <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />}
          </button>
        )}
      </div>
    </div>
  );
};
