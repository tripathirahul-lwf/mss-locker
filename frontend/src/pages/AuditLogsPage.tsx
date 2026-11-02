import { lockBodyScroll } from '../utils/bodyScrollLock';
import React,{ useState,useEffect,useMemo,useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
ShieldCheck,
Search,
RefreshCw,
AlertTriangle,
CheckCircle2,
Lock,
Download,
X,
Activity,
Layers,
Users,
CreditCard,
Settings,Eye,Laptop,
Calendar,
Filter,
List,
GitCommit,
Printer,
FileCode,
Radio,
Clock,
ExternalLink,
ChevronDown,
ChevronUp,
KeyRound,
Info,UserCheck,
ArrowLeft,
ArrowRight
} from 'lucide-react';
import { auditService,AuditLogItem } from '../services/auditService';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useDebounce } from '../hooks/useDebounce';

type ModuleCategory = 'ALL' | 'AUTH' | 'LOCKER' | 'CUSTOMER' | 'PAYMENT' | 'SYSTEM';
type DateRangeOption = 'ALL' | 'TODAY' | '24H' | '7D' | '30D';
type SeverityFilter = 'ALL' | 'SUCCESS' | 'INFO' | 'WARNING' | 'DANGER';
type ViewMode = 'TABLE' | 'TIMELINE';

const MODULE_TABS: { id: ModuleCategory; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'ALL', label: 'All Events', icon: ShieldCheck },
  { id: 'AUTH', label: 'Auth & Sessions', icon: Lock },
  { id: 'LOCKER', label: 'Lockers & Vault', icon: Layers },
  { id: 'CUSTOMER', label: 'Customers & KYC', icon: Users },
  { id: 'PAYMENT', label: 'Billing & Payments', icon: CreditCard },
  { id: 'SYSTEM', label: 'System & Config', icon: Settings },
];

function getActionSeverity(action: string): {
  variant: 'success' | 'destructive' | 'warning' | 'info';
  bg: string;
  text: string;
  border: string;
  badgeLabel: string;
} {
  const upper = (action || '').toUpperCase();
  if (upper.includes('FAILED') || upper.includes('REJECTED') || upper.includes('DEACTIVATED') || upper.includes('CANCELLED') || upper.includes('DENIED')) {
    return {
      variant: 'destructive',
      bg: 'bg-rose-50',
      text: 'text-rose-800',
      border: 'border-rose-200',
      badgeLabel: 'Rejected / Cancelled / Failed',
    };
  }
  if (upper.includes('PASSWORD') || upper.includes('OVERRIDDEN') || upper.includes('REMOVED')) {
    return {
      variant: 'warning',
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      badgeLabel: 'Security Modification',
    };
  }
  if (upper.includes('CREATED') || upper.includes('UPDATED') || upper.includes('REVISED') || upper.includes('GENERATED')) {
    return {
      variant: 'info',
      bg: 'bg-sky-50',
      text: 'text-sky-800',
      border: 'border-sky-200',
      badgeLabel: 'Data Update',
    };
  }
  return {
    variant: 'success',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    badgeLabel: 'Recorded Event',
  };
}

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (!Number.isFinite(diffInSeconds)) return 'Unknown time';
  if (diffInSeconds < 0) return 'Future timestamp';
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;
  return date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
}

function formatIpAddress(ip?: string): string {
  if (!ip) return 'Not recorded';
  const cleaned = ip.replace(/^::ffff:/, '');
  if (cleaned === '127.0.0.1' || cleaned === '::1') return `${cleaned} (Loopback)`;
  const octets = cleaned.split('.').map(Number);
  if (octets.length === 4 && (octets[0] === 10 || octets[0] === 192 && octets[1] === 168 || octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)) return `${cleaned} (Private network)`;
  return cleaned;
}

function parseUserAgent(ua?: string) {
  if (!ua) return { os: 'Not recorded', browser: 'Not recorded', device: 'Not recorded' };
  let os = 'Unknown platform';
  if (ua.includes('Windows NT 10.0') || ua.includes('Windows')) os = 'Windows PC';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'Apple iPad / iPhone';
  else if (ua.includes('Mac OS X')) os = 'Apple Mac';
  else if (ua.includes('Android')) os = 'Android Tablet / Phone';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'Apple iPad / iPhone';
  else if (ua.includes('Linux')) os = 'Linux Workstation';

  let browser = 'Web Browser';
  if (ua.includes('Edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome/')) browser = 'Google Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Apple Safari';
  else if (ua.includes('Firefox/')) browser = 'Mozilla Firefox';

  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  const device = isMobile ? 'Mobile Terminal' : 'Desktop Counter Computer';

  return { os, browser, device };
}

/**
 * Translates raw database event codes into simple, plain-English explanations that anyone can understand immediately.
 */
function getHumanFriendlyEventInfo(log: AuditLogItem): {
  friendlyTitle: string;
  categoryLabel: string;
  whatHappened: string;
  dataImpact: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
} {
  const action = (log.action || '').toUpperCase();
  const operator = log.actorUserId?.name || log.performedBy?.name || log.actorUsername || 'Staff Member';

  if (action === 'LOGIN_SUCCESS') {
    return {
      friendlyTitle: `${operator} signed in successfully`,
      categoryLabel: 'Staff Login & Counter Session',
      whatHappened: `The counter staff member entered their valid password and opened an active secure session to operate the locker counter.`,
      dataImpact: 'Security Check Passed: No customer assets, locker records, or ledger payments were modified during this login.',
      icon: CheckCircle2,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-800',
    };
  }

  if (action === 'LOGIN_FAILED') {
    return {
      friendlyTitle: `Failed sign-in attempt on account '${log.actorUsername || 'staff'}'`,
      categoryLabel: 'Security & Access Alert',
      whatHappened: `A sign-in attempt was rejected. Check the recorded details for the reason.`,
      dataImpact: 'This event records a failed sign-in attempt.',
      icon: AlertTriangle,
      iconBg: 'bg-rose-100',
      iconColor: 'text-rose-800',
    };
  }

  if (action === 'LOGOUT') {
    return {
      friendlyTitle: `${operator} signed out of the system`,
      categoryLabel: 'Staff Session Ended',
      whatHappened: `The operator safely closed their session and logged out of the application.`,
      dataImpact: 'A sign-out event was recorded for this session.',
      icon: Lock,
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-800',
    };
  }

  if (action.includes('LOCKER_CREATED')) {
    return {
      friendlyTitle: `New locker added to vault register`,
      categoryLabel: 'Locker Inventory Management',
      whatHappened: `${operator} registered a new safe-deposit locker into the vault master inventory.`,
      dataImpact: 'Inventory Updated: The new locker is now ready for customer allocation.',
      icon: Layers,
      iconBg: 'bg-sky-100',
      iconColor: 'text-sky-800',
    };
  }

  if (action.includes('LOCKER_UPDATED') || action.includes('TARIFF_REVISED')) {
    return {
      friendlyTitle: `Locker details or tariff revised`,
      categoryLabel: 'Locker Inventory Management',
      whatHappened: `${operator} updated locker dimensions, rent tariff, key details, or operational status.`,
      dataImpact: 'Record Modified: Changes are now active for future billing and customer agreements.',
      icon: Layers,
      iconBg: 'bg-sky-100',
      iconColor: 'text-sky-800',
    };
  }

  if (action.includes('CUSTOMER_CREATED')) {
    return {
      friendlyTitle: `New customer profile registered`,
      categoryLabel: 'Customer Registration & Onboarding',
      whatHappened: `${operator} created a new customer account in the system with contact details.`,
      dataImpact: 'Profile Created: Customer is now eligible for KYC submission and locker agreement.',
      icon: Users,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-800',
    };
  }

  if (action.includes('CUSTOMER_UPDATED')) {
    return {
      friendlyTitle: `Customer profile updated`,
      categoryLabel: 'Customer Record Management',
      whatHappened: `${operator} edited customer address, phone number, email, or nominee information.`,
      dataImpact: 'Record Updated: Customer information in the master register has been updated.',
      icon: Users,
      iconBg: 'bg-sky-100',
      iconColor: 'text-sky-800',
    };
  }

  if (action.includes('KYC_VERIFIED')) {
    return {
      friendlyTitle: `KYC document verified`,
      categoryLabel: 'Regulatory Compliance & KYC',
      whatHappened: `${operator} reviewed and verified the customer's identity and address proof documents.`,
      dataImpact: 'Document verification recorded. Overall customer KYC may still require other documents.',
      icon: UserCheck,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-800',
    };
  }

  if (action.includes('KYC_REJECTED')) {
    return {
      friendlyTitle: `Customer KYC documents rejected`,
      categoryLabel: 'Compliance & KYC Alert',
      whatHappened: `${operator} flagged the customer's uploaded identity proof as incomplete or invalid.`,
      dataImpact: 'Action Required: Customer needs to submit valid proof before locker custody.',
      icon: AlertTriangle,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-800',
    };
  }

  if (action.includes('ALLOCATION_CREATED') || action.includes('LOCKER_RESERVED')) {
    return {
      friendlyTitle: action === 'LOCKER_RESERVED' ? 'Locker reserved for customer' : 'Locker allocated to customer',
      categoryLabel: 'Locker Allocation & Tenancy',
      whatHappened: `${operator} recorded a locker agreement. The recorded action distinguishes reservation from active allotment.`,
      dataImpact: action === 'LOCKER_RESERVED' ? 'Locker reserved; this event does not confirm an active tenancy or rent payment.' : 'Allotment recorded; payment and KYC are tracked separately.',
      icon: KeyRound,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-800',
    };
  }

  if (action.includes('PAYMENT_RECORDED') || action.includes('DEPOSIT_RECEIVED')) {
    return {
      friendlyTitle: `Payment received & receipt voucher created`,
      categoryLabel: 'Payments & Billing Collection',
      whatHappened: `${operator} collected payment (rent, caution deposit, or renewal) from the customer.`,
      dataImpact: 'Ledger Credited: Payment voucher recorded in accounting books with official receipt.',
      icon: CreditCard,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-800',
    };
  }

  if (action.includes('REFUND_APPROVED') || action.includes('REFUND_PAID')) {
    return {
      friendlyTitle: action === 'REFUND_APPROVED' ? 'Refund request approved' : 'Refund payout recorded',
      categoryLabel: 'Settlement & Deposit Refunds',
      whatHappened: action === 'REFUND_APPROVED' ? `${operator} approved the refund request.` : `${operator} recorded the refund disbursement.`,
      dataImpact: action === 'REFUND_APPROVED' ? 'Approval reserves the refund. No payout is confirmed by this event.' : 'Refund payment recorded. Check the ledger for any remaining balance.',
      icon: CreditCard,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-800',
    };
  }

  if (action.includes('PASSWORD_CHANGED') || action.includes('PASSWORD_RESET')) {
    return {
      friendlyTitle: `Password credentials updated`,
      categoryLabel: 'Security & Access Credentials',
      whatHappened: `${operator} updated or reset account password credentials.`,
      dataImpact: 'Security Updated: Previous passwords invalidated; new credentials active.',
      icon: KeyRound,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-800',
    };
  }

  return {
    friendlyTitle: log.description || `System action: ${action}`,
    categoryLabel: log.entityType || log.module || 'System Event',
    whatHappened: log.description || `The operator performed action '${action}' in the system.`,
    dataImpact: 'Recorded audit event. No additional data change is inferred.',
    icon: ShieldCheck,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-800',
  };
}

interface AuditDetailModalProps {
  log: AuditLogItem;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

function AuditDetailModal({ log, onClose, onPrev, onNext, hasPrev, hasNext }: AuditDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [copyError, setCopyError] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  const severity = getActionSeverity(log.action);
  const clientInfo = parseUserAgent(log.userAgent);
  const humanInfo = getHumanFriendlyEventInfo(log);
  const IconComponent = humanInfo.icon;
  const callbacks = useRef({ onClose, onPrev, onNext, hasPrev, hasNext });
  callbacks.current = { onClose, onPrev, onNext, hasPrev, hasNext };

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => dialogRef.current?.focus());

    const releaseScroll = lockBodyScroll();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') || []);
        const first = controls[0], last = controls[controls.length - 1];
        if (first && e.shiftKey && (document.activeElement === dialogRef.current || document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
        else if (last && !e.shiftKey && (document.activeElement === dialogRef.current || document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
      }
      if (e.key === 'Escape') { e.preventDefault(); callbacks.current.onClose(); }
      if (e.key === 'ArrowLeft' && callbacks.current.hasPrev && callbacks.current.onPrev) callbacks.current.onPrev();
      if (e.key === 'ArrowRight' && callbacks.current.hasNext && callbacks.current.onNext) callbacks.current.onNext();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      if (previousFocus?.isConnected) previousFocus.focus();
      releaseScroll();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(log._id).then(() => setCopiedId(true)).catch(() => setCopyError('Could not copy the event ID.'));
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify({ ...(log.details || {}), ...(log.metadata || {}) }, null, 2)).then(() => setCopiedJson(true)).catch(() => setCopyError('Could not copy the event data.'));
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const operatorName = log.actorUserId?.name || log.performedBy?.name || log.actorUsername || 'Unknown operator';
  const operatorUsername = log.actorUserId?.username || log.performedBy?.username || log.actorUsername || 'Not recorded';
  const metadataEntries = Object.entries({ ...(log.details || {}), ...(log.metadata || {}) });

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in-0 duration-150"
      onClick={onClose}
    >
      <div
        ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Audit event details" data-audit-print="true"
        className="relative w-full max-w-2xl max-h-[92dvh] overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl flex flex-col animate-in zoom-in-95 duration-150 text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {copyError && <p role="alert" className="bg-red-50 p-3 text-sm text-red-700">{copyError}</p>}
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${humanInfo.iconBg} ${humanInfo.iconColor} border border-slate-200/80`}>
              <IconComponent className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Event Activity Details
                </h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${severity.bg} ${severity.text} ${severity.border}`}>
                  {severity.badgeLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal">
                {humanInfo.categoryLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {hasPrev !== undefined && (
              <div className="hidden sm:flex items-center gap-1 mr-2 border-r border-slate-200 pr-2">
                <button
                  type="button"
                  onClick={onPrev}
                  disabled={!hasPrev}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  title="Previous Event (Left Arrow)"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!hasNext}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  title="Next Event (Right Arrow)"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {/* Main Hero Summary Card */}
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                What Happened
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {formatRelativeTime(log.createdAt)} ({new Date(log.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })})
              </span>
            </div>
            <h4 className="text-base font-bold text-slate-900 leading-snug">
              {humanInfo.friendlyTitle}
            </h4>
            <p className="text-xs text-slate-700 leading-relaxed font-normal">
              {humanInfo.whatHappened}
            </p>
          </div>

          {/* 3 Clear Info Cards: Who, Where, Security */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Card 1: Person / Operator */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-slate-400" />
                Who Did This?
              </span>
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-emerald-800 text-white font-bold grid place-items-center text-xs">
                  {operatorName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 leading-tight">
                    {operatorName}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Staff ID: @{operatorUsername}
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2: Computer & Location */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Laptop className="h-3.5 w-3.5 text-slate-400" />
                From Which Computer?
              </span>
              <p className="text-xs font-bold text-slate-800">
                {clientInfo.os} &bull; {clientInfo.browser}
              </p>
              <p className="text-[11px] text-slate-500 font-mono">
                {formatIpAddress(log.ipAddress)}
              </p>
            </div>
          </div>

          {/* Impact on Data Card */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Info className="h-3.5 w-3.5 text-slate-400" />
              Effect on Records &amp; Assets
            </span>
            <p className="text-xs font-medium text-slate-800">
              {humanInfo.dataImpact}
            </p>
          </div>

          {/* Structured Values (If any fields were changed) */}
          {metadataEntries.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                Recorded Event Data ({metadataEntries.length})
              </span>
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
                {metadataEntries.map(([key, val]) => (
                  <div key={key} className="p-2.5 px-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 hover:bg-slate-50/70 transition-colors">
                    <span className="text-xs font-bold text-slate-700 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs font-medium text-slate-900 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 max-w-md truncate">
                      {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Technical IT & Raw Database Details (Collapsible Drawer) */}
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50/50">
            <button
              type="button"
              onClick={() => setShowTechnical((prev) => !prev)}
              className="w-full flex items-center justify-between p-3 text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 text-xs font-semibold cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <FileCode className="h-3.5 w-3.5 text-slate-500" />
                <span>Technical &amp; IT System Data (Developer View)</span>
              </span>
              {showTechnical ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showTechnical && (
              <div className="p-4 border-t border-slate-200 space-y-3 bg-white text-xs">
                <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200 font-mono text-[11px]">
                  <span className="text-slate-500">Database Event ID:</span>
                  <div className="flex items-center gap-2">
                    <strong className="text-slate-800">{log._id}</strong>
                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="text-emerald-800 hover:text-emerald-950 cursor-pointer text-[10.5px] font-bold"
                    >
                      {copiedId ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200 font-mono text-[11px]">
                  <span className="text-slate-500">Target Resource / Entity:</span>
                  <span className="text-slate-800 font-bold">{log.entityType || log.module || 'SYSTEM'} {log.entityId ? `[${log.entityId}]` : ''}</span>
                </div>

                {log.userAgent && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Raw User Agent:</span>
                    <div className="p-2 rounded bg-slate-50 border border-slate-200 font-mono text-[10px] text-slate-600 break-all">
                      {log.userAgent}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Raw JSON Payload:</span>
                    <button
                      type="button"
                      onClick={handleCopyJson}
                      className="text-emerald-800 hover:text-emerald-950 font-bold text-[10.5px] cursor-pointer"
                    >
                      {copiedJson ? 'Copied JSON' : 'Copy JSON'}
                    </button>
                  </div>
                  <pre className="max-h-40 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[10.5px] text-emerald-400">
                    {metadataEntries.length > 0
                      ? JSON.stringify(Object.fromEntries(metadataEntries), null, 2)
                      : JSON.stringify({ message: 'No extended mutation payload recorded for this action.' }, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-100 bg-slate-50/90 px-6 py-3.5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5 text-slate-600" />
            <span>Print Dossier</span>
          </button>

          <Button
            onClick={onClose}
            variant="default"
            size="sm"
            className="h-9 px-5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [activeTab, setActiveTab] = useState<ModuleCategory>('ALL');
  const [dateRange, setDateRange] = useState<DateRangeOption>('ALL');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL');
  const [viewMode, setViewMode] = useState<ViewMode>('TABLE');
  const [liveStream, setLiveStream] = useState<boolean>(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [actionFilter, setActionFilter] = useState<string | undefined>();
  const [mutationsOnly, setMutationsOnly] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!exportMenuOpen) return;
    const outside = (event: PointerEvent) => { if (!exportMenuRef.current?.contains(event.target as Node)) setExportMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setExportMenuOpen(false); };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [exportMenuOpen]);
  const exportRef = useRef(false);

  const filters = { search: debouncedSearch || undefined, category: activeTab, severity: severityFilter, period: dateRange, action: actionFilter, mutationsOnly: mutationsOnly || undefined };
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['audit-logs', page, limit, debouncedSearch, activeTab, severityFilter, dateRange, actionFilter, mutationsOnly],
    queryFn: ({ signal }) => auditService.list({ page, limit, ...filters }, signal),
    staleTime: 10_000,
    refetchInterval: liveStream ? 10_000 : false,
  });
  const logs = data?.logs || [];
  const pagination = data?.pagination || { page: 1, limit, total: 0, totalPages: 1 };
  useEffect(() => { if (data && page > data.pagination.totalPages) setPage(data.pagination.totalPages); }, [data, page]);
  useEffect(() => { setPage(1); setSelectedLog(null); }, [debouncedSearch, activeTab, severityFilter, dateRange, actionFilter, mutationsOnly]);

  // Selected Log Index for modal prev/next navigation
  const selectedLogIndex = useMemo(() => {
    if (!selectedLog) return -1;
    return logs.findIndex((l) => l._id === selectedLog._id);
  }, [logs, selectedLog]);

  // Every metric covers the complete filtered dataset, never just this page.
  const totalEvents = data?.summary.total ?? 0;
  const successfulLogins = data?.summary.successfulLogins ?? 0;
  const failedAttempts = data?.summary.failedAttempts ?? 0;
  const mutations = data?.summary.mutations ?? 0;
  const handleExport = async (format: 'csv' | 'json') => {
    if (exportRef.current || isFetching || isError || search.trim() !== debouncedSearch) return;
    exportRef.current = true; setExporting(true); setExportError(''); setExportMenuOpen(false);
    try { await auditService.export(filters, format); }
    catch (error: any) { setExportError(error.message || 'Could not export audit events. Please retry.'); }
    finally { exportRef.current = false; setExporting(false); }
  };
  const handleExportCsv = () => { void handleExport('csv'); };
  const handleExportJson = () => { void handleExport('json'); };

  return (
    <div className="space-y-5 font-sans" data-audit-print={selectedLog ? undefined : 'true'}>
      {isError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Could not load audit events. <button type="button" onClick={() => refetch()} className="font-semibold underline">Retry audit logs</button></div>}
      {exportError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{exportError}</p>}
      {mutationsOnly && <button type="button" className="text-sm font-semibold text-emerald-800" onClick={() => setMutationsOnly(false)}>Clear vault and billing changes filter</button>}
      {actionFilter && <button type="button" className="text-sm font-semibold text-emerald-800" onClick={() => setActionFilter(undefined)}>Clear action filter: {actionFilter}</button>}
      {/* Top Header Card */}
      <section className="relative rounded-2xl border border-slate-200/90 bg-white p-5 lg:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-emerald-800" aria-hidden="true" />
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
              Regulatory Compliance
            </span>
            <span className="text-[11px] text-slate-400 font-normal">Dual-Custody Audit Trail</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
            Security &amp; Audit Logs
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-normal">
            Recorded operator activity, sign-in attempts and changes to locker records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Live Stream Auto-Refresh Toggle */}
          <button
            type="button"
            aria-pressed={liveStream}
            onClick={() => setLiveStream((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-2xs ${
              liveStream
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300 ring-2 ring-emerald-500/20'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Radio className={`h-3.5 w-3.5 ${liveStream ? 'animate-pulse text-emerald-600' : 'text-slate-400'}`} />
            <span>{liveStream ? 'Auto-refresh On (10s)' : 'Auto-refresh Off'}</span>
          </button>

          {/* Export Dropdown */}
          <div ref={exportMenuRef} className="relative">
            <Button
              aria-expanded={exportMenuOpen} aria-controls="audit-export-options"
              onClick={() => setExportMenuOpen((prev) => !prev)}
              disabled={exporting || isFetching || isError || search.trim() !== debouncedSearch || !pagination.total}
              variant="outline"
              className="h-10 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-xs gap-1.5 px-3.5 shadow-2xs cursor-pointer"
            >
              <Download className="h-4 w-4 text-emerald-800" />
              <span>{exporting ? 'Exporting...' : 'Export filtered events'}</span>
            </Button>

            {exportMenuOpen && (
              <div id="audit-export-options" className="absolute right-0 mt-1.5 w-48 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg z-20 animate-in fade-in-0 zoom-in-95 text-xs">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="flex w-full items-center gap-2 px-3.5 py-2 text-slate-700 hover:bg-slate-50 cursor-pointer font-medium"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Export as CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="flex w-full items-center gap-2 px-3.5 py-2 text-slate-700 hover:bg-slate-50 cursor-pointer font-medium"
                >
                  <FileCode className="h-3.5 w-3.5 text-sky-700" />
                  <span>Export as JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                    setExportMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3.5 py-2 text-slate-700 hover:bg-slate-50 cursor-pointer font-medium border-t border-slate-100"
                >
                  <Printer className="h-3.5 w-3.5 text-slate-600" />
                  <span>Print current page</span>
                </button>
              </div>
            )}
          </div>

          <Button
            onClick={() => refetch()}
            disabled={isFetching}
            variant="outline"
            className="h-10 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-xs gap-1.5 px-3.5 shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin text-emerald-800' : 'text-slate-600'}`} />
            <span>Sync</span>
          </Button>
        </div>
      </section>

      {/* 4 KPI Summary Cards */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          role="button" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
          onClick={() => {
            setActionFilter(undefined); setMutationsOnly(false);
            setActiveTab('ALL');
            setSeverityFilter('ALL');
          }}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-emerald-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Total Audited Events</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {isLoading || isError ? '—' : totalEvents.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Matching current filters</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-100">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card
          role="button" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
          onClick={() => {
            setMutationsOnly(false); setActionFilter('LOGIN_SUCCESS');
            setActiveTab('AUTH');
            setSeverityFilter('SUCCESS');
          }}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-emerald-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Successful Sign-ins</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-700 font-mono">
                {isLoading || isError ? '—' : successfulLogins.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Recorded successful sign-ins</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-100">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card
          role="button" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
          onClick={() => { setActionFilter(undefined); setMutationsOnly(false); setActiveTab('ALL'); setSeverityFilter('DANGER'); }}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-rose-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Failed / Rejected Events</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-rose-700 font-mono">
                {isLoading || isError ? '—' : failedAttempts.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-rose-500 mt-0.5 font-medium">Rejected / cancelled / failed events</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-700 border border-rose-100">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>
        </Card>

        <Card
          role="button" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
          onClick={() => { setActionFilter(undefined); setMutationsOnly(true); setActiveTab('ALL'); setSeverityFilter('ALL'); }}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-sky-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Ledger Mutations</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-sky-700 font-mono">
                {isLoading || isError ? '—' : mutations.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Vault &amp; billing changes</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-sky-700 border border-sky-100">
              <Activity className="h-6 w-6" />
            </div>
          </div>
        </Card>
      </section>

      {/* Main Filter & Action Console */}
      <div className="space-y-4">
        {/* Module Category Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {MODULE_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id); setActionFilter(undefined); setMutationsOnly(false);
                    setPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-emerald-200' : 'text-slate-500'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search action, operator, entity, IP..."
              aria-label="Search audit events"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Secondary Filter Bar (Time, Severity, View Switch) */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-2.5 rounded-2xl border border-slate-200/90 shadow-2xs text-xs">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Date Range Selector */}
            <div className="flex items-center gap-1.5 text-slate-600">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-semibold text-slate-700">Period:</span>
              <select
                aria-label="Audit period"
                value={dateRange}
                onChange={(e) => {
                  setDateRange(e.target.value as DateRangeOption);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-700"
              >
                <option value="ALL">All Time</option>
                <option value="TODAY">Today</option>
                <option value="24H">Past 24 Hours</option>
                <option value="7D">Past 7 Days</option>
                <option value="30D">Past 30 Days</option>
              </select>
            </div>

            {/* Severity Filter */}
            <div className="flex items-center gap-1.5 text-slate-600 border-l border-slate-200 pl-3">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-semibold text-slate-700">Severity:</span>
              <select
                aria-label="Audit severity"
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value as SeverityFilter);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-700"
              >
                <option value="ALL">All Severities</option>
                <option value="SUCCESS">Success / Verified</option>
                <option value="INFO">Mutations &amp; Updates</option>
                <option value="WARNING">Security Notices</option>
                <option value="DANGER">Critical / Failures</option>
              </select>
            </div>
          </div>

          {/* View Toggle (Table vs Timeline) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'TABLE' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('TIMELINE')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'TIMELINE' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GitCommit className="h-3.5 w-3.5" />
              <span>Timeline Stream</span>
            </button>
          </div>
        </div>

        {/* Content View: Table vs Timeline */}
        {viewMode === 'TABLE' ? (
          /* Table View */
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/95 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10.5px]">
                  <tr>
                    <th scope="col" className="px-4 py-3.5 sm:px-5">Timestamp</th>
                    <th scope="col" className="px-3 py-3.5">Activity Event</th>
                    <th scope="col" className="px-3 py-3.5">Operator</th>
                    <th scope="col" className="px-3 py-3.5">Module / Entity</th>
                    <th scope="col" className="px-3 py-3.5">Audit Summary</th>
                    <th scope="col" className="px-4 py-3.5 text-right sm:px-5">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {isError ? (<tr><td colSpan={6} className="p-8 text-center text-red-700">Audit events are unavailable. Retry above.</td></tr>) : isLoading ? (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="h-6 w-6 animate-spin text-emerald-800" />
                          <span className="text-xs font-medium">Decrypting and loading immutable audit ledger…</span>
                        </div>
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-500">
                        <ShieldCheck className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-slate-700">No matching audit logs found</p>
                        <p className="text-xs text-slate-400 mt-0.5">Try adjusting your search terms, time period, or active category filters.</p>
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      const severity = getActionSeverity(log.action);
                      const human = getHumanFriendlyEventInfo(log);
                      return (
                        <tr
                          key={log._id}
                          onClick={() => setSelectedLog(log)}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                        >
                          <td className="whitespace-nowrap px-4 py-3.5 sm:px-5 font-mono text-[11px] text-slate-500">
                            <div>
                              {new Date(log.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata',
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {formatRelativeTime(log.createdAt)}
                            </div>
                          </td>
                          <td className="px-3 py-3.5">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${severity.bg} ${severity.text} ${severity.border}`}>
                              {human.friendlyTitle.length > 30 ? human.friendlyTitle.substring(0, 30) + '…' : human.friendlyTitle}
                            </span>
                          </td>
                          <td className="px-3 py-3.5">
                            <div className="font-semibold text-slate-900">
                              {log.actorUserId?.name || log.performedBy?.name || log.actorUsername || 'SYSTEM'}
                            </div>
                            {log.ipAddress && (
                              <div className="text-[10px] font-mono text-slate-400">
                                {formatIpAddress(log.ipAddress).split(' ')[0]}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3.5 font-mono text-[11px] text-slate-600">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {log.entityType || log.module || 'SYSTEM'}
                            </span>
                          </td>
                          <td className="px-3 py-3.5 text-slate-700 max-w-md truncate font-normal">
                            {log.description || human.whatHappened}
                          </td>
                          <td className="px-4 py-3.5 text-right sm:px-5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLog(log);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 text-[11px] font-medium transition-colors cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Inspect</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>


          </div>
        ) : (
          /* Timeline Stream View */
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-6">
            {isError ? <p className="text-sm text-red-700">Audit events are unavailable. Retry above.</p> : isLoading ? (
              <div className="p-10 text-center text-slate-500">
                <RefreshCw className="h-6 w-6 animate-spin text-emerald-800 mx-auto mb-2" />
                <span className="text-xs font-medium">Generating chronological activity stream…</span>
              </div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <ShieldCheck className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No stream events found</p>
                <p className="text-xs text-slate-400 mt-0.5">Try widening your filters or search terms.</p>
              </div>
            ) : (
              <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-200 space-y-6">
                {logs.map((log) => {
                  const severity = getActionSeverity(log.action);
                  const human = getHumanFriendlyEventInfo(log);
                  return (
                    <div key={log._id} className="relative group">
                      {/* Timeline dot */}
                      <div className={`absolute -left-[31px] sm:-left-[39px] top-1.5 h-4 w-4 rounded-full border-2 border-white ${
                        severity.variant === 'destructive'
                          ? 'bg-rose-600'
                          : severity.variant === 'warning'
                          ? 'bg-amber-500'
                          : severity.variant === 'info'
                          ? 'bg-sky-600'
                          : 'bg-emerald-600'
                      }`} />

                      <div className="bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-xl p-4 transition-all">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${severity.bg} ${severity.text} ${severity.border}`}>
                              {human.friendlyTitle}
                            </span>
                            <span className="text-xs font-semibold text-slate-900">
                              by {log.actorUserId?.name || log.performedBy?.name || log.actorUsername || 'SYSTEM'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatRelativeTime(log.createdAt)}
                            </span>
                            <span>
                              {new Date(log.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        <p className="mt-2 text-xs text-slate-700 font-medium">
                          {human.whatHappened}
                        </p>

                        <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-200/60 text-[11px] text-slate-500 font-mono">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-white border border-slate-200">
                              {log.entityType || log.module || 'SYSTEM'}
                            </span>
                            {log.ipAddress && <span>IP: {formatIpAddress(log.ipAddress).split(' ')[0]}</span>}
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedLog(log)}
                            className="inline-flex items-center gap-1 text-emerald-800 hover:text-emerald-950 font-semibold cursor-pointer"
                          >
                            <span>Inspect Details</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <nav aria-label="Audit pagination" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
          <label>Page size <select aria-label="Audit page size" value={limit} onChange={event => { setLimit(Number(event.target.value)); setPage(1); }} className="ml-2 rounded-lg border border-slate-300 p-1">{[15, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}</select> of {pagination.total.toLocaleString('en-IN')} matching events</label>
          <div className="flex items-center gap-2"><span aria-live="polite">Page {pagination.page} of {pagination.totalPages}</span><Button variant="outline" size="sm" aria-label="Previous audit page" disabled={page <= 1 || isFetching || isError} onClick={() => setPage(value => value - 1)}>Prev</Button><Button variant="outline" size="sm" aria-label="Next audit page" disabled={page >= pagination.totalPages || isFetching || isError} onClick={() => setPage(value => value + 1)}>Next</Button></div>
        </nav>
      </div>

      {/* Forensic Inspection Modal (Full-Window React Portal) */}
      {selectedLog && (
        <AuditDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          onPrev={selectedLogIndex > 0 ? () => setSelectedLog(logs[selectedLogIndex - 1]) : undefined}
          onNext={selectedLogIndex >= 0 && selectedLogIndex < logs.length - 1 ? () => setSelectedLog(logs[selectedLogIndex + 1]) : undefined}
          hasPrev={selectedLogIndex > 0}
          hasNext={selectedLogIndex >= 0 && selectedLogIndex < logs.length - 1}
        />
      )}
    </div>
  );
}
