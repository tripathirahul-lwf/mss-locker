import { Locker } from '../models/Locker';
import { LockerAllocation } from '../models/LockerAllocation';
import { LockerInvoice } from '../models/LockerInvoice';

export interface ReconciliationReport {
  isReconciled: boolean;
  totalLockers: number;
  totalOccupiedLockers: number;
  totalVacantLockers: number;
  totalActiveAllocations: number;
  conflicts: string[];
  notes: string;
}

export class ImportReconciliationService {
  /**
   * Evaluates post-migration integrity and detects data anomalies
   */
  async runReconciliation(): Promise<ReconciliationReport> {
    const conflicts: string[] = [];

    const totalLockers = await Locker.countDocuments();
    const totalOccupiedLockers = await Locker.countDocuments({ status: 'OCCUPIED' });
    const totalVacantLockers = await Locker.countDocuments({ status: 'VACANT' });
    const totalActiveAllocations = await LockerAllocation.countDocuments({ status: 'ACTIVE' });

    // 1. Check for Occupied lockers without an active allocation
    const occupiedLockers = await Locker.find({ status: 'OCCUPIED' }).select('_id lockerNumber').lean();
    for (const lock of occupiedLockers) {
      const allocCount = await LockerAllocation.countDocuments({
        lockerId: lock._id,
        status: 'ACTIVE',
      });
      if (allocCount === 0) {
        conflicts.push(`Locker #${lock.lockerNumber} is marked OCCUPIED but has no ACTIVE allocation.`);
      } else if (allocCount > 1) {
        conflicts.push(`Locker #${lock.lockerNumber} has ${allocCount} competing ACTIVE allocations.`);
      }
    }

    // 2. Check for Vacant lockers with an active allocation
    const vacantLockers = await Locker.find({ status: 'VACANT' }).select('_id lockerNumber').lean();
    for (const lock of vacantLockers) {
      const activeAlloc = await LockerAllocation.findOne({
        lockerId: lock._id,
        status: 'ACTIVE',
      });
      if (activeAlloc) {
        conflicts.push(
          `Locker #${lock.lockerNumber} is marked VACANT but has an ACTIVE allocation (${activeAlloc.allocationCode}).`
        );
      }
    }

    const isReconciled = conflicts.length === 0;
    const notes = isReconciled
      ? 'All physical lockers and customer allocations are fully reconciled and consistent.'
      : `Detected ${conflicts.length} reconciliation anomalies. Review conflicts list for remediation.`;

    return {
      isReconciled,
      totalLockers,
      totalOccupiedLockers,
      totalVacantLockers,
      totalActiveAllocations,
      conflicts,
      notes,
    };
  }
}

export const importReconciliationService = new ImportReconciliationService();
