import { Request, Response } from 'express';
import { syncService } from '../services/sync.service';
import { logger } from '../utils/logger';

export class SyncController {
  async getIncrementalSync(req: Request, res: Response): Promise<void> {
    try {
      const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
      const limit = Math.min(5000, Math.max(10, Number(req.query.limit) || 2000));

      const result = await syncService.getIncrementalSync(cursor, limit, req.user?.permissions || []);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error during incremental sync:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Incremental sync failed',
      });
    }
  }

  async getDashboardSync(req: Request, res: Response): Promise<void> {
    try {
      const result = await syncService.getDashboardSync();
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error during dashboard sync:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Dashboard sync failed',
      });
    }
  }
}

export const syncController = new SyncController();
