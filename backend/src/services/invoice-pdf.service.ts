import PDFDocument from 'pdfkit';
import { billingService } from './billing.service';
import { Payment } from '../models/Payment';
import { SystemSetting } from '../models/SystemSetting';

const COLORS = { navy: '#0f172a', blue: '#1d4ed8', slate: '#475569', light: '#f8fafc', line: '#cbd5e1', green: '#047857', red: '#be123c', white: '#ffffff' };
const money = (value: number) => `INR ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (value: Date | string) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const underHundred = (n: number) => n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`;
const underThousand = (n: number) => `${n >= 100 ? `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' : ''}` : ''}${underHundred(n % 100)}`;
export const amountInWords = (value: number) => {
  let n = Math.floor(Math.abs(value)); if (!n) return 'Rupees Zero Only';
  const parts: string[] = [];
  const units: Array<[number, string]> = [[10_000_000, 'Crore'], [100_000, 'Lakh'], [1_000, 'Thousand']];
  for (const [divisor, label] of units) if (n >= divisor) { const part = Math.floor(n / divisor); parts.push(`${underThousand(part)} ${label}`); n %= divisor; }
  if (n) parts.push(underThousand(n));
  const paise = Math.round((Math.abs(value) - Math.floor(Math.abs(value))) * 100);
  return `Rupees ${parts.join(' ')}${paise ? ` and ${underHundred(paise)} Paise` : ''} Only`;
};

const box = (doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number, fill = COLORS.white) => doc.roundedRect(x, y, width, height, 5).fillAndStroke(fill, COLORS.line);
const labelValue = (doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, width: number) => {
  doc.fillColor(COLORS.slate).font('Helvetica-Bold').fontSize(7).text(label.toUpperCase(), x, y, { width });
  doc.fillColor(COLORS.navy).font('Helvetica').fontSize(9).text(value || '-', x, y + 12, { width, ellipsis: true });
};

export class InvoicePdfService {
  async generate(invoiceId: string): Promise<{ buffer: Buffer; invoiceNumber: string }> {
    const invoice: any = await billingService.getInvoiceById(invoiceId);
    if (!invoice) throw Object.assign(new Error('Invoice not found'), { statusCode: 404 });
    const [settings, payments] = await Promise.all([
      SystemSetting.findOne({ key: 'GLOBAL' }).lean(),
      Payment.find({ invoiceId: invoice._id, paymentStatus: 'COMPLETED' }).select('receiptNumber paymentDate paymentMethod amount transactionReference bankReference upiReference chequeNumber').sort({ paymentDate: 1 }).lean(),
    ]);
    const customer = invoice.customerId || {}; const locker = invoice.lockerId || {}; const allocation = invoice.allocationId || {};
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: 'A4', margins: { top: 34, right: 38, bottom: 34, left: 38 }, info: { Title: `Invoice ${invoice.invoiceNumber}`, Author: settings?.businessName || 'MSS Locker', Subject: 'Locker rental invoice', Keywords: 'invoice locker rental' }, bufferPages: true, compress: true });
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    const completion = new Promise<Buffer>((resolve, reject) => { doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
    const left = 38; const width = 519;

    doc.rect(0, 0, 595.28, 106).fill(COLORS.navy);
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(21).text(settings?.businessName || 'MSS LOCKER', left, 30, { width: 310 });
    doc.font('Helvetica').fontSize(8).fillColor('#cbd5e1').text([settings?.branchName, settings?.address].filter(Boolean).join(' | ') || 'Safe Deposit Locker Services', left, 58, { width: 330, lineGap: 2 });
    if (settings?.gstin) doc.font('Helvetica-Bold').text(`GSTIN: ${settings.gstin}`, left, 84);
    doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.white).text('INVOICE', 380, 29, { width: 177, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor('#cbd5e1').text(invoice.invoiceNumber, 380, 55, { width: 177, align: 'right' });
    doc.text(invoice.invoiceType === 'LEGACY_IMPORT' ? 'Historical ledger document' : 'Original for recipient', 380, 74, { width: 177, align: 'right' });

    let y = 122;
    box(doc, left, y, width, 50, COLORS.light);
    labelValue(doc, 'Issue date', date(invoice.issueDate), left + 14, y + 10, 105);
    labelValue(doc, 'Due date', date(invoice.dueDate), left + 130, y + 10, 105);
    labelValue(doc, 'Billing period', `${date(invoice.billingPeriodStart)} - ${date(invoice.billingPeriodEnd)}`, left + 246, y + 10, 155);
    labelValue(doc, 'Status', invoice.status === 'CANCELLED' ? 'CANCELLED' : invoice.paymentStatus.replaceAll('_', ' '), left + 412, y + 10, 90);

    y = 186; box(doc, left, y, 253, 102); box(doc, left + 266, y, 253, 102);
    doc.fillColor(COLORS.blue).font('Helvetica-Bold').fontSize(8).text('BILL TO', left + 14, y + 12);
    doc.fillColor(COLORS.navy).fontSize(12).text(customer.fullName || 'Customer', left + 14, y + 29, { width: 220 });
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.slate).text(`Customer ID: ${customer.customerCode || '-'}`, left + 14, y + 49);
    doc.text(`Phone: ${customer.phone || '-'}`, left + 14, y + 62);
    doc.text([customer.address, customer.city, customer.state].filter(Boolean).join(', ') || 'Address not recorded', left + 14, y + 75, { width: 220, height: 22, ellipsis: true });
    doc.fillColor(COLORS.blue).font('Helvetica-Bold').fontSize(8).text('LOCKER & AGREEMENT', left + 280, y + 12);
    doc.fillColor(COLORS.navy).fontSize(12).text(`Locker ${locker.lockerNumber || '-'}`, left + 280, y + 29);
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.slate).text(`Size: ${locker.size || '-'}   |   Code: ${locker.lockerCode || '-'}`, left + 280, y + 49);
    doc.text(`Rack: ${locker.rackNumber || '-'}   |   Section: ${locker.section || '-'}`, left + 280, y + 62);
    doc.text(`Agreement: ${allocation.allocationCode || '-'}`, left + 280, y + 75);

    y = 304;
    doc.rect(left, y, width, 27).fill(COLORS.navy);
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(8).text('DESCRIPTION OF SERVICE', left + 10, y + 9, { width: 270 });
    doc.text('QTY', left + 300, y + 9, { width: 35, align: 'center' }); doc.text('RATE', left + 345, y + 9, { width: 75, align: 'right' }); doc.text('AMOUNT', left + 430, y + 9, { width: 79, align: 'right' });
    const rows: Array<[string, string, number]> = [['Locker rental / renewal service', invoice.billingCycle, invoice.baseRent]];
    if (invoice.lateFee) rows.push(['Late payment charge', '1', invoice.lateFee]);
    if (invoice.otherCharges) rows.push(['Other service charges', '1', invoice.otherCharges]);
    if (invoice.discount) rows.push(['Less: Discount', '1', -invoice.discount]);
    if (invoice.taxAmount) rows.push(['GST / Tax (as recorded)', '1', invoice.taxAmount]);
    let rowY = y + 27;
    for (const [description, qty, amount] of rows) {
      doc.rect(left, rowY, width, 25).fillAndStroke(rowY % 2 ? COLORS.white : COLORS.light, COLORS.line);
      doc.fillColor(COLORS.navy).font('Helvetica').fontSize(8).text(description, left + 10, rowY + 8, { width: 270 });
      doc.text(qty, left + 300, rowY + 8, { width: 35, align: 'center' }); doc.text(money(Math.abs(amount)), left + 345, rowY + 8, { width: 75, align: 'right' }); doc.font(amount < 0 ? 'Helvetica-Bold' : 'Helvetica').fillColor(amount < 0 ? COLORS.green : COLORS.navy).text(`${amount < 0 ? '-' : ''}${money(Math.abs(amount))}`, left + 430, rowY + 8, { width: 79, align: 'right' }); rowY += 25;
    }

    y = rowY + 14;
    const totalsX = left + 309; const totalsW = 210;
    const totalLine = (name: string, value: number, bold = false, color = COLORS.navy) => { doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 10 : 8).fillColor(color).text(name, totalsX, y, { width: 105 }); doc.text(money(value), totalsX + 105, y, { width: 105, align: 'right' }); y += bold ? 21 : 17; };
    totalLine('Taxable subtotal', invoice.subtotal); totalLine('Invoice total', invoice.totalAmount, true, COLORS.blue); totalLine('Paid to date', invoice.paidAmount, false, COLORS.green); totalLine('Balance due', invoice.balanceAmount, true, invoice.balanceAmount > 0 ? COLORS.red : COLORS.green);
    const wordsY = rowY + 14;
    doc.fillColor(COLORS.slate).font('Helvetica-Bold').fontSize(7).text('AMOUNT IN WORDS', left, wordsY);
    doc.fillColor(COLORS.navy).font('Helvetica').fontSize(8).text(amountInWords(invoice.totalAmount), left, wordsY + 13, { width: 285, lineGap: 2 });
    doc.fillColor(COLORS.slate).fontSize(7).text(`Reverse charge: No`, left, wordsY + 45);

    y = Math.max(y + 8, wordsY + 66);
    if (payments.length) {
      doc.fillColor(COLORS.blue).font('Helvetica-Bold').fontSize(8).text('PAYMENT RECEIPTS', left, y); y += 14;
      for (const payment of payments.slice(0, 5)) {
        const reference = payment.upiReference || payment.bankReference || payment.transactionReference || payment.chequeNumber || '-';
        doc.fillColor(COLORS.slate).font('Helvetica').fontSize(7.5).text(`${payment.receiptNumber}  |  ${date(payment.paymentDate)}  |  ${payment.paymentMethod.replaceAll('_', ' ')}  |  Ref: ${reference}`, left, y, { width: 390, ellipsis: true });
        doc.fillColor(COLORS.green).font('Helvetica-Bold').text(money(payment.amount), left + 420, y, { width: 99, align: 'right' }); y += 13;
      }
    }

    y = Math.min(Math.max(y + 8, 646), 704);
    doc.moveTo(left, y).lineTo(left + width, y).strokeColor(COLORS.line).stroke();
    doc.fillColor(COLORS.slate).font('Helvetica').fontSize(7).text(invoice.notes ? `Notes: ${invoice.notes}` : 'Computer-generated invoice based on the recorded locker agreement and ledger.', left, y + 12, { width: 330, height: 34, ellipsis: true });
    doc.font('Helvetica-Bold').fillColor(COLORS.navy).text(`For ${settings?.businessName || 'MSS Locker'}`, left + 365, y + 12, { width: 154, align: 'right' });
    doc.font('Helvetica').fillColor(COLORS.slate).text('Authorized Signatory', left + 365, y + 43, { width: 154, align: 'right' });
    doc.fillColor(COLORS.slate).fontSize(6.5).text('This invoice is a system-generated business record. Please quote the invoice number in all correspondence.', left, 799, { width, align: 'center' });

    if (invoice.status === 'CANCELLED') {
      doc.save().rotate(-32, { origin: [297, 420] }).fillColor(COLORS.red).fillOpacity(0.12).font('Helvetica-Bold').fontSize(64).text('CANCELLED', 105, 380, { width: 390, align: 'center' }).restore();
    }
    doc.end();
    return { buffer: await completion, invoiceNumber: invoice.invoiceNumber };
  }
}
export const invoicePdfService = new InvoicePdfService();
