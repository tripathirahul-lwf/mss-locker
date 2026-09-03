import { Request, Response } from 'express';
import { billingService } from '../services/billing.service';
import { renewalService } from '../services/renewal.service';
import { logger } from '../utils/logger';
import { invoicePdfService } from '../services/invoice-pdf.service';
import { recordAuditLog } from '../utils/auditLogger';

export class BillingController {
  async downloadInvoicePdf(req: Request, res: Response): Promise<void> {
    try {
      const result = await invoicePdfService.generate(String(req.params.id));
      await recordAuditLog({ actorUserId: req.user?._id, actorUsername: req.user?.username, action: 'INVOICE_PDF_EXPORTED', entityType: 'LockerInvoice', entityId: String(req.params.id), description: `Generated printable PDF for invoice ${result.invoiceNumber}`, ipAddress: req.ip, userAgent: req.get('user-agent') });
      const safeName = result.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '-');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${safeName}.pdf"`);
      res.setHeader('Content-Length', result.buffer.length.toString());
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(result.buffer);
    } catch (error: any) {
      logger.error('Error generating invoice PDF:', error);
      res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to generate invoice PDF' });
    }
  }

  async getInvoiceHtml(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const autoPrint = req.query.autoprint === 'true' || req.query.autoprint === '1';
      const html = await billingService.generateInvoiceHtml(id, autoPrint);
      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(html);
    } catch (error: any) {
      logger.error('Error generating invoice HTML:', error);
      const statusCode = error.statusCode || 500;
      res.status(statusCode).send(`<h2>Error generating invoice: ${error.message || 'Server Error'}</h2>`);
    }
  }
  async getInvoices(req: Request, res: Response): Promise<void> {
    try {
      const result = await billingService.getInvoices(req.query as any);
      res.status(200).json({
        success: true,
        data: result.invoices,
        pagination: result.pagination,
      });
    } catch (error: any) {
      logger.error('Error fetching invoices:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch invoices',
      });
    }
  }

  async getInvoiceById(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const invoice = await billingService.getInvoiceById(id);
      if (!invoice) {
        res.status(404).json({
          success: false,
          message: 'Invoice not found',
        });
        return;
      }
      res.status(200).json({
        success: true,
        data: invoice,
      });
    } catch (error: any) {
      logger.error('Error fetching invoice by ID:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch invoice',
      });
    }
  }

  async getRenewalStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await billingService.getRenewalStats();
      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Error fetching renewal stats:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch renewal statistics',
      });
    }
  }

  async generateRenewal(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?._id;
      const invoice = await renewalService.generateRenewalInvoice({
        ...req.body,
        userId,
      });
      res.status(201).json({
        success: true,
        data: invoice,
        message: 'Renewal invoice generated successfully',
      });
    } catch (error: any) {
      logger.error('Error generating renewal invoice:', error);
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to generate renewal invoice',
      });
    }
  }

  async cancelInvoice(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const userId = (req as any).user?._id;
      const { reason } = req.body;
      const invoice = await billingService.cancelInvoice(id, reason, userId);
      res.status(200).json({
        success: true,
        data: invoice,
        message: 'Invoice cancelled successfully',
      });
    } catch (error: any) {
      logger.error('Error cancelling invoice:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to cancel invoice',
      });
    }
  }

  async getCustomerInvoices(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const invoices = await billingService.getCustomerInvoices(id);
      res.status(200).json({
        success: true,
        data: invoices,
      });
    } catch (error: any) {
      logger.error('Error fetching customer invoices:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch customer invoices',
      });
    }
  }

  async getLockerInvoices(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const invoices = await billingService.getLockerInvoices(id);
      res.status(200).json({
        success: true,
        data: invoices,
      });
    } catch (error: any) {
      logger.error('Error fetching locker invoices:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch locker invoices',
      });
    }
  }

  async getAllocationInvoices(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const invoices = await billingService.getAllocationInvoices(id);
      res.status(200).json({
        success: true,
        data: invoices,
      });
    } catch (error: any) {
      logger.error('Error fetching allocation invoices:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch allocation invoices',
      });
    }
  }
}

export const billingController = new BillingController();
