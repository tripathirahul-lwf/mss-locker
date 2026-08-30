import { apiClient } from '../../../services/apiClient';
import {
  LockerInvoice,
  RenewalStats,
  InvoiceQueryParams,
  GenerateRenewalInput,
} from '../types';

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

const printPdfBlob = async (blob: Blob, invoiceNumber: string): Promise<void> => {
  const pdfUrl = URL.createObjectURL(blob);
  const printFrame = document.createElement('iframe');
  const originalTitle = document.title;
  const safeInvoiceNumber = invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '-') || 'invoice';
  const userAgent = navigator.userAgent;
  const needsVisibleFrame = /Firefox/i.test(userAgent)
    || (/Safari/i.test(userAgent) && !/Chrome|Chromium|CriOS|Edg/i.test(userAgent));

  printFrame.setAttribute('aria-hidden', 'true');
  printFrame.setAttribute('title', 'Printable invoice');
  printFrame.style.position = 'fixed';
  printFrame.style.left = '0';
  printFrame.style.bottom = '0';
  printFrame.style.border = '0';
  printFrame.style.pointerEvents = 'none';
  printFrame.style.opacity = '0';
  printFrame.style.width = needsVisibleFrame ? '1px' : '0';
  printFrame.style.height = needsVisibleFrame ? '100px' : '0';

  try {
    document.body.appendChild(printFrame);
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error('The printable invoice took too long to load.')),
        20_000,
      );

      printFrame.onload = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      printFrame.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error('The printable invoice could not be loaded.'));
      };
      printFrame.src = pdfUrl;
    });

    // Native PDF viewers need a short render window after the iframe load event.
    await wait(needsVisibleFrame ? 1_000 : 250);
    const printWindow = printFrame.contentWindow;
    if (!printWindow) throw new Error('The browser print window is unavailable.');

    // Browsers use the host page title as the default "Save as PDF" filename.
    document.title = safeInvoiceNumber;
    printWindow.focus();
    printWindow.print();

    // Preserve the frame briefly for browsers whose PDF print call returns early.
    await wait(needsVisibleFrame ? 3_000 : 500);
  } finally {
    document.title = originalTitle;
    printFrame.onload = null;
    printFrame.onerror = null;
    printFrame.remove();
    URL.revokeObjectURL(pdfUrl);
  }
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

  async printInvoicePdf(id: string, invoiceNumber: string): Promise<void> {
    const response = await apiClient.get(`/renewals/${id}/pdf`, { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    await printPdfBlob(blob, invoiceNumber);
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
