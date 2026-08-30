import { Locker } from '../models/Locker';
import { LockerInvoice } from '../models/LockerInvoice';
import { Payment } from '../models/Payment';

const range = (from?: string, to?: string) => {
  const end = to ? new Date(`${to}T23:59:59.999Z`) : new Date();
  const start = from ? new Date(`${from}T00:00:00.000Z`) : new Date(Date.UTC(end.getUTCFullYear(), 0, 1));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) throw Object.assign(new Error('Invalid report date range'), { statusCode: 400 });
  return { start, end };
};

export class ReportService {
  async overview(from?: string, to?: string) {
    const { start, end } = range(from, to);
    const [occupancy, collections, monthly, invoices, overdue] = await Promise.all([
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
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$paymentDate' } }, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      LockerInvoice.aggregate([
        { $match: { status: { $ne: 'CANCELLED' }, issueDate: { $gte: start, $lte: end } } },
        { $group: { _id: null, billed: { $sum: '$totalAmount' }, paid: { $sum: '$paidAmount' }, outstanding: { $sum: '$balanceAmount' }, tax: { $sum: '$taxAmount' }, count: { $sum: 1 } } },
      ]),
      LockerInvoice.find({ status: { $ne: 'CANCELLED' }, balanceAmount: { $gt: 0 }, dueDate: { $lt: new Date() } })
        .select('invoiceNumber customerId lockerId dueDate totalAmount paidAmount balanceAmount')
        .populate('customerId', 'customerCode fullName phone').populate('lockerId', 'lockerNumber lockerCode size')
        .sort({ dueDate: 1 }).limit(200).lean(),
    ]);
    const occupancyBySize: Record<string, Record<string, number>> = {};
    for (const row of occupancy) (occupancyBySize[row._id.size] ??= {})[row._id.status] = row.count;
    const totalLockers = occupancy.reduce((sum, row) => sum + row.count, 0);
    const occupiedLockers = occupancy.filter((row) => row._id.status === 'OCCUPIED').reduce((sum, row) => sum + row.count, 0);
    const financials = invoices[0] || { billed: 0, paid: 0, outstanding: 0, tax: 0, count: 0 };
    return {
      period: { from: start.toISOString(), to: end.toISOString() },
      summary: { totalLockers, occupiedLockers, occupancyRate: totalLockers ? Number(((occupiedLockers / totalLockers) * 100).toFixed(1)) : 0, collections: collections.reduce((sum, row) => sum + row.amount, 0), ...financials, overdueAccounts: overdue.length },
      occupancyBySize,
      collectionsByMethod: collections.map((row) => ({ method: row._id, amount: row.amount, count: row.count })),
      monthlyCollections: monthly.map((row) => ({ month: row._id, amount: row.amount, count: row.count })),
      overdue,
    };
  }
}

export const reportService = new ReportService();
