import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../services/apiClient';
import { Button } from '../../../components/ui/button';

interface GstReport {
 summary: { count: number; baseRent: number; adjustments: number; taxAmount: number; totalAmount: number; paidAmount: number; balanceAmount: number; unitemizedCount: number };
 invoices: { _id: string; invoiceNumber: string; source: string; issueDate: string; baseRent: number; taxAmount: number; totalAmount: number; paidAmount: number; balanceAmount: number; paymentStatus: string; customerId?: { fullName: string; customerCode: string }; lockerId?: { lockerNumber: string } }[];
 page: number; totalPages: number;
}
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function GstRegister() {
 const [from, setFrom] = useState(() => today().slice(0, 7) + '-01');
 const [to, setTo] = useState(today);
 const [page, setPage] = useState(1);
 const valid = !!from && !!to && from <= to;
 const report = useQuery({ queryKey: ['gst-register', from, to, page], enabled: valid, queryFn: async ({ signal }) => (await apiClient.get('/reports/gst', { params: { from, to, page }, signal })).data.data as GstReport });
 const data = report.data;
 return <section aria-label="GST register" className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
  <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-950">GST details</h2><p className="mt-1 text-sm text-slate-600">Bill-wise GST recorded in the selected invoice issue-date period (India time).</p></div><Button variant="outline" disabled={!valid || report.isFetching} onClick={() => report.refetch()}>Refresh GST</Button></div>
  <div className="flex flex-wrap gap-4"><label className="text-sm font-semibold text-slate-700">From date<input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} className="mt-1 block rounded-xl border border-slate-300 p-2 font-normal" /></label><label className="text-sm font-semibold text-slate-700">To date<input type="date" value={to} min={from} onChange={e => { setTo(e.target.value); setPage(1); }} className="mt-1 block rounded-xl border border-slate-300 p-2 font-normal" /></label></div>
  <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">This is invoice GST billed, including unpaid bills. It is not a record of GST paid to the government or net tax payable after credits. Draft/cancelled bills and refundable security deposits are excluded. CGST/SGST/IGST splits are not recorded in the current ledger.</p>
  {!valid ? <p role="alert" className="text-red-700">Select a valid date range.</p> : report.isPending ? <p role="status">Loading GST details...</p> : report.isError ? <div role="alert">Could not load GST details. <Button variant="outline" onClick={() => report.refetch()}>Retry GST</Button></div> : data && <>
   <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Bills', data.summary.count.toLocaleString('en-IN')], ['Rent before GST', money(data.summary.baseRent)], ['GST billed', money(data.summary.taxAmount)], ['Invoice total', money(data.summary.totalAmount)]].map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-100 p-4"><p className="text-sm text-slate-600">{label}</p><p className="mt-1 break-words text-xl font-bold text-slate-950">{value}</p></div>)}</div>
   <p className="text-sm text-slate-600">Other charges / discounts (net): {money(data.summary.adjustments)} &bull; Invoice payments recorded: {money(data.summary.paidAmount)} &bull; Outstanding invoice balance: {money(data.summary.balanceAmount)}</p>
   {data.summary.unitemizedCount > 0 && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{data.summary.unitemizedCount} imported bill(s) have no separately recorded GST. Their tax is not estimated here; review the original bills before preparing a return.</p>}
   <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[1000px] text-left text-sm"><caption className="sr-only">Invoice GST breakdown</caption><thead className="bg-slate-100 text-slate-700"><tr>{['Bill / date', 'Customer / locker', 'Rent before GST', 'Other / discount', 'GST recorded', 'Bill total', 'Payment status'].map(label => <th key={label} scope="col" className="whitespace-nowrap p-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{data.invoices.map(row => <tr key={row._id}><td className="p-3"><strong>{row.invoiceNumber}</strong><div className="text-slate-600">{new Date(row.issueDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</div></td><td className="p-3">{row.customerId?.fullName || 'Not recorded'}<div className="text-slate-600">{row.customerId?.customerCode} &bull; Locker {row.lockerId?.lockerNumber || 'Not recorded'}</div></td><td className="p-3 tabular-nums">{money(row.baseRent)}</td><td className="p-3 tabular-nums">{money(row.totalAmount - row.taxAmount - row.baseRent)}</td><td className="p-3 font-semibold tabular-nums text-emerald-800">{money(row.taxAmount)}{row.source === 'LEGACY_IMPORT' && row.taxAmount === 0 && <div className="text-xs font-normal text-amber-800">Not itemized in import</div>}</td><td className="p-3 font-semibold tabular-nums">{money(row.totalAmount)}</td><td className="p-3">{row.paymentStatus.replace(/_/g, ' ')}<div className="text-xs text-slate-600">Balance: {money(row.balanceAmount)}</div></td></tr>)}</tbody></table>{!data.invoices.length && <p className="p-6 text-center text-slate-600">No bills in this date range.</p>}</div>
   <div className="flex flex-wrap items-center justify-end gap-3"><Button variant="outline" disabled={page <= 1 || report.isFetching} onClick={() => setPage(p => p - 1)}>Previous GST page</Button><span className="text-sm">Page {data.page} of {data.totalPages}</span><Button variant="outline" disabled={page >= data.totalPages || report.isFetching} onClick={() => setPage(p => p + 1)}>Next GST page</Button></div>
  </>}
 </section>;
}
