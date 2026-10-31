import { ReactNode } from 'react';
import { CreditCard, FileText, Receipt, RotateCw, ShieldCheck, Undo2, Loader2 } from 'lucide-react';
import { LockerAllocation } from '../../allocations/types';
import { LockerInvoice } from '../../renewals/types';
import { Payment } from '../../payments/types';
import { Button } from '../../../components/ui/button';

export const referenceId = (value: unknown): string | undefined => typeof value === 'string' ? value : value && typeof value === 'object' && '_id' in value ? String(value._id) : undefined;
export const money = (value: number) => Number.isFinite(value) ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value) : 'Not recorded';
export const ledgerDate = (value?: string) => { const date = value ? new Date(value) : null; return date && Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }) : 'Not recorded'; };
const calendarDay = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)) : '';
export function coverageProblem(allocation: LockerAllocation | undefined, invoices: LockerInvoice[]): string {
  if (!allocation) return '';
  if (allocation.coverageIssue) return allocation.coverageIssue;
  const related = invoices.filter(invoice => referenceId(invoice.allocationId) === allocation._id && invoice.invoiceType !== 'ADJUSTMENT' && !['CANCELLED', 'DRAFT'].includes(invoice.status));
  const paid = related.filter(invoice => invoice.paymentStatus === 'PAID' && invoice.balanceAmount === 0 && Number.isFinite(invoice.totalAmount) && Math.abs(invoice.paidAmount - invoice.totalAmount) <= .011);
  if (related.some(invoice => invoice.balanceAmount > 0 && paid.some(settled => calendarDay(invoice.billingPeriodStart) && calendarDay(settled.billingPeriodStart) && calendarDay(invoice.billingPeriodStart) <= calendarDay(settled.billingPeriodEnd) && calendarDay(invoice.billingPeriodEnd) >= calendarDay(settled.billingPeriodStart)))) return 'An unpaid bill overlaps recorded paid coverage.';
  const due = calendarDay(allocation.nextRenewalDueDate), through = calendarDay(allocation.paidThroughDate);
  if (due && through && through >= due) return 'The next renewal date is within the recorded paid coverage.';
  return '';
}
export function occupiedHealth(allocation: LockerAllocation | undefined, invoices: LockerInvoice[], ready: boolean) {
  if (!allocation || !ready) return { label: 'Status unavailable', style: 'bg-slate-100 text-slate-700' };
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const day = (value?: string) => value && Number.isFinite(new Date(value).getTime()) ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)) : '';
  const related = invoices.filter(invoice => referenceId(invoice.allocationId) === allocation._id && !['DRAFT', 'CANCELLED'].includes(invoice.status));
  if (related.some(invoice => !['UNPAID', 'PARTIALLY_PAID', 'PAID'].includes(invoice.paymentStatus) || !['ISSUED', 'PAID'].includes(invoice.status) || invoice.balanceAmount > 0 && !calendarDay(invoice.dueDate) || invoice.invoiceType !== 'ADJUSTMENT' && (!calendarDay(invoice.billingPeriodStart) || !calendarDay(invoice.billingPeriodEnd) || calendarDay(invoice.billingPeriodStart) > calendarDay(invoice.billingPeriodEnd)) || ![invoice.totalAmount, invoice.paidAmount, invoice.balanceAmount].every(Number.isFinite) || invoice.totalAmount < 0 || invoice.paidAmount < 0 || invoice.balanceAmount < 0 || Math.abs(invoice.totalAmount - invoice.paidAmount - invoice.balanceAmount) > 0.011 || (invoice.paymentStatus === 'PAID' && invoice.balanceAmount > 0))) return { label: 'Billing needs review', style: 'bg-amber-100 text-amber-900' };
  if (coverageProblem(allocation, invoices)) return { label: 'Coverage needs review', style: 'bg-amber-100 text-amber-900' };
  const unpaid = invoices.filter(invoice => referenceId(invoice.allocationId) === allocation._id && !['DRAFT', 'CANCELLED'].includes(invoice.status) && invoice.balanceAmount > 0 );
  if (unpaid.some(invoice => day(invoice.dueDate) && day(invoice.dueDate) < today)) return { label: 'Payment overdue', style: 'bg-rose-100 text-rose-800' };
  const due = day(allocation.nextRenewalDueDate);
  if (due && due < today) return { label: 'Renewal overdue', style: 'bg-rose-100 text-rose-800' };
  if (unpaid.length) return { label: 'Payment pending', style: 'bg-amber-100 text-amber-900' };
  if (!due) return { label: 'Renewal date missing', style: 'bg-slate-100 text-slate-700' };
  const days = (Date.parse(due + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000;
  if (!allocation.paymentCoverageConfirmed || !allocation.paidThroughDate || new Date(allocation.paidThroughDate).getTime() < Date.parse(due + 'T00:00:00Z') - 86400000) return { label: 'Payment needs review', style: 'bg-amber-100 text-amber-900' };
  if (days <= 30) return { label: 'Due soon', style: 'bg-amber-100 text-amber-900' };
  return { label: 'All good', style: 'bg-emerald-100 text-emerald-800' };
}
interface Props {
  allocation?: LockerAllocation;
  annualRent?: number;
  depositNote?: string;
  deposit: string;
  identity: string;
  identityControl?: ReactNode;
  invoices: LockerInvoice[];
  payments: Payment[];
  historyState: 'ready' | 'loading' | 'error' | 'restricted';
  receiptState: 'ready' | 'loading' | 'error' | 'restricted';
  canReceipt: boolean;
  canRenew: boolean;
  canKyc: boolean;
  canClose: boolean;
  canPay: boolean;
  unpaid?: LockerInvoice;
  loadingReceiptId: string | null;
  receiptError: string;
  onRenew: () => void;
  onKyc: () => void;
  onCloseLocker: () => void;
  onPay: (id: string) => void;
  onInvoice: (invoice: LockerInvoice) => void;
  onReceipt: (payment: Payment) => void;
  onRetry: () => void;
  onRetryReceipts: () => void;
  secondary: ReactNode;
}
export function OccupiedLockerSummary(props: Props) {
  const a = props.allocation;
  const invoices = props.invoices.filter(invoice => referenceId(invoice.allocationId) === a?._id);
  const invoiceIds = new Set(invoices.map(invoice => invoice._id));
  const payments = (props.receiptState === 'ready' ? props.payments : []).filter(payment => referenceId(payment.allocationId) === a?._id && (props.historyState !== 'ready' || !referenceId(payment.invoiceId) || invoiceIds.has(referenceId(payment.invoiceId)!)));
  const problem = coverageProblem(a, invoices);
  const coverageVerified = a?.paymentCoverageConfirmed && !problem && calendarDay(a.paidThroughDate) && calendarDay(a.nextRenewalDueDate) && Date.parse(calendarDay(a.nextRenewalDueDate)) - Date.parse(calendarDay(a.paidThroughDate)) === 86400000;
  const standalone = payments.filter(payment => !invoiceIds.has(referenceId(payment.invoiceId) || ''));
  const receiptButton = (payment: Payment) => <Button variant="outline" aria-busy={props.loadingReceiptId === payment._id} disabled={props.loadingReceiptId === payment._id} onClick={() => props.onReceipt(payment)} aria-label={`View receipt ${payment.receiptNumber || payment.paymentNumber}`} className="h-auto min-h-10 rounded-xl border-emerald-700 px-4 py-2 text-emerald-800 hover:bg-emerald-50">{props.loadingReceiptId === payment._id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Receipt className="mr-2 h-4 w-4" />}View receipt</Button>;
  const card = (label: string, value: ReactNode, note?: ReactNode) => <div className="min-w-0 rounded-2xl bg-slate-100 p-4 sm:p-5"><dt className="text-sm text-slate-600 sm:text-base">{label}</dt><dd className="mt-1 break-words text-lg font-bold leading-snug text-slate-950 sm:text-xl">{value}</dd>{note && <div className="mt-1 text-xs text-slate-600">{note}</div>}</div>;
  return <div className="space-y-6 sm:space-y-7" data-testid="occupied-locker-summary">
    <dl className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-3 sm:gap-4">
      {card('Customer', a?.customerId?.fullName || 'Not recorded')}
      {card('Phone', a?.customerId?.phone || 'Not recorded')}
      {card('ID', props.identity, props.identityControl)}
      {card('Opening date', ledgerDate(a?.startDate))}
      {card('Next renewal', ledgerDate(a?.nextRenewalDueDate), coverageVerified ? `Paid up to: ${ledgerDate(a?.paidThroughDate)}` : a?.paidThroughDate ? `Recorded paid through: ${ledgerDate(a?.paidThroughDate)}. Coverage needs review.` : 'No confirmed rent payment for this period')}
      {card('Annual rent (before GST)', Number.isFinite(props.annualRent) && props.annualRent! >= 0 ? money(Math.round(props.annualRent! / 1.18 * 100) / 100) : 'Not recorded', Number.isFinite(props.annualRent) && props.annualRent! >= 0 ? `Including GST: ${money(props.annualRent!)}` : 'Agreement tariff needs review')}
      {card('Security deposit', props.deposit, props.depositNote || 'Deposit held (recorded)')}
    </dl>
    {problem && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">{problem} Review the billing period before collecting payment. Recorded dates have not been changed.</p>}
    <div className="flex flex-wrap gap-3">
      {props.unpaid && props.canPay ? <Button className="h-auto min-h-12 rounded-2xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800" onClick={() => props.onPay(props.unpaid!._id)}><CreditCard className="mr-2 h-5 w-5" />Record Payment ({money(props.unpaid.balanceAmount)})</Button> : props.canRenew && a && <Button className="h-auto min-h-12 rounded-2xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800" onClick={props.onRenew} aria-label="Renew Lease"><RotateCw className="mr-2 h-5 w-5" />Renew</Button>}
      {props.canKyc && <Button variant="outline" aria-label="KYC Compliance - KYC & ID documents" onClick={props.onKyc} className="h-auto min-h-12 rounded-2xl border-emerald-700 px-5 py-3 font-semibold text-emerald-800 hover:bg-emerald-50"><ShieldCheck className="mr-2 h-5 w-5" />KYC &amp; ID documents</Button>}
      {props.canClose && a && <Button variant="outline" onClick={props.onCloseLocker} aria-label="Close Locker" className="h-auto min-h-12 rounded-2xl border-red-600 px-5 py-3 font-semibold text-red-700 hover:bg-red-50"><Undo2 className="mr-2 h-5 w-5" />Close locker</Button>}
    </div>
    {props.unpaid && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{props.unpaid.invoiceType === 'NEW_ALLOCATION' ? 'Opening rent payment' : 'Locker renewal payment'} {calendarDay(props.unpaid.dueDate) && calendarDay(props.unpaid.dueDate) < calendarDay(new Date().toISOString()) ? 'overdue' : 'pending'}: {money(props.unpaid.balanceAmount)}. Due {ledgerDate(props.unpaid.dueDate)}.</p>}
    <section aria-label="Bill and receipt history">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3"><h3 className="text-sm font-extrabold uppercase tracking-wider text-emerald-800 sm:text-base">Bill &amp; receipt history {props.historyState === 'ready' && `(${invoices.length} ${invoices.length === 1 ? 'bill' : 'bills'}${props.receiptState === 'ready' ? `, ${payments.length} ${payments.length === 1 ? 'receipt' : 'receipts'}` : ''})`}</h3>{props.secondary}</div>
      {props.receiptError && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{props.receiptError}</p>}
      {props.historyState === 'restricted' ? <p className="py-5 text-sm text-slate-600">Invoice access is restricted.</p> : props.historyState === 'loading' ? <p role="status" className="py-5">Loading bills...</p> : props.historyState === 'error' ? <p role="alert" className="py-5 text-rose-800">Could not load invoices. <button className="underline" onClick={props.onRetry}>Retry</button></p> : !invoices.length ? <p className="py-5 text-sm text-slate-600">No bills recorded for this allotment.</p> : <div className="divide-y divide-slate-200">{invoices.map(invoice => {
        const receipts = payments.filter(payment => referenceId(payment.invoiceId) === invoice._id);
        return <article key={invoice._id} className="space-y-3 py-5"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="break-all text-base font-bold text-slate-950">{invoice.invoiceNumber}</h4><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">{invoice.invoiceType === 'NEW_ALLOCATION' ? 'New allotment' : invoice.invoiceType === 'RENEWAL' ? 'Renewal' : 'Bill'}</span><span className="text-xs font-semibold text-slate-600">{['CANCELLED', 'DRAFT'].includes(invoice.status) ? invoice.status : String(invoice.paymentStatus || 'UNKNOWN').replace(/_/g, ' ')}</span></div><p className="mt-2 text-sm text-slate-600">{ledgerDate(invoice.issueDate)} &middot; {ledgerDate(invoice.billingPeriodStart)} &rarr; {ledgerDate(invoice.billingPeriodEnd)}</p></div><div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end"><strong className="text-xl text-slate-950">{money(invoice.totalAmount)}</strong><Button variant="outline" onClick={() => props.onInvoice(invoice)} aria-label={`View invoice ${invoice.invoiceNumber}`} className="rounded-xl"><FileText className="mr-2 h-4 w-4" />View bill</Button></div></div>{invoice.balanceAmount > 0 && !['CANCELLED', 'DRAFT'].includes(invoice.status) && <p className="text-sm font-semibold text-rose-700">Balance due: {money(invoice.balanceAmount)}</p>}{props.receiptState === 'ready' && !receipts.length && <p className="text-xs text-slate-500">{invoice.paymentStatus === 'PAID' && (invoice.source === 'LEGACY_IMPORT' || invoice.invoiceType === 'LEGACY_IMPORT') ? 'Historical bill marked paid; no receipt is recorded.' : 'No receipt recorded for this bill.'}</p>}{receipts.map(payment => <div key={payment._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><span className="font-semibold text-slate-800">{payment.receiptNumber || payment.paymentNumber}</span><p className="text-xs text-slate-600">{ledgerDate(payment.paymentDate)} &middot; {payment.paymentStatus === 'COMPLETED' ? 'Collected' : payment.paymentStatus} {money(payment.amount)}</p></div>{props.canReceipt && receiptButton(payment)}</div>)}</article>;
      })}</div>}
      {props.receiptState === 'error' && <p role="alert" className="py-3 text-rose-800">Could not load receipts. <button onClick={props.onRetryReceipts} className="underline">Retry receipts</button></p>}
      {props.receiptState === 'loading' && <p role="status" className="py-3 text-sm text-slate-600">Loading receipts...</p>}
      {props.receiptState === 'restricted' && <p className="py-3 text-sm text-slate-600">Receipt access is restricted.</p>}
      {standalone.map(payment => <article key={payment._id} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 py-4"><div><h4 className="font-bold text-slate-950">{payment.receiptNumber || payment.paymentNumber}</h4><p className="text-sm text-slate-600">{payment.paymentPurpose === 'SECURITY_DEPOSIT' ? 'Security deposit' : payment.paymentPurpose === 'REFUND' ? 'Refund' : 'Payment'} &middot; {ledgerDate(payment.paymentDate)} &middot; {payment.paymentStatus}</p></div><div className="flex flex-wrap items-center gap-3"><strong>{money(payment.amount)}</strong>{props.canReceipt && receiptButton(payment)}</div></article>)}
    </section>
  </div>;
}
