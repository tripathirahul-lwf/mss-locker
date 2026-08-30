import { NextFunction, Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { reportService } from '../services/report.service';
import { successResponse } from '../utils/apiResponse';

export const getReportOverview = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(successResponse('Operational report generated', await reportService.overview(req.query.from as string, req.query.to as string))); }
  catch (error) { next(error); }
};

export const exportReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await reportService.overview(req.query.from as string, req.query.to as string);
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
