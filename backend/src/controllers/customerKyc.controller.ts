import { Request, Response, NextFunction } from 'express';
import { CustomerKycService } from '../services/customerKyc.service';
import {
  addKycDocumentSchema,
  updateKycDocumentSchema,
  verifyKycDocumentSchema,
} from '../validators/customer.validator';
import { successResponse } from '../utils/apiResponse';
import { PERMISSIONS } from '../constants/permissions';

export class CustomerKycController {
  private static canViewSensitive(req: Request): boolean {
    if (!req.user) return false;
    return (
      req.user.isSuperAdmin ||
      req.user.permissions.includes(PERMISSIONS.CUSTOMERS_VIEW_SENSITIVE)
    );
  }

  static async getKycDocuments(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const canViewSensitive = CustomerKycController.canViewSensitive(req);
      const docs = await CustomerKycService.getKycDocuments(
        req.params.id as string,
        canViewSensitive
      );
      res.json(successResponse('Customer KYC documents retrieved', docs));
    } catch (error) {
      next(error);
    }
  }

  static async addKycDocument(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const input = addKycDocumentSchema.parse(req.body);
      const ipAddress =
        (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const doc = await CustomerKycService.addKycDocument(
        req.params.id as string,
        input,
        req.user?.userId,
        req.user?.username,
        ipAddress,
        userAgent
      );
      res.status(201).json(successResponse('KYC document added successfully', doc));
    } catch (error) {
      next(error);
    }
  }

  static async updateKycDocument(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const input = updateKycDocumentSchema.parse(req.body);
      const ipAddress =
        (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const doc = await CustomerKycService.updateKycDocument(
        req.params.kycId as string,
        input,
        req.user?.userId,
        req.user?.username,
        ipAddress,
        userAgent
      );
      res.json(successResponse('KYC document updated successfully', doc));
    } catch (error) {
      next(error);
    }
  }

  static async verifyKycDocument(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const input = verifyKycDocumentSchema.parse(req.body);
      const ipAddress =
        (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const doc = await CustomerKycService.verifyKycDocument(
        req.params.kycId as string,
        input,
        req.user?.userId,
        req.user?.username,
        ipAddress,
        userAgent
      );
      res.json(successResponse('KYC verification status updated', doc));
    } catch (error) {
      next(error);
    }
  }

  static async deleteKycDocument(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const ipAddress =
        (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      await CustomerKycService.deleteKycDocument(
        req.params.kycId as string,
        req.user?.userId,
        req.user?.username,
        ipAddress,
        userAgent
      );
      res.json(successResponse('KYC document removed successfully'));
    } catch (error) {
      next(error);
    }
  }
}
