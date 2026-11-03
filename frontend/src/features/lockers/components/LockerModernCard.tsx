import React,{ useState } from 'react';
import {
Upload,
ShieldCheck,
Phone,
Calendar,KeyRound,
AlertCircle,
Clock,
Plus,
ArrowRight,Wrench,
Check,
Copy
} from 'lucide-react';
import { Locker } from '../types';

interface LockerModernCardProps {
  locker: Locker;
  onView: (locker: Locker) => void;
  onKyc?: (locker: Locker) => void;
  onAllocate?: (locker: Locker) => void;
  canAllocate?: boolean;
}

export const LockerModernCard = React.memo(function LockerModernCard({
  locker,
  onView,
  onKyc,
  onAllocate,
  canAllocate = true,
}: LockerModernCardProps) {

  const [copiedPhone, setCopiedPhone] = useState(false);
  const isVacant =
    locker.isActive && locker.status === 'VACANT' && locker.operationalStatus === 'ACTIVE';
  const canPerformAllotment = isVacant && canAllocate && Boolean(onAllocate);

  // Status mapping
  const isClosed = !locker.isActive;
  const isMaintenance = locker.operationalStatus !== 'ACTIVE';
  const isOverdue = Boolean(locker.isOverdue);
  const isRenewalDue = Boolean(locker.isRenewalDue);
  const isReserved = locker.status === 'RESERVED';

  const hasKycDocuments = (locker.tenantKycDocumentCount || 0) > 0;
  const hasTenant = Boolean(locker.tenantName);

  // Status Badge Configuration
  const getStatusBadge = () => {
    if (isClosed) {
      return {
        label: 'Closed',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
        dotClass: 'bg-slate-400',
        icon: null,
      };
    }
    if (isMaintenance) {
      return {
        label: 'Maintenance',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        dotClass: 'bg-rose-500',
        icon: Wrench,
      };
    }
    if (isVacant) {
      return {
        label: 'Vacant',
        badgeClass: 'bg-emerald-700 text-white border-emerald-800 font-bold',
        dotClass: 'bg-white',
        icon: null,
      };
    }
    if (isOverdue) {
      return {
        label: 'Overdue',
        badgeClass: 'bg-rose-700 text-white border-rose-800 font-bold',
        dotClass: 'bg-white',
        icon: AlertCircle,
      };
    }
    if (isRenewalDue) {
      return {
        label: 'Due Soon',
        badgeClass: 'bg-amber-700 text-white border-amber-800 font-bold',
        dotClass: 'bg-white',
        icon: Clock,
      };
    }
    if (isReserved) {
      return {
        label: 'Reserved',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 font-bold',
        dotClass: 'bg-purple-500',
        icon: null,
      };
    }
    return {
      label: 'Occupied',
      badgeClass: 'bg-red-700 text-white border-red-800 font-bold',
      dotClass: 'bg-white',
      icon: null,
    };
  };

  const statusConfig = getStatusBadge();

  // Card container styling
  const getCardStyle = () => {
    if (isClosed || isMaintenance) return 'border-slate-400 bg-slate-100 hover:border-slate-600';
    if (isVacant) return 'border-emerald-500 bg-emerald-100 hover:border-emerald-700 hover:shadow-md';
    if (isOverdue) return 'border-amber-600 bg-amber-100 hover:border-amber-800 hover:shadow-md';
    if (isRenewalDue) return 'border-yellow-500 bg-yellow-100 hover:border-yellow-700 hover:shadow-md';
    if (isReserved) return 'border-purple-400 bg-purple-100 hover:border-purple-600 hover:shadow-md';
    return 'border-red-400 bg-red-100 hover:border-red-600 hover:shadow-md';
  };

  const handleCardClick = () => {
    if (canPerformAllotment) {
      onAllocate!(locker);
    } else {
      onView(locker);
    }
  };

  const handleCopyPhone = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  // Format Renewal Date
  const formattedRenewalDate = locker.nextRenewalDueDate
    ? new Date(locker.nextRenewalDueDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null;

  // Initials for Avatar
  const tenantInitials = locker.tenantName
    ? locker.tenantName
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : 'TN';

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Open locker ${locker.lockerNumber}`}
      onClick={handleCardClick}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) {
          event.preventDefault();
          handleCardClick();
        }
      }}
      className={`relative rounded-2xl border-2 transition-all duration-200 text-left flex flex-col justify-between p-4 sm:p-5 cursor-pointer shadow-2xs group outline-offset-2 ${getCardStyle()}`}
    >
      {/* 1. Header: Locker Title, Rack, Size Badge & Status Dot */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold font-mono tracking-tight text-slate-900 group-hover:text-emerald-800 transition-colors">
                Locker #{locker.lockerNumber}
              </h3>
              {locker.lockerCode && locker.lockerCode !== locker.lockerNumber && (
                <span className="text-[11px] font-mono text-slate-600 font-medium">
                  ({locker.lockerCode})
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
              {locker.rackNumber ? `Rack ${locker.rackNumber}` : 'Vault Safe'}
              {locker.floor ? ` • Floor ${locker.floor}` : ''}
            </p>
          </div>

          {/* Top Right: Size Badge & Status Dot */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200/90 shadow-2xs"
              title={`Locker Size ${locker.size}`}
            >
              Size {locker.size}
            </span>
          </div>
        </div>

        {/* 2. Middle Body Section */}
        {isVacant ? (
          /* VACANT STATE */
          <div className="my-3.5 space-y-2.5">
            {/* Status Pill */}
            <div className="flex items-center justify-between">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusConfig.badgeClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusConfig.dotClass}`} />
                <span>{statusConfig.label}</span>
              </span>

              {locker.annualRent > 0 && (
                <span className="text-xs font-bold font-mono text-slate-800">
                  ₹{locker.annualRent.toLocaleString('en-IN')}
                  <span className="text-[10px] font-normal text-slate-600 font-sans">/yr</span>
                </span>
              )}
            </div>

            {/* Vacant Info Box */}
            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center shrink-0">
                <KeyRound className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  Available for Lease
                </p>
                <p className="text-[11px] text-slate-600 truncate">
                  {locker.securityDeposit > 0
                    ? `₹${locker.securityDeposit.toLocaleString('en-IN')} refundable deposit`
                    : 'Standard bank vault allotment'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* OCCUPIED / DUE / OVERDUE STATE */
          <div className="my-3.5 space-y-2.5">
            {/* Tenant Info */}
            {hasTenant && (
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs group-hover:border-emerald-300 transition-colors">
                  {tenantInitials}
                </div>

                <div className="min-w-0 flex-1">
                  <strong className="block text-sm font-bold text-slate-900 truncate group-hover:text-emerald-900 transition-colors">
                    {locker.tenantName}
                  </strong>

                  {locker.tenantPhone ? (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-0.5">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="font-mono text-[11.5px] truncate">
                        {locker.tenantPhone}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleCopyPhone(e, locker.tenantPhone!)}
                        className="text-slate-500 hover:text-slate-700 p-0.5 cursor-pointer transition-colors"
                        title="Copy phone number"
                      >
                        {copiedPhone ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">No phone recorded</span>
                  )}
                </div>
              </div>
            )}

            {/* Status & Renewal Date Strip */}
            <div className="flex items-center justify-between gap-1.5 pt-1 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${statusConfig.badgeClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusConfig.dotClass}`} />
                <span>{statusConfig.label}</span>
              </span>

              {formattedRenewalDate && (
                <div
                  className={`flex items-center gap-1 text-[11.5px] font-mono font-medium ${
                    isOverdue
                      ? 'text-rose-700 font-bold'
                      : isRenewalDue
                      ? 'text-amber-800 font-bold'
                      : 'text-slate-600'
                  }`}
                  title="Next Renewal Due Date"
                >
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>{formattedRenewalDate}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Bottom Action Row */}
      <div className="pt-2.5 border-t border-slate-400/30 flex items-center justify-between gap-2">
        {isVacant ? (
          /* Vacant CTA */
          canPerformAllotment ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAllocate!(locker);
              }}
              className="w-full py-2 px-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Allot Locker
            </button>
          ) : (
            <span className="text-xs text-slate-500 font-medium italic py-1">
              Vacant • Ready for Allotment
            </span>
          )
        ) : (
          /* Occupied Actions: KYC Button + Quick Details Arrow */
          <>
            {/* KYC Button */}
            {hasTenant && onKyc && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onKyc(locker);
                }}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs border ${
                  hasKycDocuments
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-800'
                    : 'bg-amber-800 hover:bg-amber-900 text-white border-amber-900'
                }`}
                title={hasKycDocuments ? 'View uploaded KYC documents' : 'Upload KYC documents'}
              >
                {hasKycDocuments ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-white" />
                    <span>View KYC</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5 text-white" />
                    <span>Upload KYC</span>
                  </>
                )}
              </button>
            )}

            {/* Open Dossier Hint */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onView(locker);
              }}
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Open Locker Details Dossier"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </article>
  );
});
