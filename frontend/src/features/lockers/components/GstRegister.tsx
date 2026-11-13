import { Download } from 'lucide-react';
import { usePermission } from '../../../hooks/usePermission';
import { reportService } from '../../../services/reportService';
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
 const canExport = usePermission('reports.export');
 const [exporting, setExporting] = useState(false);
 const [exportError, setExportError] = useState('');
 const [from, setFrom] = useState(() => today().slice(0, 7) + '-01');
 const [to, setTo] = useState(today);
 const [page, setPage] = useState(1);
 const valid = !!from && !!to && from <= to;
 const report = useQuery({ queryKey: ['gst-register', from, to, page], enabled: valid, queryFn: async ({ signal }) => (await apiClient.get('/reports/gst', { params: { from, to, page }, signal })).data.data as GstReport });
 const data = report.data;
 return <section aria-label="GST register" className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
  <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-950">GST details</h2></div><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!valid || report.isFetching} onClick={() => report.refetch()}>Refresh</Button>{canExport && <Button disabled={!valid || exporting || report.isPending || report.isError || !data?.summary.count} onClick={async () => { setExporting(true); setExportError(''); try { await reportService.exportGst(from, to); } catch (error) { setExportError(error instanceof Error ? error.message : 'Could not export GST.'); } finally { setExporting(false); } }} className="gap-2 bg-emerald-800 text-white hover:bg-emerald-900"><Download className="h-4 w-4" />{exporting ? 'Exporting...' : 'Export Excel'}</Button>}</div></div>
  <div className="flex flex-wrap gap-4"><label className="text-sm font-semibold text-slate-700">From date<input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} className="mt-1 block rounded-xl border border-slate-300 p-2 font-normal" /></label><label className="text-sm font-semibold text-slate-700">To date<input type="date" value={to} min={from} onChange={e => { setTo(e.target.value); setPage(1); }} className="mt-1 block rounded-xl border border-slate-300 p-2 font-normal" /></label></div>
  {exportError && <p role="alert" className="text-sm text-red-700">{exportError}</p>}
  {!valid ? <p role="alert" className="text-red-700">Select a valid date range.</p> : report.isPending ? <p role="status">Loading GST details...</p> : report.isError ? <div role="alert">Could not load GST details. <Button variant="outline" onClick={() => report.refetch()}>Retry GST</Button></div> : data && <>
   <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Bills', data.summary.count.toLocaleString('en-IN')], ['Rent before GST', money(data.summary.baseRent)], ['GST billed', money(data.summary.taxAmount)], ['Invoice total', money(data.summary.totalAmount)]].map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-100 p-4"><p className="text-sm text-slate-600">{label}</p><p className="mt-1 break-words text-xl font-bold text-slate-950">{value}</p></div>)}</div>
   {data.summary.unitemizedCount > 0 && <p role="status" className="text-sm text-amber-800">GST not itemized in {data.summary.unitemizedCount} imported bills.</p>}
   <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[1000px] text-left text-sm"><caption className="sr-only">Invoice GST breakdown</caption><thead className="bg-slate-100 text-slate-700"><tr>{['Bill / date', 'Customer / locker', 'Rent before GST', 'Other / discount', 'GST recorded', 'Bill total', 'Payment status'].map(label => <th key={label} scope="col" className="whitespace-nowrap p-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{data.invoices.map(row => <tr key={row._id}><td className="p-3"><strong>{row.invoiceNumber}</strong><div className="text-slate-600">{new Date(row.issueDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</div></td><td className="p-3">{row.customerId?.fullName || 'Not recorded'}<div className="text-slate-600">{row.customerId?.customerCode} &bull; Locker {row.lockerId?.lockerNumber || 'Not recorded'}</div></td><td className="p-3 tabular-nums">{money(row.baseRent)}</td><td className="p-3 tabular-nums">{money(row.totalAmount - row.taxAmount - row.baseRent)}</td><td className="p-3 font-semibold tabular-nums text-emerald-800">{money(row.taxAmount)}{row.source === 'LEGACY_IMPORT' && row.taxAmount === 0 && <div className="text-xs font-normal text-amber-800">Not itemized in import</div>}</td><td className="p-3 font-semibold tabular-nums">{money(row.totalAmount)}</td><td className="p-3">{row.paymentStatus.replace(/_/g, ' ')}<div className="text-xs text-slate-600">Balance: {money(row.balanceAmount)}</div></td></tr>)}</tbody></table>{!data.invoices.length && <p className="p-6 text-center text-slate-600">No bills in this date range.</p>}</div>
   <div className="flex flex-wrap items-center justify-end gap-3"><Button variant="outline" disabled={page <= 1 || report.isFetching} onClick={() => setPage(p => p - 1)}>Previous GST page</Button><span className="text-sm">Page {data.page} of {data.totalPages}</span><Button variant="outline" disabled={page >= data.totalPages || report.isFetching} onClick={() => setPage(p => p + 1)}>Next GST page</Button></div>
  </>}
 </section>;
}
