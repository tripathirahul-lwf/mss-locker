import mongoose from 'mongoose';
import { LockerAllocation } from '../models/LockerAllocation';
import { LockerInvoice } from '../models/LockerInvoice';
import { PERMISSIONS } from '../constants/permissions';
import { LockerService } from '../services/locker.service';
import { lockerQuerySchema } from '../validators/locker.validator';
import { NextFunction,Request,Response } from 'express';
import ExcelJS from 'exceljs';
import { reportRange, reportService } from '../services/report.service';
import { successResponse } from '../utils/apiResponse';

export const getReportOverview = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(successResponse('Operational report generated', await reportService.overview(req.query.from as string, req.query.to as string))); }
  catch (error) { next(error); }
};

export const exportReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await reportService.overview(req.query.from as string, req.query.to as string, 10000);
    if (report.overdueTruncated) throw Object.assign(new Error('Overdue export exceeds 10,000 invoices. Use the paginated invoice register for the full ledger.'), { statusCode: 413 });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MSS Locker';
    const summary = workbook.addWorksheet('Summary');
    summary.addRows([['Metric', 'Value'], ...Object.entries(report.summary)]);
    summary.getRow(1).font = { bold: true };
    const methods = workbook.addWorksheet('Collections by Method');
    methods.addRows([['Method', 'Transactions', 'Amount'], ...report.collectionsByMethod.map((r) => [r.method, r.count, r.amount])]);
    methods.getRow(1).font = { bold: true };
    const overdue = workbook.addWorksheet('Overdue Register');
    overdue.addRow(['Invoice', 'Customer', 'Phone', 'Locker', 'Due Date', 'Balance']);
    for (const row of report.overdue as any[]) overdue.addRow([row.invoiceNumber, row.customerId?.fullName, row.customerId?.phone, row.lockerId?.lockerNumber, row.dueDate, row.balanceAmount]);
    overdue.getRow(1).font = { bold: true };
    for (const sheet of workbook.worksheets) sheet.columns.forEach((column) => { column.width = 20; });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="vault-report-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) { next(error); }
};


export const exportLockerDues = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!['OVERDUE', 'DUE_SOON'].includes(String(req.query.status))) throw Object.assign(new Error('Choose Overdue or Due Soon.'), { statusCode: 400 });
    const params = lockerQuerySchema.parse({ ...req.query, page: 1, limit: 2000, compact: true });
    const sensitive = !!req.user?.isSuperAdmin || !!req.user?.permissions.includes(PERMISSIONS.LOCKERS_VIEW_SENSITIVE);
    const result = await LockerService.getLockers({ ...params, limit: 10001 }, sensitive);
    if (result.pagination.total > 10000) throw Object.assign(new Error('Export exceeds 10,000 lockers. Narrow the search or size filter.'), { statusCode: 413 });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(params.status === 'OVERDUE' ? 'Overdue lockers' : 'Due soon lockers');
    const allocations = await LockerAllocation.find({ lockerId: { $in: result.lockers.map(item => item._id) }, status: 'ACTIVE' }).select('_id lockerId').lean();
    const allocationLockers = new Map(allocations.map(item => [String(item._id), String(item.lockerId)]));
    const invoices = await LockerInvoice.find({ allocationId: { $in: allocations.map(item => item._id) }, status: { $nin: ['CANCELLED', 'DRAFT'] }, balanceAmount: { $gt: 0 } }).select('allocationId dueDate balanceAmount').lean();
    const balances = new Map<string, { amount: number; count: number; due?: Date }>();
    for (const invoice of invoices) {
      const lockerId = allocationLockers.get(String(invoice.allocationId)); if (!lockerId) continue;
      const summary = balances.get(lockerId) || { amount: 0, count: 0, due: undefined };
      summary.amount = Math.round((summary.amount + invoice.balanceAmount) * 100) / 100; summary.count++;
      if (!summary.due || invoice.dueDate < summary.due) summary.due = invoice.dueDate;
      balances.set(lockerId, summary);
    }
    const calendarDate = (value?: string | Date) => {
      if (!value || !Number.isFinite(new Date(value).getTime())) return null;
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
      return new Date(day + 'T00:00:00Z');
    };
    sheet.addRow(['Locker', 'Size', 'Rack', 'Customer', 'Customer code', 'Phone', 'Renewal date', 'Earliest pending bill due', 'Pending bills', 'Total pending bill balance (INR)', 'Status']);
    for (const item of result.lockers as any[]) {
      const balance = balances.get(String(item._id));
      sheet.addRow([String(item.lockerNumber), item.size, item.rackNumber, item.tenantName || '', item.tenantCode || '', String(item.tenantPhone || ''), calendarDate(item.nextRenewalDueDate), calendarDate(balance?.due), balance?.count || 0, balance?.amount || 0, params.status === 'OVERDUE' ? 'Overdue' : 'Due Soon']);
    }
    sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: 'A1', to: 'K1' }; sheet.columns.forEach(column => { column.width = 24; });
    sheet.getColumn(1).numFmt = '@'; sheet.getColumn(6).numFmt = '@';
    sheet.getColumn(7).numFmt = 'dd/mm/yyyy'; sheet.getColumn(8).numFmt = 'dd/mm/yyyy';
    sheet.getColumn(10).numFmt = '#,##0.00';
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="lockers-${params.status!.toLowerCase()}.xlsx"`);
    await workbook.xlsx.write(res); res.end();
  } catch (error) { next(error); }
};


export const getGstRegister = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exporting = req.path.endsWith('/export');
    const { start, end } = reportRange(req.query.from as string, req.query.to as string);
    if (!exporting && req.query.page !== undefined && (typeof req.query.page !== 'string' || !/^\d+$/.test(req.query.page))) throw Object.assign(new Error('Invalid page'), { statusCode: 400 });
    const requestedPage = exporting ? 1 : Number(req.query.page ?? 1);
    if (!Number.isSafeInteger(requestedPage) || requestedPage < 1 || requestedPage > 100000) throw Object.assign(new Error('Invalid page'), { statusCode: 400 });
    const match = { status: { $in: ['ISSUED', 'PAID'] }, issueDate: { $gte: start, $lte: end } };
    // A zero tax field alone does not establish exemption, including SYSTEM bills made by old imports.
    const reviewCondition = { $and: [{ $lte: [{ $ifNull: ['$taxAmount', 0] }, 0] }, { $gt: ['$totalAmount', 0] }] };
    const moneySum = (field: string) => ({ $sum: { $round: [{ $ifNull: ['$' + field, 0] }, 2] } });
    let totals: any;
    let invoices: any[] = [];
    let page = 1;
    // Keep summary and rows on the same ledger snapshot while payments/edits may run concurrently.
    await mongoose.connection.transaction(async session => {
      const summary = await LockerInvoice.aggregate([
        { $match: match },
        { $group: { _id: null, count: { $sum: 1 }, baseRent: moneySum('baseRent'), adjustments: { $sum: { $round: [{ $subtract: [{ $subtract: ['$totalAmount', { $ifNull: ['$taxAmount', 0] }] }, '$baseRent'] }, 2] } }, taxAmount: moneySum('taxAmount'), rentGstTotal: { $sum: { $round: [{ $add: [{ $ifNull: ['$baseRent', 0] }, { $ifNull: ['$taxAmount', 0] }] }, 2] } }, totalAmount: moneySum('totalAmount'), paidAmount: moneySum('paidAmount'), balanceAmount: moneySum('balanceAmount'), unitemizedCount: { $sum: { $cond: [reviewCondition, 1, 0] } } } },
      ]).session(session);
      totals = summary[0] || { count: 0, baseRent: 0, adjustments: 0, taxAmount: 0, rentGstTotal: 0, totalAmount: 0, paidAmount: 0, balanceAmount: 0, unitemizedCount: 0 };
      delete totals._id;
      for (const field of ['baseRent', 'adjustments', 'taxAmount', 'rentGstTotal', 'totalAmount', 'paidAmount', 'balanceAmount']) totals[field] = Math.round((totals[field] + Number.EPSILON) * 100) / 100;
      if (exporting && totals.count > 10000) throw Object.assign(new Error('Export exceeds 10,000 bills. Select a shorter date range.'), { statusCode: 413 });
      page = Math.min(requestedPage, Math.max(1, Math.ceil(totals.count / 25)));
      invoices = await LockerInvoice.find(match).select('invoiceNumber invoiceType source issueDate baseRent taxAmount totalAmount paidAmount balanceAmount paymentStatus customerId lockerId').populate('customerId', 'fullName customerCode').populate('lockerId', 'lockerNumber size').sort({ issueDate: -1, _id: -1 }).skip((page - 1) * 25).limit(exporting ? 10000 : 25).session(session).lean();
    }, { readConcern: { level: 'snapshot' } });
    for (const row of invoices) {
      for (const field of ['baseRent', 'taxAmount', 'totalAmount', 'paidAmount', 'balanceAmount']) row[field] = Number.isFinite(row[field]) ? Math.round((row[field] + Number.EPSILON) * 100) / 100 : 0;
      row.rentGstTotal = Math.round((row.baseRent + row.taxAmount + Number.EPSILON) * 100) / 100;
    }
    res.setHeader('Cache-Control', 'private, no-store');
    if (exporting) {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('GST bills');
      sheet.addRow(['Bill', 'Issue date', 'Customer', 'Customer code', 'Locker', 'Rent before GST (INR)', 'GST recorded (INR)', 'Rent + GST (INR)', 'Invoice payment status', 'GST note']);
      for (const row of invoices as any[]) {
        const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(row.issueDate);
        sheet.addRow([row.invoiceNumber, new Date(day + 'T00:00:00Z'), row.customerId?.fullName || '', row.customerId?.customerCode || '', String(row.lockerId?.lockerNumber || ''), row.baseRent, row.taxAmount, row.rentGstTotal, row.paymentStatus, !(row.taxAmount > 0) && row.totalAmount > 0 ? 'Zero/missing GST; review original bill' : '']);
      }
      sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: 'frozen', ySplit: 1 }]; sheet.autoFilter = 'A1:J1';
      sheet.columns.forEach(column => { column.width = 24; });
      sheet.getColumn(2).numFmt = 'dd/mm/yyyy'; sheet.getColumn(5).numFmt = '@';
      for (let column = 6; column <= 8; column++) sheet.getColumn(column).numFmt = '#,##0.00';
      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.addRows([['Period from (IST)', start.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })], ['Period to (IST)', end.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })], ['Bills', totals.count], ['Rent before GST (INR)', totals.baseRent], ['Recorded GST (INR)', totals.taxAmount], ['Rent + GST (INR)', totals.rentGstTotal], ['Zero/missing GST bills to review', totals.unitemizedCount], ['Basis', 'Recorded rent + GST only; not net tax payable.'], ['Exclusions', 'KYC and other charges, draft/cancelled bills and refundable deposits.']]);
      summarySheet.getColumn(1).width = 36; summarySheet.getColumn(2).width = 75;
      for (let row = 4; row <= 6; row++) summarySheet.getCell(row, 2).numFmt = '#,##0.00';
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="gst-register.xlsx"');
      await workbook.xlsx.write(res); res.end(); return;
    }
    res.json(successResponse('Recorded invoice GST register', { summary: totals, invoices, page, totalPages: Math.max(1, Math.ceil(totals.count / 25)) }));
  } catch (error) { next(error); }
};
