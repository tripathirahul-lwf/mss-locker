import { Request,Response,NextFunction } from 'express';
import { z } from 'zod';
import { syncService } from '../services/sync.service';
import { logger } from '../utils/logger';
const syncQuery = z.object({ cursor: z.string().max(4000).optional(), limit: z.coerce.number().int().min(10).max(5000).default(2000) });

export class SyncController {
  async getIncrementalSync(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cursor, limit } = syncQuery.parse(req.query);

      const result = await syncService.getIncrementalSync(cursor, limit, req.user?.permissions || []);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error during incremental sync:', error);
      next(error);
    }
  }

  async getDashboardSync(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await syncService.getDashboardSync();
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error during dashboard sync:', error);
      next(error);
    }
  }
}

export const syncController = new SyncController();
