import { Request, Response } from 'express';
import { searchService } from '../services/search.service';
import { quickPreviewService } from '../services/quick-preview.service';
import { logger } from '../utils/logger';

export class SearchController {
  async globalSearch(req: Request, res: Response): Promise<void> {
    try {
      const q = String(req.query.q || '');
      const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 6));
      const types = req.query.types ? String(req.query.types).split(',') : undefined;

      const userPermissions = (req as any).user?.role?.permissions || [];

      const results = await searchService.globalSearch(
        q,
        userPermissions,
        limit,
        types
      );

      res.status(200).json({
        success: true,
        data: results,
      });
    } catch (error: any) {
      logger.error('Error during global search:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Global search failed',
      });
    }
  }

  async getCustomerQuickPreview(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
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
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch customer quick preview',
      });
    }
  }

  async getCustomerRenewalHistory(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

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
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch customer renewal history',
      });
    }
  }

  async getLockerQuickPreview(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const userPermissions = (req as any).user?.role?.permissions || [];
      const preview = await quickPreviewService.getLockerQuickPreview(
        id,
        userPermissions
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
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch locker quick preview',
      });
    }
  }
}

export const searchController = new SearchController();
