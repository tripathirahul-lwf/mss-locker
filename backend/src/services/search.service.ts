import { Types } from 'mongoose';
import { Customer } from '../models/Customer';
import { Locker } from '../models/Locker';
import { LockerAllocation } from '../models/LockerAllocation';
import { LockerInvoice } from '../models/LockerInvoice';
import { Payment } from '../models/Payment';
import { PERMISSIONS } from '../constants/permissions';

export interface GlobalSearchResult {
  customers: {
    _id: string;
    customerCode: string;
    fullName: string;
    phone: string;
    photoUrl?: string;
    kycStatus: string;
    status: string;
  }[];
  lockers: {
    _id: string;
    lockerNumber: string;
    lockerCode: string;
    size: string;
    rackNumber: string;
    status: string;
    operationalStatus: string;
  }[];
  allocations: {
    _id: string;
    allocationCode: string;
    status: string;
    customerName: string;
    customerCode: string;
    lockerNumber: string;
  }[];
  invoices: {
    _id: string;
    invoiceNumber: string;
    dueDate: Date;
    totalAmount: number;
    balanceAmount: number;
    paymentStatus: string;
    customerName: string;
    lockerNumber: string;
  }[];
  payments: {
    _id: string;
    paymentNumber: string;
    receiptNumber: string;
    amount: number;
    paymentDate: Date;
    customerName: string;
    lockerNumber: string;
  }[];
}

export class SearchService {
  /**
   * Safe regex helper to escape special characters and avoid ReDoS attacks
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Executes a permission-aware global search across multiple collections
   */
  async globalSearch(
    query: string,
    userPermissions: string[],
    limit = 6,
    types?: string[]
  ): Promise<GlobalSearchResult> {
    const cleanQuery = (query || '').trim();
    if (!cleanQuery || cleanQuery.length < 2) {
      return {
        customers: [],
        lockers: [],
        allocations: [],
        invoices: [],
        payments: [],
      };
    }

    const escaped = this.escapeRegex(cleanQuery);
    const regex = new RegExp(escaped, 'i');
    const exactRegex = new RegExp(`^${escaped}$`, 'i');

    const requestedTypes = types && types.length > 0 ? types : ['customers', 'lockers', 'allocations', 'invoices', 'payments'];

    const results: GlobalSearchResult = {
      customers: [],
      lockers: [],
      allocations: [],
      invoices: [],
      payments: [],
    };

    const tasks: Promise<any>[] = [];

    // 1. Customers (Checked with CUSTOMERS_VIEW)
    if (requestedTypes.includes('customers') && userPermissions.includes(PERMISSIONS.CUSTOMERS_VIEW)) {
      tasks.push(
        Customer.find({
          $or: [
            { fullName: regex },
            { customerCode: regex },
            { phone: regex },
            { alternatePhone: regex },
            { email: regex },
          ],
        })
          .select('_id customerCode fullName phone photoUrl kycStatus status')
          .limit(limit)
          .lean()
          .then((docs) => {
            // Sort exact match on phone or customerCode first
            results.customers = docs
              .sort((a, b) => {
                const aExact = exactRegex.test(a.customerCode) || exactRegex.test(a.phone) ? 1 : 0;
                const bExact = exactRegex.test(b.customerCode) || exactRegex.test(b.phone) ? 1 : 0;
                return bExact - aExact;
              })
              .map((c) => ({
                _id: c._id.toString(),
                customerCode: c.customerCode,
                fullName: c.fullName,
                phone: c.phone,
                photoUrl: c.photoUrl,
                kycStatus: c.kycStatus,
                status: c.status,
              }));
          })
      );
    }

    // 2. Lockers (Checked with LOCKERS_VIEW)
    if (requestedTypes.includes('lockers') && userPermissions.includes(PERMISSIONS.LOCKERS_VIEW)) {
      tasks.push(
        Locker.find({
          $or: [
            { lockerNumber: regex },
            { lockerCode: regex },
            { rackNumber: regex },
          ],
        })
          .select('_id lockerNumber lockerCode size rackNumber status operationalStatus')
          .limit(limit)
          .lean()
          .then((docs) => {
            results.lockers = docs
              .sort((a, b) => {
                const aExact = exactRegex.test(a.lockerNumber) ? 1 : 0;
                const bExact = exactRegex.test(b.lockerNumber) ? 1 : 0;
                return bExact - aExact;
              })
              .map((l) => ({
                _id: l._id.toString(),
                lockerNumber: l.lockerNumber,
                lockerCode: l.lockerCode,
                size: l.size,
                rackNumber: l.rackNumber,
                status: l.status,
                operationalStatus: l.operationalStatus,
              }));
          })
      );
    }

    // 3. Allocations (Checked with ALLOCATIONS_VIEW)
    if (requestedTypes.includes('allocations') && userPermissions.includes(PERMISSIONS.ALLOCATIONS_VIEW)) {
      tasks.push(
        LockerAllocation.find({
          allocationCode: regex,
        })
          .select('_id allocationCode status customerId lockerId')
          .populate('customerId', 'fullName customerCode')
          .populate('lockerId', 'lockerNumber')
          .limit(limit)
          .lean()
          .then((docs: any[]) => {
            results.allocations = docs.map((a) => ({
              _id: a._id.toString(),
              allocationCode: a.allocationCode,
              status: a.status,
              customerName: a.customerId?.fullName || 'N/A',
              customerCode: a.customerId?.customerCode || 'N/A',
              lockerNumber: a.lockerId?.lockerNumber || 'N/A',
            }));
          })
      );
    }

    // 4. Invoices (Checked with PAYMENTS_VIEW or RENEWALS_VIEW)
    if (
      requestedTypes.includes('invoices') &&
      (userPermissions.includes(PERMISSIONS.PAYMENTS_VIEW) || userPermissions.includes(PERMISSIONS.RENEWALS_VIEW))
    ) {
      tasks.push(
        LockerInvoice.find({
          invoiceNumber: regex,
        })
          .select('_id invoiceNumber dueDate totalAmount balanceAmount paymentStatus customerId lockerId')
          .populate('customerId', 'fullName')
          .populate('lockerId', 'lockerNumber')
          .limit(limit)
          .lean()
          .then((docs: any[]) => {
            results.invoices = docs.map((inv) => ({
              _id: inv._id.toString(),
              invoiceNumber: inv.invoiceNumber,
              dueDate: inv.dueDate,
              totalAmount: inv.totalAmount,
              balanceAmount: inv.balanceAmount,
              paymentStatus: inv.paymentStatus,
              customerName: inv.customerId?.fullName || 'N/A',
              lockerNumber: inv.lockerId?.lockerNumber || 'N/A',
            }));
          })
      );
    }

    // 5. Payments (Checked with PAYMENTS_VIEW)
    if (requestedTypes.includes('payments') && userPermissions.includes(PERMISSIONS.PAYMENTS_VIEW)) {
      tasks.push(
        Payment.find({
          $or: [
            { paymentNumber: regex },
            { receiptNumber: regex },
            { billNumber: regex },
            { transactionReference: regex },
            { upiReference: regex },
          ],
        })
          .select('_id paymentNumber receiptNumber billNumber amount paymentDate customerId lockerId')
          .populate('customerId', 'fullName')
          .populate('lockerId', 'lockerNumber')
          .limit(limit)
          .lean()
          .then((docs: any[]) => {
            results.payments = docs.map((p) => ({
              _id: p._id.toString(),
              paymentNumber: p.paymentNumber,
              receiptNumber: p.receiptNumber,
              billNumber: p.billNumber,
              amount: p.amount,
              paymentDate: p.paymentDate,
              customerName: p.customerId?.fullName || 'N/A',
              lockerNumber: p.lockerId?.lockerNumber || 'N/A',
            }));
          })
      );
    }

    await Promise.all(tasks);

    return results;
  }
}

export const searchService = new SearchService();
