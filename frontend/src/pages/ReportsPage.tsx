import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, IndianRupee, KeyRound, Receipt, TriangleAlert } from 'lucide-react';
import { reportService } from '../services/reportService';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { usePermission } from '../hooks/usePermission';

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const money = (value = 0) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export function ReportsPage() {
  const now = new Date();
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`);
  const [to, setTo] = useState(isoDate(now));
  const canExport = usePermission('reports.export');
  const { data, isLoading, isError } = useQuery({ queryKey: ['operational-report', from, to], queryFn: () => reportService.overview(from, to), enabled: Boolean(from && to && from <= to) });
  const cards = [
    ['Occupancy', `${data?.summary.occupancyRate || 0}%`, `${data?.summary.occupiedLockers || 0} of ${data?.summary.totalLockers || 0} lockers`, KeyRound],
    ['Collections', money(data?.summary.collections), 'Completed manual entries', IndianRupee],
    ['Outstanding', money(data?.summary.outstanding), `${data?.summary.count || 0} invoices in period`, Receipt],
    ['Overdue Accounts', data?.summary.overdueAccounts || 0, 'Oldest 200 shown below', TriangleAlert],
  ] as const;
  return <div className="space-y-5">
    <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-slate-100"><BarChart3 className="h-6 w-6" /></div><div><h1 className="text-xl font-bold text-slate-900">Operational Reports & Statements</h1><p className="text-sm text-slate-500">Live occupancy, collections, billing and overdue register</p></div></div>
      <div className="flex flex-wrap items-end gap-2"><label className="text-xs font-semibold text-slate-600">From<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1" /></label><label className="text-xs font-semibold text-slate-600">To<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1" /></label>{canExport && <Button disabled={!data} onClick={() => reportService.exportExcel(from, to)} className="gap-2"><Download className="h-4 w-4" />Excel</Button>}</div>
    </section>
    {isError && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Report could not be generated. Check the selected date range.</div>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([title, value, subtitle, Icon]) => <div key={title} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</span><Icon className="h-5 w-5 text-blue-700" /></div><div className="mt-2 text-2xl font-bold text-slate-900">{isLoading ? '…' : value}</div><div className="mt-1 text-xs text-slate-500">{subtitle}</div></div>)}</section>
    <section className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">Occupancy by Locker Size</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-2 text-left">Size</th><th>Occupied</th><th>Vacant</th><th>Reserved</th><th>Blocked</th></tr></thead><tbody>{Object.entries(data?.occupancyBySize || {}).map(([size, states]) => <tr key={size} className="border-t text-center"><td className="p-2 text-left font-bold">{size}</td><td>{states.OCCUPIED || 0}</td><td>{states.VACANT || 0}</td><td>{states.RESERVED || 0}</td><td>{states.BLOCKED || 0}</td></tr>)}</tbody></table></div></div>
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">Collections by Method</h2><div className="mt-4 space-y-3">{data?.collectionsByMethod.map((row) => <div key={row.method} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2"><div><div className="text-sm font-bold text-slate-800">{row.method.split('_').join(' ')}</div><div className="text-xs text-slate-500">{row.count} entries</div></div><span className="font-bold">{money(row.amount)}</span></div>)}{!data?.collectionsByMethod.length && <p className="text-sm text-slate-500">No collections in this period.</p>}</div></div>
    </section>
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="border-b p-4"><h2 className="font-bold text-slate-900">Overdue Register</h2></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-3 text-left">Invoice</th><th className="p-3 text-left">Customer</th><th className="p-3 text-left">Locker</th><th className="p-3 text-left">Due Date</th><th className="p-3 text-right">Balance</th></tr></thead><tbody>{data?.overdue.map((row) => <tr key={row._id} className="border-t"><td className="p-3 font-mono text-xs">{row.invoiceNumber}</td><td className="p-3"><div className="font-semibold">{row.customerId?.fullName || '—'}</div><div className="text-xs text-slate-500">{row.customerId?.phone}</div></td><td className="p-3">{row.lockerId?.lockerNumber || '—'}</td><td className="p-3">{new Date(row.dueDate).toLocaleDateString('en-IN')}</td><td className="p-3 text-right font-bold text-red-700">{money(row.balanceAmount)}</td></tr>)}{!data?.overdue.length && <tr><td colSpan={5} className="p-8 text-center text-slate-500">No overdue invoices.</td></tr>}</tbody></table></div></section>
  </div>;
}
