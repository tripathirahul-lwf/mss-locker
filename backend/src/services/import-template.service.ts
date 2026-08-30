import ExcelJS from 'exceljs';

type Row = Record<string, string | number>;

export class ImportTemplateService {
  private addObjectSheet(workbook: ExcelJS.Workbook, name: string, rows: Row[]): void {
    const sheet = workbook.addWorksheet(name);
    const headers = Object.keys(rows[0] || {});
    sheet.columns = headers.map((header) => ({ header, key: header, width: Math.max(14, Math.min(35, header.length + 4)) }));
    rows.forEach((row) => sheet.addRow(row));
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    if (headers.length) sheet.autoFilter = { from: 'A1', to: `${sheet.getColumn(headers.length).letter}1` };
    sheet.getRow(1).font = { bold: true };
  }

  private async toBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async generateFullMigrationTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MSS Locker';
    const instructions = workbook.addWorksheet('Instructions');
    instructions.addRows([
      ['MSS LOCKER - DATA MIGRATION TEMPLATE'], [],
      ['SHEET', 'PURPOSE', 'KEY REQUIREMENTS'],
      ['Lockers', 'Locker inventory and current tenancy', 'Locker Number and Rack Number required; size A-G2; status VACANT/OCCUPIED'],
      ['Renewal History', 'Historical bills and payments', 'Locker Number, Due Date and positive Total Amount required'], [],
      ['Dates', 'Use DD/MM/YYYY or YYYY-MM-DD'],
      ['Amounts', 'Use numbers only, without currency symbols'],
      ['KYC ID Types', 'AADHAAR, PAN, PASSPORT, VOTER_ID, DRIVING_LICENSE'],
    ]);
    instructions.getColumn(1).width = 24;
    instructions.getColumn(2).width = 38;
    instructions.getColumn(3).width = 80;
    instructions.getRow(1).font = { bold: true, size: 14 };
    this.addObjectSheet(workbook, 'Lockers', [{
      'Locker Number': '101', 'Locker Size': 'A', 'Rack Number': 'R-01', Section: 'Main Section',
      'Annual Rent': 3500, 'Security Deposit': 5000, Status: 'OCCUPIED', 'Customer Name': 'Rahul Sharma',
      'Customer Code': 'CUS-000101', Phone: '9876543210', 'Alternate Phone': '', Email: 'rahul@example.com',
      Address: 'Mumbai', City: 'Mumbai', 'ID Type': 'AADHAAR', 'ID Number': '541289632145',
      'Start Date': '01/04/2023', 'Renewal Due Date': '31/03/2025',
    }]);
    this.addObjectSheet(workbook, 'Renewal History', [{
      'Locker Number': '101', 'Customer Name': 'Rahul Sharma', 'Invoice Number': 'LEG-2024-0101',
      'Billing Period Start': '01/04/2024', 'Billing Period End': '31/03/2025', 'Due Date': '01/04/2024',
      'Total Amount': 3500, 'Paid Amount': 3500, 'Payment Status': 'PAID', 'Payment Date': '02/04/2024',
      'Payment Method': 'CASH',
    }]);
    return this.toBuffer(workbook);
  }

  async generateLockersTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    this.addObjectSheet(workbook, 'Lockers', [{
      'Locker Number': '101', 'Locker Size': 'A', 'Rack Number': 'R-01', Section: 'Main Section',
      'Annual Rent': 3500, 'Security Deposit': 5000, Status: 'VACANT', 'Master Key Reference': 'MK-01',
    }]);
    return this.toBuffer(workbook);
  }

  async generateCustomerTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    this.addObjectSheet(workbook, 'Customers', [{
      'Full Name': 'Amit Kumar', 'Customer Code': 'CUS-000001', Phone: '9876543210', 'Alternate Phone': '',
      Email: 'amit@example.com', Address: 'Mumbai', City: 'Mumbai', 'ID Type': 'AADHAAR', 'ID Number': '123456789012',
    }]);
    return this.toBuffer(workbook);
  }
}

export const importTemplateService = new ImportTemplateService();
