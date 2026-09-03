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
    // 1. Fetch clean backend-generated bank standard HTML invoice
    const invoiceHtml = await this.getInvoiceHtml(id);

    // 2. Print via isolated iframe to guarantee no tab switching and no popup blocker
    let iframe = document.getElementById('invoice-print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'invoice-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(invoiceHtml);
      doc.close();
      iframe.contentWindow?.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
      }, 250);
    } else {
      window.print();
    }
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
