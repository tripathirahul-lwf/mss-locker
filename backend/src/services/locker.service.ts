import { Types } from 'mongoose';
import { Locker, ILocker } from '../models/Locker';
import {
  CreateLockerInput,
  UpdateLockerInput,
  LockerQueryParams,
} from '../validators/locker.validator';
import { recordAuditLog } from '../utils/auditLogger';

export interface PaginatedLockersResult {
  lockers: Partial<ILocker>[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LockerStatsResult {
  total: number;
  vacant: number;
  reserved: number;
  occupied: number;
  blocked: number;
  active: number;
  maintenance: number;
  damaged: number;
  decommissioned: number;
  availableForAllocation: number;
  sizeBreakdown: Record<
    string,
    {
      total: number;
      vacant: number;
      occupied: number;
      reserved: number;
      blocked: number;
    }
  >;
}

export class LockerService {
  private static readonly statsCache = new Map<string, { expiresAt: number; value: LockerStatsResult }>();
  private static buildLockerFilter(params: Partial<LockerQueryParams>): Record<string, unknown> {
    const { search, size, status, operationalStatus, rackNumber, section, isActive } = params;
    const filter: Record<string, unknown> = {};
    if (isActive !== undefined) filter.isActive = isActive;
    if (size) filter.size = size.toUpperCase();
    if (status && status !== 'ALL') filter.status = status;
    if (operationalStatus && operationalStatus !== 'ALL') filter.operationalStatus = operationalStatus;
    if (rackNumber) filter.rackNumber = { $regex: rackNumber, $options: 'i' };
    if (section) filter.section = { $regex: section, $options: 'i' };
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      filter.$or = [{ lockerNumber: searchRegex }, { lockerCode: searchRegex }, { rackNumber: searchRegex }, { section: searchRegex }];
    }
    return filter;
  }

  /**
   * Centralized business rule for locker availability.
   * A locker is available for allocation IF AND ONLY IF:
   * 1. Business status is VACANT
   * 2. Physical operational status is ACTIVE
   * 3. Record isActive flag is true
   */
  static isLockerAvailableForAllocation(
    locker: Pick<ILocker, 'status' | 'operationalStatus' | 'isActive'>
  ): boolean {
    return (
      locker.status === 'VACANT' &&
      locker.operationalStatus === 'ACTIVE' &&
      locker.isActive === true
    );
  }

  /**
   * Generates a unique system locker code if not explicitly provided.
   */
  private static async generateLockerCode(): Promise<string> {
    const count = await Locker.countDocuments();
    let nextNum = count + 1;
    let code = `LCK-${String(nextNum).padStart(6, '0')}`;

    // Ensure uniqueness in case of deletions
    while (await Locker.exists({ lockerCode: code })) {
      nextNum += 1;
      code = `LCK-${String(nextNum).padStart(6, '0')}`;
    }

    return code;
  }

  /**
   * Strips sensitive fields like masterKeyReference for unauthorized users.
   */
  private static sanitizeLocker(
    locker: ILocker,
    canViewSensitive: boolean
  ): Partial<ILocker> {
    const obj = locker.toObject ? locker.toObject() : { ...locker };
    if (!canViewSensitive) {
      delete obj.masterKeyReference;
    }
    return obj;
  }

  /**
   * List lockers with server-side pagination, search, multi-field filtering, and sorting.
   */
  static async getLockers(
    params: LockerQueryParams,
    canViewSensitive: boolean
  ): Promise<PaginatedLockersResult> {
    const {
      page = 1,
      limit = 25,
      search,
      size,
      status,
      operationalStatus,
      rackNumber,
      section,
      isActive,
      compact = false,
      sortBy = 'lockerNumber',
      sortOrder = 'asc',
    } = params;

    const filter = this.buildLockerFilter({ search, size, status, operationalStatus, rackNumber, section, isActive });

    const sortOptions: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === 'desc' ? -1 : 1,
    };

    const skip = (page - 1) * limit;

    const findQuery = Locker.find(filter)
      .collation({ locale: 'en', numericOrdering: true })
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);
    if (compact) {
      findQuery.select('_id lockerNumber lockerCode size rackNumber section floor annualRent securityDeposit status operationalStatus isActive');
    } else {
      findQuery.populate('createdBy', 'name username').populate('updatedBy', 'name username');
    }
    const [lockers, total] = await Promise.all([
      compact ? findQuery.lean().exec() : findQuery.exec(),
      Locker.countDocuments(filter),
    ]);

    const sanitizedLockers = compact
      ? lockers
      : (lockers as ILocker[]).map((l) => this.sanitizeLocker(l, canViewSensitive));

    return {
      lockers: sanitizedLockers as unknown as Partial<ILocker>[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single locker by ID.
   */
  static async getLockerById(
    id: string,
    canViewSensitive: boolean
  ): Promise<Partial<ILocker>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('Invalid locker ID');
    }

    const locker = await Locker.findById(id)
      .populate('createdBy', 'name username')
      .populate('updatedBy', 'name username');

    if (!locker) {
      throw new Error('Locker not found');
    }

    return this.sanitizeLocker(locker, canViewSensitive);
  }

  /**
   * Get operational statistics & size distribution matrix.
   */
  static async getLockerStats(params: Partial<LockerQueryParams> = {}): Promise<LockerStatsResult> {
    const cacheKey = JSON.stringify(params, Object.keys(params).sort());
    const cached = this.statsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const match = this.buildLockerFilter({ ...params, isActive: params.isActive ?? true });
    const [total, statusCounts, operationalCounts, sizeMatrix, availableCount] =
      await Promise.all([
        Locker.countDocuments(match),
        Locker.aggregate([
          { $match: match },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Locker.aggregate([
          { $match: match },
          { $group: { _id: '$operationalStatus', count: { $sum: 1 } } },
        ]),
        Locker.aggregate([
          { $match: match },
          {
            $group: {
              _id: { size: '$size', status: '$status' },
              count: { $sum: 1 },
            },
          },
        ]),
        Locker.countDocuments({ ...match,
          status: 'VACANT',
          operationalStatus: 'ACTIVE',
        }),
      ]);

    const getStatusCount = (statusName: string) => {
      const item = statusCounts.find((s) => s._id === statusName);
      return item ? item.count : 0;
    };

    const getOperationalCount = (opStatusName: string) => {
      const item = operationalCounts.find((o) => o._id === opStatusName);
      return item ? item.count : 0;
    };

    const sizeBreakdown: LockerStatsResult['sizeBreakdown'] = {};
    for (const entry of sizeMatrix) {
      const { size, status } = entry._id;
      if (!sizeBreakdown[size]) {
        sizeBreakdown[size] = {
          total: 0,
          vacant: 0,
          occupied: 0,
          reserved: 0,
          blocked: 0,
        };
      }
      sizeBreakdown[size].total += entry.count;
      if (status === 'VACANT') sizeBreakdown[size].vacant += entry.count;
      if (status === 'OCCUPIED') sizeBreakdown[size].occupied += entry.count;
      if (status === 'RESERVED') sizeBreakdown[size].reserved += entry.count;
      if (status === 'BLOCKED') sizeBreakdown[size].blocked += entry.count;
    }

    const result = {
      total,
      vacant: getStatusCount('VACANT'),
      reserved: getStatusCount('RESERVED'),
      occupied: getStatusCount('OCCUPIED'),
      blocked: getStatusCount('BLOCKED'),
      active: getOperationalCount('ACTIVE'),
      maintenance: getOperationalCount('MAINTENANCE'),
      damaged: getOperationalCount('DAMAGED'),
      decommissioned: getOperationalCount('DECOMMISSIONED'),
      availableForAllocation: availableCount,
      sizeBreakdown,
    };
    this.statsCache.set(cacheKey, { expiresAt: Date.now() + 15_000, value: result });
    if (this.statsCache.size > 100) {
      for (const [key, entry] of this.statsCache) if (entry.expiresAt <= Date.now()) this.statsCache.delete(key);
    }
    return result;
  }

  /**
   * Fast availability query for future customer allocation wizards.
   */
  static async getAvailableLockers(
    filters: { size?: string; rackNumber?: string; section?: string },
    canViewSensitive: boolean
  ): Promise<Partial<ILocker>[]> {
    const query: Record<string, unknown> = {
      status: 'VACANT',
      operationalStatus: 'ACTIVE',
      isActive: true,
    };

    if (filters.size) {
      query.size = filters.size.toUpperCase();
    }
    if (filters.rackNumber) {
      query.rackNumber = { $regex: filters.rackNumber, $options: 'i' };
    }
    if (filters.section) {
      query.section = { $regex: filters.section, $options: 'i' };
    }

    const availableLockers = await Locker.find(query)
      .collation({ locale: 'en', numericOrdering: true })
      .sort({ lockerNumber: 1 })
      .limit(100);

    return availableLockers.map((l) => this.sanitizeLocker(l, canViewSensitive));
  }

  /**
   * Create a new locker in the master registry.
   */
  static async createLocker(
    input: CreateLockerInput,
    actorUserId?: string,
    actorUsername?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<Partial<ILocker>> {
    // Check for duplicate locker number
    const existing = await Locker.findOne({
      lockerNumber: { $regex: new RegExp(`^${input.lockerNumber.trim()}$`, 'i') },
    });

    if (existing) {
      throw new Error(`Locker number '${input.lockerNumber}' already exists.`);
    }

    const lockerCode = input.lockerCode?.trim()
      ? input.lockerCode.trim().toUpperCase()
      : await this.generateLockerCode();

    // Check for duplicate code
    if (await Locker.exists({ lockerCode })) {
      throw new Error(`Locker code '${lockerCode}' is already in use.`);
    }

    const locker = new Locker({
      ...input,
      lockerNumber: input.lockerNumber.trim(),
      lockerCode,
      size: input.size.trim().toUpperCase(),
      rackNumber: input.rackNumber.trim(),
      section: input.section?.trim() || '',
      floor: input.floor?.trim() || 'Ground Floor',
      position: input.position?.trim() || '',
      masterKeyReference: input.masterKeyReference?.trim() || '',
      annualRent: input.annualRent,
      securityDeposit: input.securityDeposit,
      status: input.status || 'VACANT',
      operationalStatus: input.operationalStatus || 'ACTIVE',
      remarks: input.remarks?.trim() || '',
      isActive: true,
      createdBy: actorUserId ? new Types.ObjectId(actorUserId) : undefined,
      updatedBy: actorUserId ? new Types.ObjectId(actorUserId) : undefined,
    });

    await locker.save();

    // Record audit event (Sanitizing sensitive masterKeyReference)
    await recordAuditLog({
      actorUserId,
      actorUsername,
      action: 'LOCKER_CREATED',
      entityType: 'LOCKER',
      entityId: locker._id.toString(),
      description: `Created locker ${locker.lockerNumber} (${locker.size}, ${locker.rackNumber})`,
      ipAddress,
      userAgent,
      metadata: {
        lockerNumber: locker.lockerNumber,
        lockerCode: locker.lockerCode,
        size: locker.size,
        rackNumber: locker.rackNumber,
        annualRent: locker.annualRent,
        securityDeposit: locker.securityDeposit,
        status: locker.status,
        operationalStatus: locker.operationalStatus,
      },
    });

    return locker.toObject();
  }

  /**
   * Bulk import multiple lockers from CSV/Excel data.
   */
  static async bulkImportLockers(
    records: CreateLockerInput[],
    actorUserId?: string,
    actorUsername?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ insertedCount: number; skippedCount: number; errors: string[] }> {
    let insertedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    const existingLockers = await Locker.find().select('lockerNumber lockerCode');
    const existingNumbers = new Set(
      existingLockers.map((l) => l.lockerNumber.toLowerCase())
    );

    let count = await Locker.countDocuments();

    for (const record of records) {
      const normalizedNum = record.lockerNumber.trim().toLowerCase();
      if (existingNumbers.has(normalizedNum)) {
        skippedCount += 1;
        errors.push(`Skipped duplicate locker number: ${record.lockerNumber}`);
        continue;
      }

      count += 1;
      const lockerCode = `LCK-${String(count).padStart(6, '0')}`;

      try {
        const newLocker = new Locker({
          ...record,
          lockerNumber: record.lockerNumber.trim(),
          lockerCode,
          size: record.size.trim().toUpperCase(),
          rackNumber: record.rackNumber.trim(),
          section: record.section?.trim() || 'Main Vault',
          floor: record.floor?.trim() || 'Ground Floor',
          position: record.position?.trim() || '',
          masterKeyReference: record.masterKeyReference?.trim() || '',
          annualRent: record.annualRent || 3000,
          securityDeposit: record.securityDeposit || 10000,
          status: record.status || 'VACANT',
          operationalStatus: record.operationalStatus || 'ACTIVE',
          remarks: record.remarks?.trim() || '',
          isActive: true,
          createdBy: actorUserId ? new Types.ObjectId(actorUserId) : undefined,
        });

        await newLocker.save();
        existingNumbers.add(normalizedNum);
        insertedCount += 1;
      } catch (err: any) {
        errors.push(`Error on locker ${record.lockerNumber}: ${err.message}`);
      }
    }

    // Record audit event
    await recordAuditLog({
      actorUserId,
      actorUsername,
      action: 'LOCKER_CREATED',
      entityType: 'LOCKER_BULK',
      description: `Bulk imported ${insertedCount} lockers (${skippedCount} duplicates skipped)`,
      ipAddress,
      userAgent,
      metadata: {
        insertedCount,
        skippedCount,
        totalSubmitted: records.length,
      },
    });

    return {
      insertedCount,
      skippedCount,
      errors,
    };
  }

  /**
   * Update an existing locker record with optimistic concurrency protection.
   */
  static async updateLocker(
    id: string,
    input: UpdateLockerInput,
    actorUserId?: string,
    actorUsername?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<Partial<ILocker>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('Invalid locker ID');
    }

    const locker = await Locker.findById(id);
    if (!locker) {
      throw new Error('Locker not found');
    }

    // Optimistic concurrency check if expectedUpdatedAt provided
    if (input.expectedUpdatedAt) {
      const currentUpdated = new Date(locker.updatedAt).toISOString();
      const expectedUpdated = new Date(input.expectedUpdatedAt).toISOString();
      if (currentUpdated !== expectedUpdated) {
        throw new Error(
          'Conflict: Locker has been modified by another operator. Please refresh and review latest status.'
        );
      }
    }

    // Check unique locker number if modified
    if (input.lockerNumber && input.lockerNumber.trim().toLowerCase() !== locker.lockerNumber.toLowerCase()) {
      const duplicate = await Locker.findOne({
        _id: { $ne: locker._id },
        lockerNumber: { $regex: new RegExp(`^${input.lockerNumber.trim()}$`, 'i') },
      });
      if (duplicate) {
        throw new Error(`Locker number '${input.lockerNumber}' is already assigned.`);
      }
      locker.lockerNumber = input.lockerNumber.trim();
    }

    // Track changed fields for audit logging
    const changedFields: string[] = [];
    const previousStatus = locker.status;
    const previousOpStatus = locker.operationalStatus;

    if (input.size !== undefined && input.size.toUpperCase() !== locker.size) {
      locker.size = input.size.toUpperCase();
      changedFields.push('size');
    }
    if (input.rackNumber !== undefined && input.rackNumber.trim() !== locker.rackNumber) {
      locker.rackNumber = input.rackNumber.trim();
      changedFields.push('rackNumber');
    }
    if (input.section !== undefined && input.section.trim() !== locker.section) {
      locker.section = input.section.trim();
      changedFields.push('section');
    }
    if (input.floor !== undefined && input.floor.trim() !== locker.floor) {
      locker.floor = input.floor.trim();
      changedFields.push('floor');
    }
    if (input.position !== undefined && input.position.trim() !== locker.position) {
      locker.position = input.position.trim();
      changedFields.push('position');
    }
    if (input.annualRent !== undefined && input.annualRent !== locker.annualRent) {
      locker.annualRent = input.annualRent;
      changedFields.push('annualRent');
    }
    if (input.securityDeposit !== undefined && input.securityDeposit !== locker.securityDeposit) {
      locker.securityDeposit = input.securityDeposit;
      changedFields.push('securityDeposit');
    }
    if (input.remarks !== undefined && input.remarks.trim() !== locker.remarks) {
      locker.remarks = input.remarks.trim();
      changedFields.push('remarks');
    }
    if (input.isActive !== undefined && input.isActive !== locker.isActive) {
      locker.isActive = input.isActive;
      changedFields.push('isActive');
    }

    let masterKeyReferenceChanged = false;
    if (input.masterKeyReference !== undefined && input.masterKeyReference.trim() !== locker.masterKeyReference) {
      locker.masterKeyReference = input.masterKeyReference.trim();
      masterKeyReferenceChanged = true;
      changedFields.push('masterKeyReference');
    }

    let statusAction: 'LOCKER_UPDATED' | 'LOCKER_STATUS_CHANGED' | 'LOCKER_OPERATIONAL_STATUS_CHANGED' =
      'LOCKER_UPDATED';

    if (input.status !== undefined && input.status !== locker.status) {
      locker.status = input.status;
      changedFields.push('status');
      statusAction = 'LOCKER_STATUS_CHANGED';
    }

    if (
      input.operationalStatus !== undefined &&
      input.operationalStatus !== locker.operationalStatus
    ) {
      locker.operationalStatus = input.operationalStatus;
      changedFields.push('operationalStatus');
      statusAction = 'LOCKER_OPERATIONAL_STATUS_CHANGED';
    }

    if (actorUserId) {
      locker.updatedBy = new Types.ObjectId(actorUserId);
    }

    await locker.save();

    // Audit Logging
    await recordAuditLog({
      actorUserId,
      actorUsername,
      action: statusAction,
      entityType: 'LOCKER',
      entityId: locker._id.toString(),
      description: `Updated locker ${locker.lockerNumber}: ${changedFields.join(', ')}`,
      ipAddress,
      userAgent,
      metadata: {
        lockerNumber: locker.lockerNumber,
        changedFields,
        previousStatus,
        newStatus: locker.status,
        previousOperationalStatus: previousOpStatus,
        newOperationalStatus: locker.operationalStatus,
        masterKeyReferenceChanged,
      },
    });

    return locker.toObject();
  }

  /**
   * Soft deactivation for lockers.
   */
  static async deactivateLocker(
    id: string,
    actorUserId?: string,
    actorUsername?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('Invalid locker ID');
    }

    const locker = await Locker.findById(id);
    if (!locker) {
      throw new Error('Locker not found');
    }

    if (locker.status === 'OCCUPIED') {
      throw new Error(
        'Cannot deactivate an occupied locker. Please close active allocation first.'
      );
    }

    locker.isActive = false;
    if (actorUserId) {
      locker.updatedBy = new Types.ObjectId(actorUserId);
    }

    await locker.save();

    await recordAuditLog({
      actorUserId,
      actorUsername,
      action: 'LOCKER_DEACTIVATED',
      entityType: 'LOCKER',
      entityId: locker._id.toString(),
      description: `Deactivated physical locker ${locker.lockerNumber}`,
      ipAddress,
      userAgent,
      metadata: {
        lockerNumber: locker.lockerNumber,
        previousStatus: locker.status,
      },
    });
  }
}
