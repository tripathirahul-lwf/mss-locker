import { Locker } from '../models/Locker';
import { LockerInvoice } from '../models/LockerInvoice';
import { Payment } from '../models/Payment';

const IST_OFFSET = 330 * 60000;
export const reportRange = (from?: string, to?: string) => {
  const validDay = (day: unknown): day is string => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
  if ((from !== undefined && !validDay(from)) || (to !== undefined && !validDay(to))) throw Object.assign(new Error('Invalid report date range'), { statusCode: 400 });
  const end = to ? new Date(Date.parse(`${to}T00:00:00.000Z`) - IST_OFFSET + 86400000 - 1) : new Date();
  const year = new Date(end.getTime() + IST_OFFSET).getUTCFullYear();
  const start = from ? new Date(Date.parse(`${from}T00:00:00.000Z`) - IST_OFFSET) : new Date(Date.UTC(year, 0, 1) - IST_OFFSET);
  if (start > end) throw Object.assign(new Error('Invalid report date range'), { statusCode: 400 });
  return { start, end };
};

export class ReportService {
  async overview(from?: string, to?: string, overdueLimit = 200) {
    const { start, end } = reportRange(from, to);
    const overdueFilter = { status: { $in: ['ISSUED', 'PAID'] }, balanceAmount: { $gt: 0 }, dueDate: { $lt: new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())) } };
    const [occupancy, collections, monthly, invoices, overdue, overdueCount] = await Promise.all([
      Locker.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: { size: '$size', status: '$status' }, count: { $sum: 1 } } },
        { $sort: { '_id.size': 1, '_id.status': 1 } },
      ]),
      Payment.aggregate([
        { $match: { paymentStatus: 'COMPLETED', paymentDate: { $gte: start, $lte: end } } },
        { $group: { _id: '$paymentMethod', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { amount: -1 } },
      ]),
      Payment.aggregate([
        { $match: { paymentStatus: 'COMPLETED', paymentDate: { $gte: start, $lte: end } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$paymentDate', timezone: 'Asia/Kolkata' } }, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      LockerInvoice.aggregate([
        { $match: { status: { $in: ['ISSUED', 'PAID'] }, issueDate: { $gte: start, $lte: end } } },
        { $group: { _id: null, billed: { $sum: '$totalAmount' }, paid: { $sum: '$paidAmount' }, outstanding: { $sum: '$balanceAmount' }, tax: { $sum: '$taxAmount' }, count: { $sum: 1 } } },
      ]),
      LockerInvoice.find(overdueFilter)
        .select('invoiceNumber customerId lockerId dueDate totalAmount paidAmount balanceAmount')
        .populate('customerId', 'customerCode fullName phone').populate('lockerId', 'lockerNumber lockerCode size')
        .sort({ dueDate: 1, _id: 1 }).limit(overdueLimit).lean(),
      LockerInvoice.countDocuments(overdueFilter),
    ]);
    const occupancyBySize: Record<string, Record<string, number>> = {};
    for (const row of occupancy) (occupancyBySize[row._id.size] ??= {})[row._id.status] = row.count;
    const totalLockers = occupancy.reduce((sum, row) => sum + row.count, 0);
    const occupiedLockers = occupancy.filter((row) => row._id.status === 'OCCUPIED').reduce((sum, row) => sum + row.count, 0);
    const financials = invoices[0] || { billed: 0, paid: 0, outstanding: 0, tax: 0, count: 0 };
    return {
      period: { from: start.toISOString(), to: end.toISOString() },
      summary: { totalLockers, occupiedLockers, occupancyRate: totalLockers ? Number(((occupiedLockers / totalLockers) * 100).toFixed(1)) : 0, collections: collections.reduce((sum, row) => sum + row.amount, 0), ...financials, overdueAccounts: overdueCount },
      occupancyBySize,
      collectionsByMethod: collections.map((row) => ({ method: row._id, amount: row.amount, count: row.count })),
      monthlyCollections: monthly.map((row) => ({ month: row._id, amount: row.amount, count: row.count })),
      overdue,
      overdueTruncated: overdueCount > overdue.length,
      overdueTotal: overdueCount,
    };
  }
}

export const reportService = new ReportService();
