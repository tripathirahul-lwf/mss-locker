import { apiClient } from '../../../services/apiClient';
import {
  LockerInvoice,
  RenewalStats,
  InvoiceQueryParams,
  GenerateRenewalInput,
} from '../types';

const printPdfBlob = async (blob: Blob, invoiceNumber: string): Promise<void> => {
  const pdfUrl = URL.createObjectURL(blob);
  const safeInvoiceNumber = invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '-') || 'invoice';

  // 1. Open PDF directly in a new window/tab for native high-res preview & browser print dialog
  const printWindow = window.open(pdfUrl, '_blank');
  if (printWindow) {
    printWindow.focus();
    setTimeout(() => {
      URL.revokeObjectURL(pdfUrl);
    }, 60_000);
    return;
  }

  // 2. If browser blocks popups, fallback to automatic download
  const downloadLink = document.createElement('a');
  downloadLink.href = pdfUrl;
  downloadLink.download = `${safeInvoiceNumber}.pdf`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  setTimeout(() => URL.revokeObjectURL(pdfUrl), 10_000);
};

export const renewalApi = {
  /**
   * Get paginated invoices / renewals with filters
   */
  async getInvoices(params: InvoiceQueryParams = {}) {
    const response = await apiClient.get<{
      success: boolean;
      data: LockerInvoice[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>('/renewals', { params });
    return {
      invoices: response.data.data,
      pagination: response.data.pagination,
    };
  },

  /**
   * Get renewal dashboard stats
   */
  async getRenewalStats(): Promise<RenewalStats> {
    const response = await apiClient.get<{
      success: boolean;
      data: RenewalStats;
    }>('/renewals/stats');
    return response.data.data;
  },

  /**
   * Get single invoice dossier
   */
  async getInvoiceById(id: string): Promise<LockerInvoice> {
    const response = await apiClient.get<{
      success: boolean;
      data: LockerInvoice;
    }>(`/renewals/${id}`);
    return response.data.data;
  },

  /**
   * Get backend-generated print-ready HTML invoice
   */
  async getInvoiceHtml(id: string, autoPrint = false): Promise<string> {
    const response = await apiClient.get<string>(`/renewals/${id}/html`, {
      params: { autoprint: autoPrint },
      responseType: 'text' as any,
    });
    return response.data;
  },

  /**
   * Print invoice seamlessly directly on current page without opening any new tab
   */
  async printInvoicePdf(id: string, _invoiceNumber?: string): Promise<void> {
    const invoiceHtml = await this.getInvoiceHtml(id);
    const iframe = document.createElement('iframe'); iframe.title = 'Invoice print document'; iframe.setAttribute('aria-hidden', 'true');
    Object.assign(iframe.style, { position: 'fixed', width: '0', height: '0', border: '0', visibility: 'hidden' });
    document.body.appendChild(iframe);
    try {
      const win = iframe.contentWindow, doc = iframe.contentDocument;
      if (!win || !doc) throw new Error('Invoice print document could not be created.');
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => { iframe.remove(); reject(new Error('Invoice print document timed out.')); }, 10000);
        iframe.onload = () => { window.clearTimeout(timeout); try { win.addEventListener('afterprint', () => iframe.remove(), { once: true }); win.focus(); win.print(); resolve(); window.setTimeout(() => iframe.remove(), 60000); } catch (error) { reject(error); } };
        doc.open(); doc.write(invoiceHtml); doc.close();
      });
    } catch (error) { iframe.remove(); throw error; }

  },

  /**
   * Generate next recurring renewal invoice for an active allocation
   */
  async generateRenewal(data: GenerateRenewalInput): Promise<LockerInvoice> {
    const response = await apiClient.post<{
      success: boolean;
      data: LockerInvoice;
      message: string;
    }>('/renewals/generate', data);
    return response.data.data;
  },

  /**
   * Cancel an unpaid invoice
   */
  async cancelInvoice(id: string, reason: string): Promise<LockerInvoice> {
    const response = await apiClient.post<{
      success: boolean;
      data: LockerInvoice;
      message: string;
    }>(`/renewals/${id}/cancel`, { reason });
    return response.data.data;
  },

  /**
   * Update custom billing period (start and end date) for an invoice
   */
  async updateBillingPeriod(
    id: string,
    billingPeriodStart: string,
    billingPeriodEnd: string,
    expectedUpdatedAt?: string
  ): Promise<LockerInvoice> {
    const response = await apiClient.patch<{
      success: boolean;
      data: LockerInvoice;
      message: string;
    }>(`/renewals/${id}/billing-period`, {
      billingPeriodStart,
      billingPeriodEnd,
      expectedUpdatedAt,
    });
    return response.data.data;
  },

  /**
   * Get all invoices for a customer
   */
  async getCustomerInvoices(customerId: string): Promise<LockerInvoice[]> {
    const response = await apiClient.get<{
      success: boolean;
      data: LockerInvoice[];
    }>(`/renewals/customer/${customerId}`);
    return response.data.data;
  },

  /**
   * Get all invoices for a locker
   */
  async getLockerInvoices(lockerId: string): Promise<LockerInvoice[]> {
    const response = await apiClient.get<{
      success: boolean;
      data: LockerInvoice[];
    }>(`/renewals/locker/${lockerId}`);
    return response.data.data;
  },

  /**
   * Get all invoices for an allocation
   */
  async getAllocationInvoices(allocationId: string): Promise<LockerInvoice[]> {
    const response = await apiClient.get<{
      success: boolean;
      data: LockerInvoice[];
    }>(`/renewals/allocation/${allocationId}`);
    return response.data.data;
  },
};
