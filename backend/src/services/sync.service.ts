import { Types } from 'mongoose';
import { Locker } from '../models/Locker';
import { Customer } from '../models/Customer';
import { LockerAllocation } from '../models/LockerAllocation';
import { LockerInvoice } from '../models/LockerInvoice';
import { Payment } from '../models/Payment';
import { PERMISSIONS, PermissionCode } from '../constants/permissions';
import { SyncTombstone, SyncScope } from '../models/SyncTombstone';

export interface IncrementalSyncResult {
  serverTime: string;
  nextCursor: string;
  hasMore: boolean;
  allowedScopes: string[];
  data: {
    lockers: {
      id: string;
      lockerNumber: string;
      lockerCode: string;
      size: string;
      rackNumber: string;
      section?: string;
      floor?: string;
      status: string;
      operationalStatus: string;
      annualRent: number;
      securityDeposit: number;
      isActive: boolean;
      updatedAt: string;
    }[];
    customers: {
      id: string;
      customerCode: string;
      fullName: string;
      phone: string;
      photoUrl?: string;
      status: string;
      kycStatus: string;
      updatedAt: string;
    }[];
    allocations: {
      id: string;
      allocationCode: string;
      customerId: string;
      lockerId: string;
      status: string;
      startDate: string;
      nextRenewalDueDate?: string;
      paidThroughDate?: string;
      annualRent: number;
      securityDeposit: number;
      updatedAt: string;
    }[];
    renewalSummaries: {
      id: string;
      allocationId: string;
      customerId: string;
      lockerId: string;
      invoiceNumber: string;
      dueDate: string;
      totalAmount: number;
      paidAmount: number;
      balanceAmount: number;
      paymentStatus: string;
      dueStatus: string;
      updatedAt: string;
    }[];
    payments: {
      id: string;
      receiptNumber: string;
      paymentNumber: string;
      customerId: string;
      lockerId: string;
      amount: number;
      paymentMethod: string;
      paymentDate: string;
      paymentStatus: string;
      updatedAt: string;
    }[];
    deleted: Record<SyncScope, string[]>;
  };
}

export class SyncService {
  private decodeCursor(cursor?: string): Record<string, { updatedAt: string; id: string }> {
    if (!cursor) return {};
    try {
      return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    } catch {
      const legacy = new Date(cursor);
      if (isNaN(legacy.getTime())) return {};
      const point = { updatedAt: legacy.toISOString(), id: '000000000000000000000000' };
      return { lockers: point, customers: point, allocations: point, renewalSummaries: point, payments: point };
    }
  }

  private filterAfter(point?: { updatedAt: string; id: string }): any {
    if (!point) return {};
    const date = new Date(point.updatedAt);
    if (isNaN(date.getTime())) return {};
    return { $or: [{ updatedAt: { $gt: date } }, { updatedAt: date, _id: { $gt: new Types.ObjectId(point.id) } }] };
  }

  private tombstoneFilter(scope: SyncScope, point?: { updatedAt: string; id: string }): any {
    if (!point) return { scope };
    const date = new Date(point.updatedAt);
    return { scope, $or: [{ deletedAt: { $gt: date } }, { deletedAt: date, _id: { $gt: new Types.ObjectId(point.id) } }] };
  }

  /**
   * Fetches lightweight incremental data for offline PWA caching
   * Excludes sensitive fields (e.g. master-keys, full Aadhaar/PAN)
   */
  async getIncrementalSync(
    cursor?: string,
    limit = 2000,
    permissions: PermissionCode[] = []
  ): Promise<IncrementalSyncResult> {
    const serverTime = new Date().toISOString();
    const cursorState = this.decodeCursor(cursor);

    // 1. Lockers (Exclude masterKeyReference)
    const can = (permission: PermissionCode) => permissions.includes(permission);
    const lockers = can(PERMISSIONS.LOCKERS_VIEW) ? await Locker.find(this.filterAfter(cursorState.lockers))
      .select('_id lockerNumber lockerCode size rackNumber section floor status operationalStatus annualRent securityDeposit isActive updatedAt')
      .sort({ updatedAt: 1, _id: 1 })
      .limit(limit)
      .lean() : [];

    // 2. Customers (Exclude unmasked Aadhaar, PAN, document URLs)
    const customers = can(PERMISSIONS.CUSTOMERS_VIEW) ? await Customer.find(this.filterAfter(cursorState.customers))
      .select('_id customerCode fullName phone photoUrl status kycStatus updatedAt')
      .sort({ updatedAt: 1, _id: 1 })
      .limit(limit)
      .lean() : [];

    // 3. Allocations (Lightweight tenancy records)
    const allocations = can(PERMISSIONS.ALLOCATIONS_VIEW) ? await LockerAllocation.find(this.filterAfter(cursorState.allocations))
      .select('_id allocationCode customerId lockerId status startDate nextRenewalDueDate paidThroughDate annualRent securityDeposit updatedAt')
      .sort({ updatedAt: 1, _id: 1 })
      .limit(limit)
      .lean() : [];

    // 4. Invoices / Renewal Summaries
    const invoices = can(PERMISSIONS.RENEWALS_VIEW) ? await LockerInvoice.find({
      ...this.filterAfter(cursorState.renewalSummaries),
      status: { $ne: 'CANCELLED' },
    })
      .select('_id allocationId customerId lockerId invoiceNumber dueDate totalAmount paidAmount balanceAmount paymentStatus dueStatus updatedAt')
      .sort({ updatedAt: 1, _id: 1 })
      .limit(limit)
      .lean() : [];

    // 5. Recent Completed Payments (Last 100)
    const payments = can(PERMISSIONS.PAYMENTS_VIEW) ? await Payment.find({
      ...this.filterAfter(cursorState.payments),
      paymentStatus: 'COMPLETED',
    })
      .select('_id receiptNumber paymentNumber customerId lockerId amount paymentMethod paymentDate paymentStatus updatedAt')
      .sort({ updatedAt: 1, _id: 1 })
      .limit(limit)
      .lean() : [];

    const scopePermissions: Array<[SyncScope, boolean]> = [
      ['lockers', can(PERMISSIONS.LOCKERS_VIEW)], ['customers', can(PERMISSIONS.CUSTOMERS_VIEW)],
      ['allocations', can(PERMISSIONS.ALLOCATIONS_VIEW)], ['renewalSummaries', can(PERMISSIONS.RENEWALS_VIEW)],
      ['payments', can(PERMISSIONS.PAYMENTS_VIEW)],
    ];
    const deletedEntries: Record<SyncScope, any[]> = { lockers: [], customers: [], allocations: [], renewalSummaries: [], payments: [] };
    for (const [scope, allowed] of scopePermissions) {
      if (allowed) deletedEntries[scope] = await SyncTombstone.find(this.tombstoneFilter(scope, cursorState[`deleted:${scope}`]))
        .sort({ deletedAt: 1, _id: 1 }).limit(limit).lean();
    }

    const nextState = { ...cursorState };
    const advance = (scope: string, docs: any[]) => {
      const last = docs[docs.length - 1];
      if (last) nextState[scope] = { updatedAt: last.updatedAt.toISOString(), id: last._id.toString() };
    };
    advance('lockers', lockers);
    advance('customers', customers);
    advance('allocations', allocations);
    advance('renewalSummaries', invoices);
    advance('payments', payments);
    for (const [scope] of scopePermissions) {
      const docs = deletedEntries[scope];
      const last = docs[docs.length - 1];
      if (last) nextState[`deleted:${scope}`] = { updatedAt: last.deletedAt.toISOString(), id: last._id.toString() };
    }
    const hasMore = [...[lockers, customers, allocations, invoices, payments], ...Object.values(deletedEntries)].some((docs) => docs.length >= limit);

    return {
      serverTime,
      nextCursor: Buffer.from(JSON.stringify(nextState)).toString('base64url'),
      hasMore,
      allowedScopes: [
        can(PERMISSIONS.LOCKERS_VIEW) && 'lockers',
        can(PERMISSIONS.CUSTOMERS_VIEW) && 'customers',
        can(PERMISSIONS.ALLOCATIONS_VIEW) && 'allocations',
        can(PERMISSIONS.RENEWALS_VIEW) && 'renewalSummaries',
        can(PERMISSIONS.PAYMENTS_VIEW) && 'payments',
      ].filter((scope): scope is string => Boolean(scope)),
      data: {
        deleted: Object.fromEntries(Object.entries(deletedEntries).map(([scope, docs]) => [scope, docs.map((doc: any) => doc.recordId)])) as Record<SyncScope, string[]>,
        lockers: lockers.map((l) => ({
          id: l._id.toString(),
          lockerNumber: l.lockerNumber,
          lockerCode: l.lockerCode,
          size: l.size,
          rackNumber: l.rackNumber,
          section: l.section,
          floor: l.floor,
          status: l.status,
          operationalStatus: l.operationalStatus,
          annualRent: l.annualRent || 0,
          securityDeposit: l.securityDeposit || 0,
          isActive: l.isActive !== false,
          updatedAt: l.updatedAt ? l.updatedAt.toISOString() : serverTime,
        })),
        customers: customers.map((c) => ({
          id: c._id.toString(),
          customerCode: c.customerCode,
          fullName: c.fullName,
          phone: c.phone,
          photoUrl: c.photoUrl,
          status: c.status,
          kycStatus: c.kycStatus,
          updatedAt: c.updatedAt ? c.updatedAt.toISOString() : serverTime,
        })),
        allocations: allocations.map((a) => ({
          id: a._id.toString(),
          allocationCode: a.allocationCode,
          customerId: a.customerId.toString(),
          lockerId: a.lockerId.toString(),
          status: a.status,
          startDate: a.startDate.toISOString(),
          nextRenewalDueDate: a.nextRenewalDueDate ? a.nextRenewalDueDate.toISOString() : undefined,
          paidThroughDate: a.paidThroughDate ? a.paidThroughDate.toISOString() : undefined,
          annualRent: a.annualRent || 0,
          securityDeposit: a.securityDeposit || 0,
          updatedAt: a.updatedAt ? a.updatedAt.toISOString() : serverTime,
        })),
        renewalSummaries: invoices.map((inv) => ({
          id: inv._id.toString(),
          allocationId: inv.allocationId.toString(),
          customerId: inv.customerId.toString(),
          lockerId: inv.lockerId.toString(),
          invoiceNumber: inv.invoiceNumber,
          dueDate: inv.dueDate.toISOString(),
          totalAmount: inv.totalAmount,
          paidAmount: inv.paidAmount,
          balanceAmount: inv.balanceAmount,
          paymentStatus: inv.paymentStatus,
          dueStatus: inv.dueStatus,
          updatedAt: inv.updatedAt ? inv.updatedAt.toISOString() : serverTime,
        })),
        payments: payments.map((p) => ({
          id: p._id.toString(),
          receiptNumber: p.receiptNumber,
          paymentNumber: p.paymentNumber,
          customerId: p.customerId.toString(),
          lockerId: p.lockerId.toString(),
          amount: p.amount,
          paymentMethod: p.paymentMethod,
          paymentDate: p.paymentDate.toISOString(),
          paymentStatus: p.paymentStatus,
          updatedAt: p.updatedAt ? p.updatedAt.toISOString() : serverTime,
        })),
      },
    };
  }

  /**
   * Fetches lightweight dashboard summary for offline cache
   */
  async getDashboardSync(): Promise<any> {
    const totalLockers = await Locker.countDocuments();
    const occupiedLockers = await Locker.countDocuments({ status: 'OCCUPIED' });
    const vacantLockers = await Locker.countDocuments({ status: 'VACANT' });
    const reservedLockers = await Locker.countDocuments({ status: 'RESERVED' });
    const blockedLockers = await Locker.countDocuments({ status: 'BLOCKED' });

    const totalCustomers = await Customer.countDocuments({ status: 'ACTIVE' });
    const totalAllocations = await LockerAllocation.countDocuments({ status: 'ACTIVE' });

    const openInvoices = await LockerInvoice.find({
      balanceAmount: { $gt: 0 },
      status: { $ne: 'CANCELLED' },
    }).select('balanceAmount');

    const totalOutstanding = openInvoices.reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0);

    return {
      metrics: {
        totalLockers,
        occupiedLockers,
        vacantLockers,
        reservedLockers,
        blockedLockers,
        occupancyRate: totalLockers > 0 ? ((occupiedLockers / totalLockers) * 100).toFixed(1) : '0.0',
        totalCustomers,
        totalAllocations,
        totalOutstanding,
      },
      cachedAt: new Date().toISOString(),
    };
  }
}

export const syncService = new SyncService();
