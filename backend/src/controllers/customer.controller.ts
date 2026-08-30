import { Request, Response, NextFunction } from 'express';
import { CustomerService } from '../services/customer.service';
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerQuerySchema,
  checkDuplicateCustomerSchema,
} from '../validators/customer.validator';
import { successResponse } from '../utils/apiResponse';
import { PERMISSIONS } from '../constants/permissions';

export class CustomerController {
  private static canViewSensitive(req: Request): boolean {
    if (!req.user) return false;
    return (
      req.user.isSuperAdmin ||
      req.user.permissions.includes(PERMISSIONS.CUSTOMERS_VIEW_SENSITIVE)
    );
  }

  static async getCustomers(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = customerQuerySchema.parse(req.query);
      const canViewSensitive = CustomerController.canViewSensitive(req);
      const result = await CustomerService.getCustomers(query, canViewSensitive);
      res.json(successResponse('Customers fetched successfully', result));
    } catch (error) {
      next(error);
    }
  }

  static async getCustomerStats(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const stats = await CustomerService.getCustomerStats();
      res.json(successResponse('Customer statistics fetched successfully', stats));
    } catch (error) {
      next(error);
    }
  }

  static async checkDuplicate(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const input = checkDuplicateCustomerSchema.parse(req.body);
      const result = await CustomerService.checkDuplicate(input);
      res.json(successResponse('Duplicate customer check completed', result));
    } catch (error) {
      next(error);
    }
  }

  static async getCustomerById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const canViewSensitive = CustomerController.canViewSensitive(req);
      const customer = await CustomerService.getCustomerById(
        req.params.id as string,
        canViewSensitive
      );
      res.json(successResponse('Customer details retrieved successfully', customer));
    } catch (error) {
      next(error);
    }
  }

  static async createCustomer(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const input = createCustomerSchema.parse(req.body);
      const ipAddress =
        (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const customer = await CustomerService.createCustomer(
        input,
        req.user?.userId,
        req.user?.username,
        ipAddress,
        userAgent
      );
      res.status(201).json(successResponse('Customer created successfully', customer));
    } catch (error) {
      next(error);
    }
  }

  static async updateCustomer(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const input = updateCustomerSchema.parse(req.body);
      const ipAddress =
        (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const customer = await CustomerService.updateCustomer(
        req.params.id as string,
        input,
        req.user?.userId,
        req.user?.username,
        ipAddress,
        userAgent
      );
      res.json(successResponse('Customer updated successfully', customer));
    } catch (error) {
      next(error);
    }
  }

  static async deactivateCustomer(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const ipAddress =
        (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      await CustomerService.deactivateCustomer(
        req.params.id as string,
        req.user?.userId,
        req.user?.username,
        ipAddress,
        userAgent
      );
      res.json(successResponse('Customer archived successfully'));
    } catch (error) {
      next(error);
    }
  }
}
