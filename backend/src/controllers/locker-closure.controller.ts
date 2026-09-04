import { Request, Response } from 'express';
import { lockerClosureService } from '../services/locker-closure.service';
import { closureReadinessService } from '../services/closure-readiness.service';
import { logger } from '../utils/logger';

export class LockerClosureController {
  async getClosures(req: Request, res: Response): Promise<void> {
    try {
      const result = await lockerClosureService.getClosures(req.query as any);
      res.status(200).json({
        success: true,
        data: result.closures,
        pagination: result.pagination,
      });
    } catch (error: any) {
      logger.error('Error fetching closures:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch closure records',
      });
    }
  }

  async getClosureById(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const closure = await lockerClosureService.getClosureById(id);
      if (!closure) {
        res.status(404).json({
          success: false,
          message: 'Closure record not found',
        });
        return;
      }
      res.status(200).json({
        success: true,
        data: closure,
      });
    } catch (error: any) {
      logger.error('Error fetching closure by ID:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch closure record',
      });
    }
  }

  async getClosureReadiness(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      let allocationId = id;

      // If ID is closure ID, find its allocationId
      if (id.length === 24) {
        const closure = await lockerClosureService.getClosureById(id);
        if (closure && (closure as any).allocationId?._id) {
          allocationId = (closure as any).allocationId._id.toString();
        }
      }

      const readiness = await closureReadinessService.getReadiness(
        allocationId,
        req.body?.checklist
      );

      res.status(200).json({
        success: true,
        data: readiness,
      });
    } catch (error: any) {
      logger.error('Error calculating closure readiness:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to calculate closure readiness',
      });
    }
  }

  async getClosureStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await lockerClosureService.getClosureStats();
      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Error fetching closure stats:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch closure statistics',
      });
    }
  }

  async createClosure(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?._id;
      const closure = await lockerClosureService.createClosure(req.body, userId);
      res.status(201).json({
        success: true,
        data: closure,
        message: 'Locker closure workflow initiated successfully',
      });
    } catch (error: any) {
      logger.error('Error creating closure:', error);
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to create closure record',
      });
    }
  }

  async submitClosure(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const userId = (req as any).user?._id;
      const closure = await lockerClosureService.submitClosure(id, userId);
      res.status(200).json({
        success: true,
        data: closure,
        message: 'Closure submitted for operational review',
      });
    } catch (error: any) {
      logger.error('Error submitting closure:', error);
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to submit closure',
      });
    }
  }

  async reviewClosure(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const userId = (req as any).user?._id;
      const { reviewNotes, checklist } = req.body;
      const closure = await lockerClosureService.reviewClosure(
        id,
        reviewNotes,
        userId,
        checklist
      );
      res.status(200).json({
        success: true,
        data: closure,
        message: 'Closure reviewed successfully',
      });
    } catch (error: any) {
      logger.error('Error reviewing closure:', error);
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to review closure',
      });
    }
  }

  async approveClosure(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const userId = (req as any).user?._id;
      const { approvalNotes, overrideFinancial, overrideReason } = req.body;
      if (
        overrideFinancial &&
        !req.user?.isSuperAdmin &&
        !req.user?.permissions?.includes('closures.financial_override')
      ) {
        res.status(403).json({ success: false, message: 'Financial override permission is required.' });
        return;
      }
      const closure = await lockerClosureService.approveClosure(
        id,
        approvalNotes,
        userId,
        overrideFinancial,
        overrideReason
      );
      res.status(200).json({
        success: true,
        data: closure,
        message: 'Closure approved for final release',
      });
    } catch (error: any) {
      logger.error('Error approving closure:', error);
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to approve closure',
      });
    }
  }

  async completeClosure(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const userId = (req as any).user?._id;
      const { completionNotes } = req.body;
      const closure = await lockerClosureService.completeClosure(
        id,
        completionNotes,
        userId
      );
      res.status(200).json({
        success: true,
        data: closure,
        message: 'Locker closure completed, allocation closed and locker released',
      });
    } catch (error: any) {
      logger.error('Error completing closure:', error);
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to complete closure',
      });
    }
  }

  async rejectClosure(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const userId = (req as any).user?._id;
      const { reason } = req.body;
      const closure = await lockerClosureService.rejectClosure(
        id,
        reason,
        userId
      );
      res.status(200).json({
        success: true,
        data: closure,
        message: 'Closure request rejected',
      });
    } catch (error: any) {
      logger.error('Error rejecting closure:', error);
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to reject closure',
      });
    }
  }

  async cancelClosure(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const userId = (req as any).user?._id;
      const { reason } = req.body;
      const closure = await lockerClosureService.cancelClosure(
        id,
        reason,
        userId
      );
      res.status(200).json({
        success: true,
        data: closure,
        message: 'Closure request cancelled',
      });
    } catch (error: any) {
      logger.error('Error cancelling closure:', error);
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to cancel closure',
      });
    }
  }

  async getClosureStatementHtml(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const autoPrint = req.query.autoprint === 'true' || req.query.autoprint === '1';
      const html = await lockerClosureService.generateClosureStatementHtml(id, autoPrint);
      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(html);
    } catch (error: any) {
      logger.error('Error generating closure statement HTML:', error);
      const statusCode = error.statusCode || 500;
      res.status(statusCode).send(`<h2>Error generating statement: ${error.message || 'Server Error'}</h2>`);
    }
  }
}

export const lockerClosureController = new LockerClosureController();
