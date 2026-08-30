import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  IndianRupee,
  Search,
  KeyRound,
  User,
  Calendar,
  CreditCard,
  QrCode,
  Banknote,
  Building2,
  Receipt,
  FileCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { renewalApi } from '../../renewals/api/renewalApi';
import { LockerInvoice } from '../../renewals/types';
import { RecordPaymentInput, PaymentMethod, Payment } from '../types';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';

interface RecordPaymentModalProps {
  initialInvoiceId?: string;
  onClose: () => void;
  onSubmit: (data: RecordPaymentInput, idempotencyKey: string) => Promise<Payment>;
  onSuccessViewReceipt?: (payment: Payment) => void;
}

export function RecordPaymentModal({
  initialInvoiceId,
  onClose,
  onSubmit,
  onSuccessViewReceipt,
}: RecordPaymentModalProps) {
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [invoiceList, setInvoiceList] = useState<LockerInvoice[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<LockerInvoice | null>(null);

  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));

  // Dynamic references
  const [upiReference, setUpiReference] = useState('');
  const [bankReference, setBankReference] = useState('');
  const [transactionReference, setTransactionReference] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [notes, setNotes] = useState('');

  const [idempotencyKey] = useState(() => `IDEM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recordedPayment, setRecordedPayment] = useState<Payment | null>(null);

  // If initialInvoiceId passed, fetch and prefill
  useEffect(() => {
    if (initialInvoiceId) {
      renewalApi.getInvoiceById(initialInvoiceId).then((inv) => {
        if (inv) {
          setSelectedInvoice(inv);
          setAmount(inv.balanceAmount || inv.totalAmount);
        }
      });
    }
  }, [initialInvoiceId]);

  // Search outstanding invoices
  useEffect(() => {
    if (selectedInvoice) return;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await renewalApi.getInvoices({
          search: invoiceQuery.trim() || undefined,
          paymentStatus: 'UNPAID',
          limit: 10,
        });
        setInvoiceList(result.invoices);
      } catch {
        // Silently handled
      } finally {
        setIsSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [invoiceQuery, selectedInvoice]);

  const handleSelectInvoice = (inv: LockerInvoice) => {
    setSelectedInvoice(inv);
    setAmount(inv.balanceAmount || inv.totalAmount);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) {
      setError('Please select an invoice to settle.');
      return;
    }

    if (amount <= 0) {
      setError('Payment amount must be greater than 0.');
      return;
    }

    if (amount > selectedInvoice.balanceAmount) {
      setError(
        `Payment amount (₹${amount.toLocaleString('en-IN')}) cannot exceed current outstanding balance (₹${selectedInvoice.balanceAmount.toLocaleString('en-IN')}).`
      );
      return;
    }

    if (paymentMethod === 'UPI' && !upiReference.trim()) return setError('UPI reference/UTR number is required.');
    if (paymentMethod === 'BANK_TRANSFER' && !bankReference.trim()) return setError('Bank UTR/IMPS reference is required.');
    if ((paymentMethod === 'CARD' || paymentMethod === 'OTHER') && !transactionReference.trim()) return setError('Manual transaction reference is required.');
    if (paymentMethod === 'CHEQUE' && (!chequeNumber.trim() || !bankName.trim() || !chequeDate)) return setError('Cheque number, bank name and cheque date are required.');

    setError(null);
    setIsSubmitting(true);

    try {
      const payment = await onSubmit(
        {
          invoiceId: selectedInvoice._id,
          amount: Number(amount),
          paymentMethod,
          paymentDate,
          upiReference: upiReference.trim() || undefined,
          bankReference: bankReference.trim() || undefined,
          transactionReference: transactionReference.trim() || undefined,
          chequeNumber: chequeNumber.trim() || undefined,
          bankName: bankName.trim() || undefined,
          chequeDate: chequeDate || undefined,
          notes: notes.trim() || undefined,
        },
        idempotencyKey
      );

      setRecordedPayment(payment);
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || 'Failed to record payment transaction.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const remainingBalance = selectedInvoice ? Math.max(0, selectedInvoice.balanceAmount - (Number(amount) || 0)) : 0;

  const modalContent = (
    <div className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-sm select-none animate-in fade-in-0 duration-150">
      <div
        className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20">
              <IndianRupee className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Record Payment Collection
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Cashier collection and official receipt issuance
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Screen */}
        {recordedPayment ? (
          <div className="p-6 sm:p-8 space-y-6 text-center overflow-y-auto flex-1 text-xs">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto border-2 border-emerald-300 shadow-md">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900">
                Payment Recorded Successfully!
              </h3>
              <p className="text-xs text-slate-500">
                Receipt #{recordedPayment.receiptNumber} &bull; Payment #{recordedPayment.paymentNumber}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 max-w-md mx-auto space-y-2 text-left font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Amount Received:</span>
                <strong className="text-emerald-700 text-sm">
                  ₹{recordedPayment.amount.toLocaleString('en-IN')}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Payment Method:</span>
                <strong className="text-slate-800 font-sans font-bold">
                  {recordedPayment.paymentMethod}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Remaining Invoice Balance:</span>
                <strong className="text-slate-800">
                  ₹{remainingBalance.toLocaleString('en-IN')}
                </strong>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="rounded-xl px-5 h-11 text-xs font-bold"
              >
                Close Window
              </Button>

              {onSuccessViewReceipt && (
                <Button
                  size="sm"
                  onClick={() => {
                    onClose();
                    onSuccessViewReceipt(recordedPayment);
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl px-5 h-11 text-xs"
                >
                  <Receipt className="w-4 h-4 mr-1.5" />
                  <span>View Official Receipt</span>
                </Button>
              )}
            </div>
          </div>
        ) : (
          /* Payment Input Form */
          <form onSubmit={handleFormSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
            {error && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span className="font-bold leading-relaxed">{error}</span>
              </div>
            )}

            {/* 1. Invoice Selection */}
            {!selectedInvoice ? (
              <div className="space-y-3">
                <label className="font-bold text-slate-800">
                  1. Search & Select Outstanding Invoiced Statement *
                </label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={invoiceQuery}
                    onChange={(e) => setInvoiceQuery(e.target.value)}
                    placeholder="Search invoice number (e.g. INV-2026-000001), customer, phone, or locker..."
                    className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-300 rounded-2xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                {isSearching && (
                  <div className="p-6 text-center text-slate-400 font-semibold animate-pulse">
                    Searching outstanding invoices...
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto">
                  {invoiceList.map((inv) => (
                    <div
                      key={inv._id}
                      onClick={() => handleSelectInvoice(inv)}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-emerald-500 hover:bg-emerald-50/40 cursor-pointer transition-all flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                          {inv.invoiceNumber}
                        </span>
                        <span className="font-bold text-blue-700">
                          Locker #{inv.lockerId?.lockerNumber} ({inv.lockerId?.size})
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-800 truncate">
                          {inv.customerId?.fullName}
                        </span>
                        <span className="font-mono text-rose-600 font-black">
                          Due: ₹{inv.balanceAmount.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Selected Invoice Card */
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileCheck className="w-5 h-5 text-emerald-700 shrink-0" />
                  <div>
                    <p className="font-bold text-xs text-emerald-950">
                      {selectedInvoice.invoiceNumber} &bull; Locker #{selectedInvoice.lockerId?.lockerNumber} ({selectedInvoice.lockerId?.size})
                    </p>
                    <p className="text-[11px] text-emerald-800">
                      Tenant: <strong>{selectedInvoice.customerId?.fullName}</strong> &bull; Total: ₹{selectedInvoice.totalAmount.toLocaleString('en-IN')} &bull; Balance: <strong>₹{selectedInvoice.balanceAmount.toLocaleString('en-IN')}</strong>
                    </p>
                  </div>
                </div>
                {!initialInvoiceId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedInvoice(null)}
                    className="rounded-xl text-[11px] h-8 bg-white border-emerald-300 text-emerald-800"
                  >
                    Change
                  </Button>
                )}
              </div>
            )}

            {/* 2. Payment Details */}
            {selectedInvoice && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1 sm:col-span-1">
                    <label className="font-bold text-slate-700">Amount to Collect (₹) *</label>
                    <Input
                      type="number"
                      min="1"
                      max={selectedInvoice.balanceAmount}
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      required
                      className="h-11 text-base font-black text-emerald-700 bg-slate-50 border-slate-300 rounded-xl"
                    />
                    <span className="text-[10px] text-slate-400 block font-medium">
                      Max: ₹{selectedInvoice.balanceAmount.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="space-y-1 sm:col-span-1">
                    <label className="font-bold text-slate-700">Payment Method *</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                    >
                      <option value="CASH">Cash Payment</option>
                      <option value="UPI">UPI / QR (GPay, PhonePe)</option>
                      <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                      <option value="CARD">Card via POS Machine (Manual)</option>
                      <option value="CHEQUE">Cheque / DD</option>
                      <option value="OTHER">Other Mode</option>
                    </select>
                  </div>

                  <div className="space-y-1 sm:col-span-1">
                    <label className="font-bold text-slate-700">Payment Date *</label>
                    <Input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      required
                      className="h-11 text-xs bg-slate-50 border-slate-300 font-bold rounded-xl"
                    />
                  </div>
                </div>

                {/* Dynamic Method Reference Fields */}
                {paymentMethod === 'UPI' && (
                  <div className="space-y-1 p-3.5 rounded-2xl bg-violet-50/60 border border-violet-200">
                    <label className="font-bold text-violet-900 flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5" />
                      <span>UPI Reference / UTR Number</span>
                    </label>
                    <Input
                      type="text"
                      value={upiReference}
                      onChange={(e) => setUpiReference(e.target.value)}
                      placeholder="e.g. 423589234821 or UPI Ref ID"
                      className="h-10 text-xs bg-white border-violet-300 font-mono rounded-xl"
                    />
                  </div>
                )}

                {paymentMethod === 'BANK_TRANSFER' && (
                  <div className="space-y-1 p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200">
                    <label className="font-bold text-blue-900 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Bank Transfer UTR / IMPS Reference</span>
                    </label>
                    <Input
                      type="text"
                      value={bankReference}
                      onChange={(e) => setBankReference(e.target.value)}
                      placeholder="e.g. HDFCN00012345678"
                      className="h-10 text-xs bg-white border-blue-300 font-mono rounded-xl"
                    />
                  </div>
                )}

                {paymentMethod === 'CARD' && (
                  <div className="space-y-1 p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200">
                    <label className="font-bold text-indigo-900 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>POS Machine Auth / Txn Reference</span>
                    </label>
                    <Input
                      type="text"
                      value={transactionReference}
                      onChange={(e) => setTransactionReference(e.target.value)}
                      placeholder="e.g. POS-AUTH-987654"
                      className="h-10 text-xs bg-white border-indigo-300 font-mono rounded-xl"
                    />
                  </div>
                )}

                {paymentMethod === 'CHEQUE' && (
                  <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="space-y-1">
                        <label className="font-bold text-amber-900">Cheque Number *</label>
                        <Input
                          type="text"
                          value={chequeNumber}
                          onChange={(e) => setChequeNumber(e.target.value)}
                          placeholder="e.g. 000456"
                          className="h-10 text-xs bg-white border-amber-300 font-mono rounded-xl"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-amber-900">Drawee Bank Name</label>
                        <Input
                          type="text"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          placeholder="e.g. State Bank of India"
                          className="h-10 text-xs bg-white border-amber-300 rounded-xl"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-amber-900">Cheque Date</label>
                        <Input
                          type="date"
                          value={chequeDate}
                          onChange={(e) => setChequeDate(e.target.value)}
                          className="h-10 text-xs bg-white border-amber-300 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Payment Remarks / Counter Notes</label>
                  <Input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional cashier notes or counter instructions"
                    className="h-10 text-xs bg-slate-50 border-slate-300 rounded-xl"
                  />
                </div>

                {/* Final Review & Balance Calculation */}
                <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-6 font-mono text-center sm:text-left">
                    <div>
                      <span className="text-[10px] text-slate-400 font-sans uppercase font-bold block">
                        Payment Collecting
                      </span>
                      <span className="text-xl font-black text-emerald-400">
                        ₹{Number(amount || 0).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="border-l border-slate-700 pl-6">
                      <span className="text-[10px] text-slate-400 font-sans uppercase font-bold block">
                        Remaining After Payment
                      </span>
                      <span className="text-base font-bold text-slate-200">
                        ₹{remainingBalance.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-6 rounded-2xl text-xs cursor-pointer w-full sm:w-auto"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Processing Settlement...</span>
                      </span>
                    ) : (
                      'Confirm Payment & Issue Receipt'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
