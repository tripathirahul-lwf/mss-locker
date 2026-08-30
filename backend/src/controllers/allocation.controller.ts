import { Request, Response, NextFunction } from 'express';
import { LockerAllocationService } from '../services/allocation.service';
import {
  createAllocationSchema,
  reserveLockerSchema,
  updateAllocationSchema,
  allocationQuerySchema,
} from '../validators/allocation.validator';
import { successResponse } from '../utils/apiResponse';

export class LockerAllocationController {
  /**
   * GET /api/allocations
   */
  static async getAllocations(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedQuery = allocationQuerySchema.parse(req.query);
      const result = await LockerAllocationService.getAllocations(validatedQuery);
      res.json(successResponse('Allocations retrieved successfully', result));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/allocations/stats
   */
  static async getAllocationStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await LockerAllocationService.getAllocationStats();
      res.json(successResponse('Allocation statistics retrieved successfully', stats));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/allocations/:id
   */
  static async getAllocationById(req: Request, res: Response, next: NextFunction) {
    try {
      const allocationId = req.params.id as string;
      const allocation = await LockerAllocationService.getAllocationById(allocationId);
      res.json(successResponse('Allocation agreement retrieved', allocation));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/allocations
   */
  static async createAllocation(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedInput = createAllocationSchema.parse(req.body);
      const ipAddress =
        (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const actor = {
        userId: req.user?.userId,
        username: req.user?.username,
        ipAddress,
        userAgent,
      };

      const allocation = await LockerAllocationService.createAllocation(
        validatedInput,
        actor
      );

      res.status(201).json(
        successResponse(
          `Locker successfully allocated with Agreement #${allocation.allocationCode}`,
          allocation
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/allocations/reserve
   */
  static async reserveLocker(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedInput = reserveLockerSchema.parse(req.body);
      const ipAddress =
        (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const actor = {
        userId: req.user?.userId,
        username: req.user?.username,
        ipAddress,
        userAgent,
      };

      const allocation = await LockerAllocationService.reserveLocker(
        validatedInput,
        actor
      );

      res.status(201).json(
        successResponse(
          `Locker placed on hold/reservation with code #${allocation.allocationCode}`,
          allocation
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/allocations/:id/activate
   */
  static async activateReservation(req: Request, res: Response, next: NextFunction) {
    try {
      const allocationId = req.params.id as string;
      const ipAddress =
        (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const actor = {
        userId: req.user?.userId,
        username: req.user?.username,
        ipAddress,
        userAgent,
      };

      const allocation = await LockerAllocationService.activateReservation(
        allocationId,
        actor
      );

      res.json(
        successResponse(
          `Reservation #${allocation.allocationCode} successfully activated into active tenancy.`,
          allocation
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/allocations/:id/cancel
   */
  static async cancelReservation(req: Request, res: Response, next: NextFunction) {
    try {
      const allocationId = req.params.id as string;
      const ipAddress =
        (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const actor = {
        userId: req.user?.userId,
        username: req.user?.username,
        ipAddress,
        userAgent,
      };

      const allocation = await LockerAllocationService.cancelReservation(
        allocationId,
        actor
      );

      res.json(
        successResponse(
          `Reservation #${allocation.allocationCode} cancelled. Locker restored to vacant state.`,
          allocation
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/allocations/:id
   */
  static async updateAllocation(req: Request, res: Response, next: NextFunction) {
    try {
      const allocationId = req.params.id as string;
      const validatedInput = updateAllocationSchema.parse(req.body);
      const ipAddress =
        (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const actor = {
        userId: req.user?.userId,
        username: req.user?.username,
        ipAddress,
        userAgent,
      };

      const allocation = await LockerAllocationService.updateAllocation(
        allocationId,
        validatedInput,
        actor
      );

      res.json(successResponse('Allocation agreement updated successfully.', allocation));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/customers/:id/allocations
   */
  static async getCustomerAllocations(req: Request, res: Response, next: NextFunction) {
    try {
      const customerId = req.params.id as string;
      const result = await LockerAllocationService.getCustomerAllocations(customerId);
      res.json(successResponse('Customer allocations retrieved', result));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/lockers/:id/allocations
   */
  static async getLockerAllocations(req: Request, res: Response, next: NextFunction) {
    try {
      const lockerId = req.params.id as string;
      const result = await LockerAllocationService.getLockerAllocations(lockerId);
      res.json(successResponse('Locker tenancy history retrieved', result));
    } catch (error) {
      next(error);
    }
  }
}
