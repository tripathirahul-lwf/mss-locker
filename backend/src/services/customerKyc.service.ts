import { Types } from 'mongoose';
import { CustomerKycDocument, ICustomerKycDocument } from '../models/CustomerKycDocument';
import { Customer } from '../models/Customer';
import {
  AddKycDocumentInput,
  UpdateKycDocumentInput,
  VerifyKycDocumentInput,
} from '../validators/customer.validator';
import { maskKycDocumentNumber } from '../utils/masking';
import { recordAuditLog } from '../utils/auditLogger';
import { KycStatus, KYC_POLICY } from '../constants/customer.constants';
import { StorageService } from './storage.service';

export class CustomerKycService {
  /**
   * Centralized KYC state calculation engine.
   * Recalculates customer overall KYC status from active KYC documents.
   */
  static async calculateCustomerKycStatus(
    customerId: string | Types.ObjectId
  ): Promise<KycStatus> {
    const docs = await CustomerKycDocument.find({
      customerId,
      isActive: true,
    });

    if (docs.length === 0) {
      return 'PENDING';
    }

    const hasRejected = docs.some((d) => d.verificationStatus === 'REJECTED');
    if (hasRejected) {
      return 'REJECTED';
    }

    const verifiedDocs = docs.filter((d) => d.verificationStatus === 'VERIFIED');
    const hasPrimaryVerified = verifiedDocs.some((d) =>
      KYC_POLICY.PRIMARY_DOC_TYPES.includes(d.documentType)
    );

    if (
      verifiedDocs.length >= KYC_POLICY.MIN_VERIFIED_DOCS &&
      hasPrimaryVerified
    ) {
      return 'VERIFIED';
    }

    return 'PARTIAL';
  }

  /**
   * Synchronizes and updates the customer document's kycStatus field.
   */
  private static async syncCustomerKycState(
    customerId: Types.ObjectId | string,
    actorUserId?: string
  ): Promise<KycStatus> {
    const calculatedStatus = await this.calculateCustomerKycStatus(customerId);
    const updateData: Record<string, unknown> = { kycStatus: calculatedStatus };

    if (calculatedStatus === 'VERIFIED') {
      updateData.kycVerifiedAt = new Date();
      if (actorUserId) {
        updateData.kycVerifiedBy = new Types.ObjectId(actorUserId);
      }
    }

    await Customer.findByIdAndUpdate(customerId, updateData);
    return calculatedStatus;
  }

  /**
   * Masks sensitive fields on a KYC document document if caller lacks sensitive permission.
   */
  private static sanitizeKycDoc(
    doc: ICustomerKycDocument,
    canViewSensitive: boolean
  ): Partial<ICustomerKycDocument> & { maskedDocumentNumber: string } {
    const obj = doc.toObject ? doc.toObject() : { ...doc };
    const masked = maskKycDocumentNumber(doc.documentType, doc.documentNumber);

    if (!canViewSensitive) {
      obj.documentNumber = masked;
    }

    return {
      ...obj,
      maskedDocumentNumber: masked,
    };
  }

  /**
   * Get all KYC documents for a specific customer.
   */
  static async getKycDocuments(
    customerId: string,
    canViewSensitive: boolean
  ): Promise<any[]> {
    if (!Types.ObjectId.isValid(customerId)) {
      throw new Error('Invalid customer ID');
    }

    const docs = await CustomerKycDocument.find({
      customerId,
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .populate('verifiedBy', 'name username')
      .populate('createdBy', 'name username');

    return docs.map((d) => this.sanitizeKycDoc(d, canViewSensitive));
  }

  /**
   * Add a new KYC document.
   */
  static async addKycDocument(
    customerId: string,
    input: AddKycDocumentInput,
    actorUserId?: string,
    actorUsername?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    if (!Types.ObjectId.isValid(customerId)) {
      throw new Error('Invalid customer ID');
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }
    StorageService.assertPrivateDocumentUrl(input.documentUrl.trim());

    const doc = new CustomerKycDocument({
      customerId: customer._id,
      documentType: input.documentType,
      documentNumber: input.documentNumber.trim(),
      documentUrl: input.documentUrl.trim(),
      documentName: input.documentName?.trim() || `${input.documentType} Document`,
      mimeType: input.mimeType || 'image/jpeg',
      fileSize: input.fileSize || 0,
      verificationStatus: 'PENDING',
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
      remarks: input.remarks?.trim() || '',
      isPrimary: input.isPrimary ?? false,
      isActive: true,
      createdBy: actorUserId ? new Types.ObjectId(actorUserId) : undefined,
    });

    await doc.save();

    // Recalculate customer overall KYC state
    await this.syncCustomerKycState(customer._id, actorUserId);

    // Audit Logging
    await recordAuditLog({
      actorUserId,
      actorUsername,
      action: 'KYC_DOCUMENT_ADDED',
      entityType: 'CUSTOMER_KYC',
      entityId: doc._id.toString(),
      description: `Added ${doc.documentType} document for customer ${customer.fullName} (${customer.customerCode})`,
      ipAddress,
      userAgent,
      metadata: {
        customerId: customer._id.toString(),
        customerCode: customer.customerCode,
        documentType: doc.documentType,
        maskedDocumentNumber: maskKycDocumentNumber(doc.documentType, doc.documentNumber),
      },
    });

    return this.sanitizeKycDoc(doc, true);
  }

  /**
   * Update a KYC document.
   */
  static async updateKycDocument(
    docId: string,
    input: UpdateKycDocumentInput,
    actorUserId?: string,
    actorUsername?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    if (!Types.ObjectId.isValid(docId)) {
      throw new Error('Invalid document ID');
    }

    const doc = await CustomerKycDocument.findById(docId);
    if (!doc) {
      throw new Error('KYC document not found');
    }

    if (input.documentType) doc.documentType = input.documentType;
    if (input.documentNumber) doc.documentNumber = input.documentNumber.trim();
    const replacedDocumentUrl = input.documentUrl && input.documentUrl.trim() !== doc.documentUrl ? doc.documentUrl : undefined;
    if (input.documentUrl) {
      StorageService.assertPrivateDocumentUrl(input.documentUrl.trim());
      doc.documentUrl = input.documentUrl.trim();
    }
    if (input.documentName) doc.documentName = input.documentName.trim();
    if (input.mimeType) doc.mimeType = input.mimeType;
    if (input.fileSize !== undefined) doc.fileSize = input.fileSize;
    if (input.expiryDate) doc.expiryDate = new Date(input.expiryDate);
    if (input.remarks !== undefined) doc.remarks = input.remarks.trim();
    if (input.isPrimary !== undefined) doc.isPrimary = input.isPrimary;

    // Reset status to PENDING if document or file was replaced
    if (input.documentNumber || input.documentUrl) {
      doc.verificationStatus = 'PENDING';
      doc.verifiedAt = undefined;
      doc.verifiedBy = undefined;
      doc.rejectionReason = undefined;
    }

    await doc.save();
    if (replacedDocumentUrl) await StorageService.deleteFile(replacedDocumentUrl);
    await this.syncCustomerKycState(doc.customerId, actorUserId);

    await recordAuditLog({
      actorUserId,
      actorUsername,
      action: 'KYC_DOCUMENT_UPDATED',
      entityType: 'CUSTOMER_KYC',
      entityId: doc._id.toString(),
      description: `Updated ${doc.documentType} document for customer ID ${doc.customerId}`,
      ipAddress,
      userAgent,
      metadata: {
        documentType: doc.documentType,
        maskedDocumentNumber: maskKycDocumentNumber(doc.documentType, doc.documentNumber),
      },
    });

    return this.sanitizeKycDoc(doc, true);
  }

  /**
   * Verify or Reject a KYC document.
   */
  static async verifyKycDocument(
    docId: string,
    input: VerifyKycDocumentInput,
    actorUserId?: string,
    actorUsername?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    if (!Types.ObjectId.isValid(docId)) {
      throw new Error('Invalid document ID');
    }

    const doc = await CustomerKycDocument.findById(docId);
    if (!doc) {
      throw new Error('KYC document not found');
    }

    doc.verificationStatus = input.status;
    doc.verifiedAt = new Date();
    if (actorUserId) {
      doc.verifiedBy = new Types.ObjectId(actorUserId);
    }
    if (input.status === 'REJECTED') {
      doc.rejectionReason = input.rejectionReason?.trim() || 'Documentation invalid';
    } else {
      doc.rejectionReason = '';
    }
    if (input.remarks) {
      doc.remarks = input.remarks.trim();
    }

    await doc.save();
    const newKycStatus = await this.syncCustomerKycState(doc.customerId, actorUserId);

    await recordAuditLog({
      actorUserId,
      actorUsername,
      action: input.status === 'VERIFIED' ? 'KYC_VERIFIED' : 'KYC_REJECTED',
      entityType: 'CUSTOMER_KYC',
      entityId: doc._id.toString(),
      description: `${input.status} ${doc.documentType} KYC document. Customer KYC is now ${newKycStatus}.`,
      ipAddress,
      userAgent,
      metadata: {
        documentType: doc.documentType,
        status: input.status,
        rejectionReason: doc.rejectionReason,
        customerKycStatus: newKycStatus,
      },
    });

    return this.sanitizeKycDoc(doc, true);
  }

  /**
   * Soft delete a KYC document.
   */
  static async deleteKycDocument(
    docId: string,
    actorUserId?: string,
    actorUsername?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    if (!Types.ObjectId.isValid(docId)) {
      throw new Error('Invalid document ID');
    }

    const doc = await CustomerKycDocument.findById(docId);
    if (!doc) {
      throw new Error('KYC document not found');
    }

    doc.isActive = false;
    await doc.save();
    await StorageService.deleteFile(doc.documentUrl);

    await this.syncCustomerKycState(doc.customerId, actorUserId);

    await recordAuditLog({
      actorUserId,
      actorUsername,
      action: 'KYC_DOCUMENT_REMOVED',
      entityType: 'CUSTOMER_KYC',
      entityId: doc._id.toString(),
      description: `Removed ${doc.documentType} KYC document for customer ID ${doc.customerId}`,
      ipAddress,
      userAgent,
      metadata: {
        documentType: doc.documentType,
      },
    });
  }
}
