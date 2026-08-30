import { Request, Response } from 'express';
import { refundService } from '../services/refund.service';

export class RefundController {
  async getRefunds(req: Request, res: Response): Promise<void> {
    try {
      const result = await refundService.getRefunds(req.query as any);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getRefundById(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const result = await refundService.getRefundById(id);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  async createRefund(req: Request, res: Response): Promise<void> {
    try {
      const userId = String((req as any).user?.id || (req as any).user?._id);
      const refund = await refundService.createRefundRequest(req.body, userId);
      res.status(201).json({
        success: true,
        message: 'Refund request created successfully',
        data: refund,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async submitRefund(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const userId = String((req as any).user?.id || (req as any).user?._id);
      const refund = await refundService.submitRefundRequest(id, userId);
      res.json({
        success: true,
        message: 'Refund request submitted for manager approval',
        data: refund,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async approveRefund(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const { approvedAmount, notes } = req.body;
      const userId = String((req as any).user?.id || (req as any).user?._id);

      const refund = await refundService.approveRefund(
        id,
        Number(approvedAmount),
        notes,
        userId
      );

      res.json({
        success: true,
        message: 'Refund request approved successfully',
        data: refund,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async rejectRefund(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const { rejectionReason } = req.body;
      const userId = String((req as any).user?.id || (req as any).user?._id);

      const refund = await refundService.rejectRefund(id, rejectionReason, userId);

      res.json({
        success: true,
        message: 'Refund request rejected',
        data: refund,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async payRefund(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const userId = String((req as any).user?.id || (req as any).user?._id);
      const idempotencyKey = req.headers['idempotency-key'] as string;

      const result = await refundService.payRefund(
        id,
        req.body,
        userId,
        idempotencyKey
      );

      res.json({
        success: true,
        message: 'Refund payout recorded successfully',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async cancelRefund(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const { cancellationReason } = req.body;
      const userId = String((req as any).user?.id || (req as any).user?._id);

      const refund = await refundService.cancelRefund(
        id,
        cancellationReason,
        userId
      );

      res.json({
        success: true,
        message: 'Refund request cancelled',
        data: refund,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}

export const refundController = new RefundController();
