import { connectDatabase, disconnectDatabase } from '../config/database';
import { LockerInvoice } from '../models/LockerInvoice';
import { logger } from '../utils/logger';

export async function updateInvoiceGstBreakdown(): Promise<void> {
  await connectDatabase();
  logger.info('Finding invoices with missing GST breakdown (taxAmount = 0)...');

  // Find all invoices with totalAmount > 0 and taxAmount <= 0
  const invoices = await LockerInvoice.find({
    totalAmount: { $gt: 0 },
    $or: [{ taxAmount: { $exists: false } }, { taxAmount: { $lte: 0 } }]
  });

  logger.info(`Found ${invoices.length} invoices to update with correct 18% GST breakdown.`);

  let updatedCount = 0;
  const batchSize = 100;

  for (let i = 0; i < invoices.length; i += batchSize) {
    const chunk = invoices.slice(i, i + batchSize);
    const bulkOps = chunk.map(inv => {
      const total = inv.totalAmount;
      // Locker rental in India is standard 18% GST inclusive:
      // Base Rent = Total / 1.18
      // GST (18%) = Total - Base Rent
      const baseRent = Math.round((total / 1.18) * 100) / 100;
      const taxAmount = Math.round((total - baseRent) * 100) / 100;

      return {
        updateOne: {
          filter: { _id: inv._id },
          update: {
            $set: {
              baseRent,
              taxAmount,
              subtotal: baseRent,
              // Keep totalAmount, paidAmount, balanceAmount completely intact!
            }
          }
        }
      };
    });

    await LockerInvoice.bulkWrite(bulkOps);
    updatedCount += chunk.length;
    if (updatedCount % 500 === 0 || updatedCount === invoices.length) {
      logger.info(`Updated ${updatedCount}/${invoices.length} invoices...`);
    }
  }

  logger.info(`=== GST BREAKDOWN UPDATE COMPLETE: ${updatedCount} invoices updated ===`);

  // Verify
  const zeroTaxAfter = await LockerInvoice.countDocuments({
    totalAmount: { $gt: 0 },
    taxAmount: { $lte: 0 }
  });
  const withTaxAfter = await LockerInvoice.countDocuments({
    totalAmount: { $gt: 0 },
    taxAmount: { $gt: 0 }
  });

  logger.info(`Verification -> Invoices with recorded 18% GST: ${withTaxAfter}, Zero GST remaining: ${zeroTaxAfter}`);

  // Sample check
  const samples = await LockerInvoice.find({}).sort({ issueDate: -1 }).limit(5);
  for (const s of samples) {
    console.log(`Bill: ${s.invoiceNumber} | Base: ₹${s.baseRent} | 18% GST: ₹${s.taxAmount} | Total: ₹${s.totalAmount}`);
  }

  await disconnectDatabase();
}

if (require.main === module) {
  updateInvoiceGstBreakdown()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Update failed:', err);
      process.exit(1);
    });
}
