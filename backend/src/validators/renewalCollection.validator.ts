import { z } from 'zod';
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v, 'Invalid calendar date');
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());
export const renewalCollectionSchema = z.object({
  requestId: z.string().uuid(), allocationId: z.string().regex(/^[a-f0-9]{24}$/i),
  expectedRenewalDate: day, nextRenewalDueDate: day,
  billingCycle: z.enum(['ANNUAL','TRIENNIAL','HALF_YEARLY','QUARTERLY','MONTHLY','CUSTOM']),
  amount: z.number().finite().positive().max(100000000).refine(v => Math.abs(v*100-Math.round(v*100)) < .00001, 'Use at most two decimal places'),
  receiptNumber: z.string().trim().min(1).max(100),
  receiptDate: day.refine(v => v <= today(), 'Receipt date cannot be in the future'),
  cashReceived: z.literal(true),
  receipt: z.object({fileUrl:z.string().trim().min(1).max(4000),fileName:z.string().trim().min(1).max(255),mimeType:z.enum(['image/jpeg','image/png','image/webp','application/pdf']),size:z.number().int().positive().max(5*1024*1024)}).optional(),
}).strict().refine(v => v.nextRenewalDueDate > v.expectedRenewalDate, {message:'Next renewal must be after the current renewal date',path:['nextRenewalDueDate']});
export type RenewalCollectionInput = z.infer<typeof renewalCollectionSchema>;
