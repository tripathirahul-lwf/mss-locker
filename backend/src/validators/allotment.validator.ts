import { z } from 'zod';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v, 'Enter a valid date.');
const money = z.number().finite().nonnegative().max(100000000).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < .00001, 'Amounts can have at most two decimal places.');
const asset = z.object({ fileUrl: z.string().min(1).max(3000), fileName: z.string().min(1).max(200), size: z.number().positive().max(5 * 1024 * 1024), mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) });
const document = asset.extend({ documentType: z.enum(['AADHAAR','PAN','PASSPORT','VOTER_ID','DRIVING_LICENSE','OTHER']), documentNumber: z.string().trim().min(1).max(100) }).superRefine((value, ctx) => {
  const number = value.documentNumber.replace(/\s/g,'').toUpperCase();
  const patterns: Record<string, RegExp> = { AADHAAR: /^[2-9]\d{11}$/, PAN: /^[A-Z]{5}\d{4}[A-Z]$/, PASSPORT: /^[A-Z]\d{7}$/, VOTER_ID: /^[A-Z]{3}\d{7}$/, DRIVING_LICENSE: /^[A-Z0-9 -]{10,30}$/, OTHER: /^.{3,100}$/ };
  if (!patterns[value.documentType].test(number)) ctx.addIssue({ code: 'custom', path: ['documentNumber'], message: 'Enter a valid ID number for the selected document type.' });
});
export const allotmentSchema = z.object({
  requestId: z.string().uuid(),
  lockerId: z.string().regex(/^[a-f0-9]{24}$/i),
  customerId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  customer: z.object({ fullName: z.string().trim().min(2).max(150), phone: z.string().trim().transform(v => v.replace(/[\s()-]/g,'')).pipe(z.string().regex(/^(?:\+?91)?[6-9]\d{9}$/)), email: z.string().trim().email().optional() }).optional(),
  keyNumber: z.string().trim().min(1).max(100),
  startDate: date,
  receiptDate: date.refine(v => v <= today(), 'Receipt date cannot be in the future.').default(today),
  cashReceived: z.literal(true, { error: 'Confirm that the displayed cash amount has been received.' }),
  billingCycle: z.enum(['ANNUAL','TRIENNIAL']).default('ANNUAL'),
  annualRent: money, annualBaseRent: money, securityDeposit: money,
  receiptNumber: z.string().trim().min(1).max(100),
  receipt: asset.optional(), photo: asset.refine(v => v.mimeType !== 'application/pdf', 'KYC photo must be an image.').optional(),
  idDocument: document.optional(),
}).refine(v => Math.abs(v.annualRent - Math.round(v.annualBaseRent * 1.18 * 100) / 100) < .001, 'Annual rent and GST do not agree').refine(v => Boolean(v.customerId) !== Boolean(v.customer), 'Choose an existing customer or enter a new customer');
export type AllotmentInput = z.infer<typeof allotmentSchema>;
