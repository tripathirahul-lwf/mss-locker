import mongoose,{ Types } from 'mongoose';
import { CustomerKycDocument,ICustomerKycDocument } from '../models/CustomerKycDocument';
import { Payment } from '../models/Payment';
import { Customer } from '../models/Customer';
import {
AddKycDocumentInput,
UpdateKycDocumentInput,
VerifyKycDocumentInput,
} from '../validators/customer.validator';
import { maskKycDocumentNumber,normalizeKycDocumentNumber } from '../utils/masking';
import { recordAuditLog } from '../utils/auditLogger';
import { KycStatus,KYC_POLICY } from '../constants/customer.constants';
import { StorageService } from './storage.service';

export class CustomerKycService {
  static async assertDocumentBelongsToCustomer(docId: string, customerId: string): Promise<void> {
    if (!Types.ObjectId.isValid(docId) || !Types.ObjectId.isValid(customerId)) throw Object.assign(new Error('Invalid customer or document ID.'), { statusCode: 400 });
    if (!await CustomerKycDocument.exists({ _id: docId, customerId, isActive: true })) throw Object.assign(new Error('KYC document not found for this customer.'), { statusCode: 404 });
  }
  private static async removeUnusedAttachment(url: string): Promise<void> {
    if (await CustomerKycDocument.exists({ documentUrl: url, isActive: true }) || await Payment.exists({ proofUrl: url }) || await Customer.exists({ photoUrl: url })) return;
    await StorageService.deleteFile(url);
  }

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

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const expired = (doc: ICustomerKycDocument) => !!doc.expiryDate && doc.expiryDate.toISOString().slice(0, 10) < today;
    const verifiedDocs = docs.filter((d) => d.verificationStatus === 'VERIFIED' && !expired(d));
    if (!verifiedDocs.length && docs.some(expired)) return 'EXPIRED';
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

    await Customer.findByIdAndUpdate(customerId, calculatedStatus === 'VERIFIED' ? { $set: updateData } : { $set: updateData, $unset: { kycVerifiedAt: '', kycVerifiedBy: '' } });
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
    const number = normalizeKycDocumentNumber(doc.documentNumber);
    obj.documentNumber = number;
    const masked = maskKycDocumentNumber(doc.documentType, number);

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

    return mongoose.connection.transaction(async session => {
    const customer = await Customer.findOneAndUpdate({ _id: customerId }, { $inc: { __v: 1 } }, { new: true, timestamps: false });
    if (!customer) {
      throw new Error('Customer not found');
    }
    StorageService.assertPrivateDocumentUrl(input.documentUrl.trim());

    const doc = new CustomerKycDocument({
      customerId: customer._id,
      documentType: input.documentType,
      documentNumber: normalizeKycDocumentNumber(input.documentNumber),
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
    }, session);

    return this.sanitizeKycDoc(doc, true);
    });
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

    let replacedDocumentUrl: string | undefined;
    const result = await mongoose.connection.transaction(async session => {
    const doc = await CustomerKycDocument.findOne({ _id: docId, isActive: true });
    if (!doc) {
      throw new Error('KYC document not found');
    }
    await Customer.findOneAndUpdate({ _id: doc.customerId }, { $inc: { __v: 1 } }, { timestamps: false });

    const typeChanged = input.documentType !== undefined && input.documentType !== doc.documentType;
    if (input.documentType) doc.documentType = input.documentType;
    if (input.documentNumber !== undefined) doc.documentNumber = normalizeKycDocumentNumber(input.documentNumber);
    replacedDocumentUrl = input.documentUrl && input.documentUrl.trim() !== doc.documentUrl ? doc.documentUrl : undefined;
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
    if (typeChanged || input.documentNumber !== undefined || input.documentUrl) {
      doc.verificationStatus = 'PENDING';
      doc.verifiedAt = undefined;
      doc.verifiedBy = undefined;
      doc.rejectionReason = undefined;
    }

    await doc.save();
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
    }, session);

    return this.sanitizeKycDoc(doc, true);
    });
    if (replacedDocumentUrl) await this.removeUnusedAttachment(replacedDocumentUrl);
    return result;
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

    return mongoose.connection.transaction(async session => {
    const doc = await CustomerKycDocument.findOne({ _id: docId, isActive: true });
    if (!doc) {
      throw new Error('KYC document not found');
    }
    await Customer.findOneAndUpdate({ _id: doc.customerId }, { $inc: { __v: 1 } }, { timestamps: false });

    if (input.status === 'VERIFIED' && doc.expiryDate && doc.expiryDate.toISOString().slice(0, 10) < new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())) throw Object.assign(new Error('Cannot verify an expired document.'), { statusCode: 400 });
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
    }, session);

    return this.sanitizeKycDoc(doc, true);
    });
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

    let deletedUrl: string | undefined;
    await mongoose.connection.transaction(async session => {
    const doc = await CustomerKycDocument.findOne({ _id: docId, isActive: true });
    if (!doc) {
      throw new Error('KYC document not found');
    }
    await Customer.findOneAndUpdate({ _id: doc.customerId }, { $inc: { __v: 1 } }, { timestamps: false });

    doc.isActive = false;
    await doc.save();
    deletedUrl = doc.documentUrl;

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
    }, session);
    });
    if (deletedUrl) await this.removeUnusedAttachment(deletedUrl);
  }
}
