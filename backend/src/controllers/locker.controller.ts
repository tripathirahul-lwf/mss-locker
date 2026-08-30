import { Request, Response, NextFunction } from 'express';
import { LockerService } from '../services/locker.service';
import {
  createLockerSchema,
  updateLockerSchema,
  lockerQuerySchema,
} from '../validators/locker.validator';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { PERMISSIONS } from '../constants/permissions';

export class LockerController {
  private static canViewSensitive(req: Request): boolean {
    if (!req.user) return false;
    return (
      req.user.isSuperAdmin ||
      req.user.permissions.includes(PERMISSIONS.LOCKERS_VIEW_SENSITIVE)
    );
  }

  static async getLockers(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const startedAt = performance.now();
      const query = lockerQuerySchema.parse(req.query);
      const canViewSensitive = LockerController.canViewSensitive(req);
      const result = await LockerService.getLockers(query, canViewSensitive);
      res.setHeader('Server-Timing', `locker-list;dur=${(performance.now() - startedAt).toFixed(1)}`);
      res.json(successResponse('Lockers fetched successfully', result));
    } catch (error) {
      next(error);
    }
  }

  static async getLockerStats(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const startedAt = performance.now();
      const query = lockerQuerySchema.parse(req.query);
      const stats = await LockerService.getLockerStats(query);
      res.setHeader('Server-Timing', `locker-stats;dur=${(performance.now() - startedAt).toFixed(1)}`);
      res.json(successResponse('Locker statistics fetched successfully', stats));
    } catch (error) {
      next(error);
    }
  }

  static async getAvailableLockers(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { size, rackNumber, section } = req.query as {
        size?: string;
        rackNumber?: string;
        section?: string;
      };
      const canViewSensitive = LockerController.canViewSensitive(req);
      const lockers = await LockerService.getAvailableLockers(
        { size, rackNumber, section },
        canViewSensitive
      );
      res.json(successResponse('Available lockers retrieved', lockers));
    } catch (error) {
      next(error);
    }
  }

  static async getLockerById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const canViewSensitive = LockerController.canViewSensitive(req);
      const locker = await LockerService.getLockerById(
        req.params.id as string,
        canViewSensitive
      );
      res.json(successResponse('Locker retrieved successfully', locker));
    } catch (error) {
      next(error);
    }
  }

  static async createLocker(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const input = createLockerSchema.parse(req.body);
      const ipAddress =
        (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const locker = await LockerService.createLocker(
        input,
        req.user?.userId,
        req.user?.username,
        ipAddress,
        userAgent
      );
      res.status(201).json(successResponse('Locker created successfully', locker));
    } catch (error) {
      next(error);
    }
  }

  static async bulkImportLockers(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const records = req.body.records;
      if (!Array.isArray(records) || records.length === 0) {
        res.status(400).json(errorResponse('No valid locker records supplied for import.'));
        return;
      }

      const ipAddress =
        (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await LockerService.bulkImportLockers(
        records,
        req.user?.userId,
        req.user?.username,
        ipAddress,
        userAgent
      );

      res.status(201).json(successResponse('Bulk import completed', result));
    } catch (error) {
      next(error);
    }
  }

  static async updateLocker(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const input = updateLockerSchema.parse(req.body);
      const ipAddress =
        (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const locker = await LockerService.updateLocker(
        req.params.id as string,
        input,
        req.user?.userId,
        req.user?.username,
        ipAddress,
        userAgent
      );
      res.json(successResponse('Locker updated successfully', locker));
    } catch (error) {
      next(error);
    }
  }

  static async deactivateLocker(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const ipAddress =
        (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      await LockerService.deactivateLocker(
        req.params.id as string,
        req.user?.userId,
        req.user?.username,
        ipAddress,
        userAgent
      );
      res.json(successResponse('Locker deactivated successfully'));
    } catch (error) {
      next(error);
    }
  }
}
