import { Request, Response } from 'express';
import { depositService } from '../services/deposit.service';
import { DepositTransaction } from '../models/DepositTransaction';

export class DepositController {
  async getDepositSummary(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const summary = await depositService.getDepositSummary(id);
      res.json({ success: true, data: summary });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getDepositTransactions(req: Request, res: Response): Promise<void> {
    try {
      const result = await depositService.getDepositTransactions(req.query as any);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getDepositTransactionById(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const transaction = await DepositTransaction.findById(id)
        .populate('customerId', 'fullName customerCode phone email address')
        .populate('lockerId', 'lockerNumber size rackNumber section floor')
        .populate('allocationId', 'allocationCode startDate billingCycle depositSnapshot securityDeposit')
        .populate('paymentId', 'paymentNumber receiptNumber paymentDate paymentMethod amount')
        .populate('recordedBy', 'name email')
        .populate('cancelledBy', 'name email')
        .lean();

      if (!transaction) {
        res.status(404).json({ success: false, message: 'Deposit transaction not found' });
        return;
      }

      res.json({ success: true, data: transaction });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getDepositStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await depositService.getDepositStats();
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async collectDeposit(req: Request, res: Response): Promise<void> {
    try {
      const userId = String((req as any).user?.id || (req as any).user?._id);
      const idempotencyKey = req.headers['idempotency-key'] as string;

      const result = await depositService.collectDeposit(
        req.body,
        userId,
        idempotencyKey
      );

      res.status(201).json({
        success: true,
        message: 'Security deposit collected successfully',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async adjustDeposit(req: Request, res: Response): Promise<void> {
    try {
      const userId = String((req as any).user?.id || (req as any).user?._id);
      const result = await depositService.adjustDeposit(req.body, userId);

      res.json({
        success: true,
        message: 'Deposit adjustment recorded successfully',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async cancelDepositTransaction(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const { cancellationReason } = req.body;
      const userId = String((req as any).user?.id || (req as any).user?._id);

      const result = await depositService.cancelDepositTransaction(
        id,
        cancellationReason,
        userId
      );

      res.json({
        success: true,
        message: 'Deposit transaction cancelled successfully',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getClosureReadiness(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const result = await depositService.getClosureFinancialReadiness(id);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}

export const depositController = new DepositController();
