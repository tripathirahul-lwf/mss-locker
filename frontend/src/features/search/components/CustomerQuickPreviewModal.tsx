import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  X,
  User,
  Phone,
  MapPin,
  ShieldCheck,
  KeyRound,
  Calendar,
  DollarSign,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  History,
  CreditCard,
  Building2,
  Lock,
} from 'lucide-react';
import { searchApi } from '../api/searchApi';
import {
  CustomerQuickPreviewData,
  CustomerRenewalHistoryInvoice,
} from '../types';

interface CustomerQuickPreviewModalProps {
  customerId: string | null;
  isOpen: boolean;
  onClose: () => void;
  userPermissions?: string[];
}

export const CustomerQuickPreviewModal: React.FC<CustomerQuickPreviewModalProps> = ({
  customerId,
  isOpen,
  onClose,
  userPermissions = [],
}) => {
  const navigate = useNavigate();
  const [data, setData] = useState<CustomerQuickPreviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Renewal History Lazy Load State
  const [historyExpanded, setHistoryExpanded] = useState<boolean>(false);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historyInvoices, setHistoryInvoices] = useState<
    CustomerRenewalHistoryInvoice[]
  >([]);
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [historyTotalPages, setHistoryTotalPages] = useState<number>(1);
  const [historyTotal, setHistoryTotal] = useState<number>(0);

  const canCreatePayment = userPermissions.includes('payments.create');
  const canCreateRenewal = userPermissions.includes('renewals.create');
  const canCreateClosure = userPermissions.includes('closures.create');
  const canViewCustomer = userPermissions.includes('customers.view');

  useEffect(() => {
    if (!isOpen || !customerId) {
      setData(null);
      setHistoryExpanded(false);
      setHistoryInvoices([]);
      return;
    }

    setLoading(true);
    setError(null);

    searchApi
      .getCustomerQuickPreview(customerId)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        console.error('Error loading customer quick preview:', err);
        setError('Failed to load customer information.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, customerId]);

  // Load Renewal History when expanded or page changes
  useEffect(() => {
    if (!historyExpanded || !customerId) return;

    setHistoryLoading(true);
    searchApi
      .getCustomerRenewalHistory(customerId, historyPage, 5)
      .then((res) => {
        setHistoryInvoices(res.invoices);
        setHistoryTotalPages(res.pagination.totalPages);
        setHistoryTotal(res.pagination.total);
      })
      .catch((err) => {
        console.error('Error loading renewal history:', err);
      })
      .finally(() => {
        setHistoryLoading(false);
      });
  }, [historyExpanded, historyPage, customerId]);

  if (!isOpen || !customerId) return null;

  const customer = data?.customer;
  const isArchived = customer?.status === 'ARCHIVED';

  const modalContent = (
    <div
      className="fixed inset-0 z-[110] w-screen h-screen flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs select-none animate-in fade-in-0 duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Walk-in Customer Quick Preview
            </span>
            {isArchived && (
              <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 font-bold text-[10px] uppercase">
                Archived Record
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mb-3" />
              <p className="font-medium">Loading customer profile...</p>
            </div>
          ) : error || !customer ? (
            <div className="p-8 text-center text-rose-600 text-sm font-medium">
              {error || 'Customer not found.'}
            </div>
          ) : (
            <>
              {/* Customer Profile Card with Photo */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-tr from-slate-50 to-emerald-50/30 border border-slate-200/80">
                <div className="flex items-center gap-4">
                  {/* Photo Avatar */}
                  <div className="relative shrink-0">
                    {customer.photoUrl ? (
                      <img
                        src={customer.photoUrl}
                        alt={customer.fullName}
                        className="w-16 h-16 min-w-[64px] min-h-[64px] max-w-[64px] max-h-[64px] rounded-2xl object-cover border-2 border-white shadow-xs"
                      />
                    ) : (
                      <div className="w-16 h-16 min-w-[64px] min-h-[64px] rounded-2xl bg-slate-200 text-slate-600 font-black text-xl flex items-center justify-center border-2 border-white shadow-xs">
                        {customer.fullName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span
                      className={`absolute -bottom-1 -right-1 p-1 rounded-full text-white shadow-xs ${
                        customer.kycStatus === 'VERIFIED'
                          ? 'bg-emerald-600'
                          : 'bg-amber-500'
                      }`}
                      title={`KYC: ${customer.kycStatus}`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </span>
                  </div>

                  <div>
                    <h2 className="text-lg font-black text-slate-900 leading-tight">
                      {customer.fullName}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-mono mt-1">
                      <span className="font-bold text-slate-800">
                        {customer.customerCode}
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {customer.phone}
                      </span>
                      {customer.city && (
                        <>
                          <span>&bull;</span>
                          <span className="font-sans flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {customer.city}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Combined Total Outstanding Hero */}
                {data.totalActiveLockers > 0 && (
                  <div className="text-left sm:text-right bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs shrink-0 w-full sm:w-auto">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Total Active Dues
                    </span>
                    <div
                      className={`text-xl font-black font-mono ${
                        data.totalCombinedOutstanding > 0
                          ? 'text-rose-600'
                          : 'text-emerald-700'
                      }`}
                    >
                      ₹{data.totalCombinedOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Across {data.totalActiveLockers} active locker(s)
                    </span>
                  </div>
                )}
              </div>

              {/* Archived Customer Alert */}
              {isArchived && (
                <div className="p-3 bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded-xl flex items-center gap-2">
                  <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>
                    This customer is currently <strong>Archived</strong> (no active locker allocations). Historical records, past closures, and renewals remain accessible below.
                  </span>
                </div>
              )}

              {/* Multi-Locker Active Tenancies */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                    Active Locker Tenancies ({data.activeLockers.length})
                  </h3>
                </div>

                {data.activeLockers.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-200/80">
                    No active lockers held at present.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.activeLockers.map((locker) => (
                      <div
                        key={locker.allocationId}
                        className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs space-y-3"
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-black text-slate-900 font-mono">
                                Locker #{locker.lockerNumber}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-[10px] text-slate-700">
                                Size {locker.size}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              Rack {locker.rackNumber} {locker.section ? `• ${locker.section}` : ''}
                            </div>
                          </div>

                          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {locker.allocationCode}
                          </span>
                        </div>

                        {/* Real-time Dues & Renewal Grid */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">
                              Outstanding Dues
                            </span>
                            <span
                              className={`font-black font-mono text-sm ${
                                locker.outstandingAmount > 0
                                  ? 'text-rose-600'
                                  : 'text-emerald-700'
                              }`}
                            >
                              ₹{locker.outstandingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">
                              Due Date
                            </span>
                            <span className="font-semibold text-slate-800">
                              {locker.currentDueDate
                                ? new Date(locker.currentDueDate).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : 'N/A'}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">
                              Caution Deposit
                            </span>
                            <span className="font-medium text-slate-700 font-mono">
                              ₹{locker.depositHeld.toLocaleString('en-IN')}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">
                              Last Paid
                            </span>
                            <span className="font-medium text-slate-700 font-mono">
                              {locker.lastPaymentAmount
                                ? `₹${locker.lastPaymentAmount.toLocaleString('en-IN')}`
                                : 'None'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Payments Section */}
              {data.recentPayments.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                    Recent Payments (Last {data.recentPayments.length})
                  </h3>

                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Receipt No.</th>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Locker</th>
                          <th className="py-2 px-3">Mode</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.recentPayments.map((p) => (
                          <tr key={p._id} className="hover:bg-slate-50/70">
                            <td className="py-2 px-3 font-mono font-bold text-slate-900">
                              {p.receiptNumber}
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              {new Date(p.paymentDate).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="py-2 px-3 font-mono">
                              #{p.lockerNumber}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {p.paymentMethod}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                              ₹{p.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Lazy-Loaded Full Renewal History Accordion */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => setHistoryExpanded(!historyExpanded)}
                  className="w-full flex items-center justify-between p-3.5 bg-slate-50/70 hover:bg-slate-100/80 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Full Renewal & Billing History
                    </span>
                    {historyTotal > 0 && (
                      <span className="text-xs font-semibold text-slate-500 font-mono">
                        ({historyTotal} bills)
                      </span>
                    )}
                  </div>
                  {historyExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </button>

                {historyExpanded && (
                  <div className="p-3 border-t border-slate-200 space-y-3">
                    {historyLoading ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        Loading invoice records...
                      </div>
                    ) : historyInvoices.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        No renewal invoices recorded yet.
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                              <tr>
                                <th className="py-2 px-3">Invoice No.</th>
                                <th className="py-2 px-3">Locker</th>
                                <th className="py-2 px-3">Due Date</th>
                                <th className="py-2 px-3 text-right">Total</th>
                                <th className="py-2 px-3 text-right">Paid</th>
                                <th className="py-2 px-3 text-right">Balance</th>
                                <th className="py-2 px-3 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {historyInvoices.map((inv) => (
                                <tr key={inv._id} className="hover:bg-slate-50/70">
                                  <td className="py-2 px-3 font-mono font-bold text-slate-900">
                                    {inv.invoiceNumber}
                                  </td>
                                  <td className="py-2 px-3 font-mono">
                                    #{inv.lockerNumber}
                                  </td>
                                  <td className="py-2 px-3 text-slate-600">
                                    {new Date(inv.dueDate).toLocaleDateString('en-IN', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono">
                                    ₹{inv.totalAmount.toLocaleString('en-IN')}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono">
                                    ₹{inv.paidAmount.toLocaleString('en-IN')}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-rose-600">
                                    ₹{inv.balanceAmount.toLocaleString('en-IN')}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        inv.paymentStatus === 'PAID'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-rose-100 text-rose-800'
                                      }`}
                                    >
                                      {inv.paymentStatus}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination */}
                        {historyTotalPages > 1 && (
                          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                            <span>
                              Page {historyPage} of {historyTotalPages}
                            </span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                                disabled={historyPage <= 1}
                                className="px-2 py-1 bg-slate-100 rounded-md disabled:opacity-40"
                              >
                                Prev
                              </button>
                              <button
                                onClick={() =>
                                  setHistoryPage((p) =>
                                    Math.min(historyTotalPages, p + 1)
                                  )
                                }
                                disabled={historyPage >= historyTotalPages}
                                className="px-2 py-1 bg-slate-100 rounded-md disabled:opacity-40"
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Quick Action Ribbon */}
        {customer && (
          <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            {canViewCustomer && (
              <button
                onClick={() => {
                  onClose();
                  navigate(`/customers/${customer._id}`);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <User className="w-3.5 h-3.5" />
                View Full Profile
              </button>
            )}

            <div className="flex items-center gap-2">
              {canCreatePayment && data?.totalCombinedOutstanding && data.totalCombinedOutstanding > 0 && (
                <button
                  onClick={() => {
                    onClose();
                    navigate('/payments');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer transition-colors"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  Record Dues Payment
                </button>
              )}

              {canCreateRenewal && data?.activeLockers && data.activeLockers.length > 0 && (
                <button
                  onClick={() => {
                    onClose();
                    navigate('/renewals');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Process Renewal
                </button>
              )}

              {canCreateClosure && data?.activeLockers && data.activeLockers.length > 0 && (
                <button
                  onClick={() => {
                    onClose();
                    navigate('/closures');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Start Closure
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
