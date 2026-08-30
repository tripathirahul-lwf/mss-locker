import { Request, Response } from 'express';
import { paymentService } from '../services/payment.service';
import { logger } from '../utils/logger';

export class PaymentController {
  async getPayments(req: Request, res: Response): Promise<void> {
    try {
      const result = await paymentService.getPayments(req.query as any);
      res.status(200).json({
        success: true,
        data: result.payments,
        pagination: result.pagination,
      });
    } catch (error: any) {
      logger.error('Error fetching payments:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch payments',
      });
    }
  }

  async getPaymentById(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const payment = await paymentService.getPaymentById(id);
      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Payment not found',
        });
        return;
      }
      res.status(200).json({
        success: true,
        data: payment,
      });
    } catch (error: any) {
      logger.error('Error fetching payment by ID:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch payment',
      });
    }
  }

  async recordPayment(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?._id;
      const idempotencyKey = (req.headers['idempotency-key'] as string) || (req.body.idempotencyKey as string);

      const payment = await paymentService.recordPayment(req.body, userId, idempotencyKey);
      res.status(201).json({
        success: true,
        data: payment,
        message: 'Payment recorded and invoice settled successfully',
      });
    } catch (error: any) {
      logger.error('Error recording payment:', error);
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to record payment',
      });
    }
  }

  async cancelPayment(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const userId = (req as any).user?._id;
      const { reason } = req.body;

      const payment = await paymentService.cancelPayment(id, reason, userId);
      res.status(200).json({
        success: true,
        data: payment,
        message: 'Payment cancelled and invoice balance reopened',
      });
    } catch (error: any) {
      logger.error('Error cancelling payment:', error);
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to cancel payment',
      });
    }
  }

  async getPaymentStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await paymentService.getPaymentStats();
      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Error fetching payment stats:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch payment statistics',
      });
    }
  }

  async getCustomerPayments(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const payments = await paymentService.getCustomerPayments(id);
      res.status(200).json({
        success: true,
        data: payments,
      });
    } catch (error: any) {
      logger.error('Error fetching customer payments:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch customer payments',
      });
    }
  }

  async getLockerPayments(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const payments = await paymentService.getLockerPayments(id);
      res.status(200).json({
        success: true,
        data: payments,
      });
    } catch (error: any) {
      logger.error('Error fetching locker payments:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch locker payments',
      });
    }
  }

  async getInvoicePayments(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const payments = await paymentService.getInvoicePayments(id);
      res.status(200).json({
        success: true,
        data: payments,
      });
    } catch (error: any) {
      logger.error('Error fetching invoice payments:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch invoice payments',
      });
    }
  }

  async getPaymentReceiptHtml(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const autoPrint = req.query.autoprint === 'true' || req.query.autoprint === '1';
      const html = await paymentService.generatePaymentReceiptHtml(id, autoPrint);
      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(html);
    } catch (error: any) {
      logger.error('Error generating payment receipt HTML:', error);
      const statusCode = error.statusCode || 500;
      res.status(statusCode).send(`<h2>Error generating receipt: ${error.message || 'Server Error'}</h2>`);
    }
  }
}

export const paymentController = new PaymentController();
