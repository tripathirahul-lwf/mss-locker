import { LockerAllocation } from '../models/LockerAllocation';
import { LockerInvoice } from '../models/LockerInvoice';
import { PERMISSIONS } from '../constants/permissions';
import { LockerService } from '../services/locker.service';
import { lockerQuerySchema } from '../validators/locker.validator';
import { NextFunction,Request,Response } from 'express';
import ExcelJS from 'exceljs';
import { reportService } from '../services/report.service';
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
