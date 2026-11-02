import { Request,Response,NextFunction } from 'express';
import { z } from 'zod';
import { searchService } from '../services/search.service';
import { quickPreviewService } from '../services/quick-preview.service';
import { logger } from '../utils/logger';
const searchQuery = z.object({ q: z.string().trim().max(160).default(''), limit: z.coerce.number().int().min(1).max(20).default(6), types: z.string().max(100).optional() });
const historyQuery = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(50).default(10) });
const entityId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid record ID');

export class SearchController {
  async globalSearch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q, limit, types: typeList } = searchQuery.parse(req.query);
      const types = typeList?.split(',');

      const userPermissions = (req.user?.permissions as string[]) || [];
      const isSuperAdmin = Boolean(req.user?.isSuperAdmin);

      const results = await searchService.globalSearch(
        q,
        userPermissions,
        limit,
        types,
        isSuperAdmin
      );

      res.status(200).json({
        success: true,
        data: results,
      });
    } catch (error: any) {
      logger.error('Error during global search:', error);
      next(error);
    }
  }

  async getCustomerQuickPreview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = entityId.parse(req.params.id);
      const preview = await quickPreviewService.getCustomerQuickPreview(id);
      if (!preview) {
        res.status(404).json({
          success: false,
          message: 'Customer record not found',
        });
        return;
      }
      res.status(200).json({
        success: true,
        data: preview,
      });
    } catch (error: any) {
      logger.error('Error fetching customer quick preview:', error);
      next(error);
    }
  }

  async getCustomerRenewalHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = entityId.parse(req.params.id);
      const { page, limit } = historyQuery.parse(req.query);

      const result = await quickPreviewService.getCustomerRenewalHistory(
        id,
        page,
        limit
      );

      res.status(200).json({
        success: true,
        data: result.invoices,
        pagination: result.pagination,
      });
    } catch (error: any) {
      logger.error('Error fetching customer renewal history:', error);
      next(error);
    }
  }

  async getLockerQuickPreview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = entityId.parse(req.params.id);
      const userPermissions = (req.user?.permissions as string[]) || [];
      const isSuperAdmin = Boolean(req.user?.isSuperAdmin);
      const preview = await quickPreviewService.getLockerQuickPreview(
        id,
        userPermissions,
        isSuperAdmin
      );

      if (!preview) {
        res.status(404).json({
          success: false,
          message: 'Locker record not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: preview,
      });
    } catch (error: any) {
      logger.error('Error fetching locker quick preview:', error);
      next(error);
    }
  }
}

export const searchController = new SearchController();
