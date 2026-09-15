import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { v2 as cloudinary, UploadApiOptions, UploadApiResponse } from 'cloudinary';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface UploadFileInput { buffer: Buffer; originalName: string; mimeType: string; folder?: string }
export interface UploadFileResult { fileUrl: string; fileKey: string; fileName: string; mimeType: string; size: number; originalSize: number; compressionSavedBytes: number; storageProvider: 'cloudinary' }
type CloudAssetRef = { publicId: string; resourceType: 'image' | 'raw'; deliveryType: 'upload' | 'authenticated'; format?: string };

export class StorageService {
  private static uploadBaseDir = path.resolve(process.cwd(), 'uploads');
  private static allowedFolders = new Set(['photos', 'kyc', 'general', 'payments']);
  private static imageMimes = new Set(['image/jpeg', 'image/png', 'image/webp']);

  static init(): void {
    if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET, secure: true });
  }

  static isValidMimeType(mimeType: string): boolean { return this.imageMimes.has(mimeType.toLowerCase()) || mimeType.toLowerCase() === 'application/pdf'; }
  static hasValidSignature(buffer: Buffer, mimeType: string): boolean {
    if (buffer.length < 12) return false;
    if (mimeType === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (mimeType === 'image/webp') return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
    if (mimeType === 'application/pdf') return buffer.subarray(0, 5).toString() === '%PDF-';
    return false;
  }

  private static assertConfigured(): void {
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) throw Object.assign(new Error('Cloud document storage is not configured.'), { statusCode: 503 });
    this.init();
  }

  static async compressImage(buffer: Buffer, mimeType: string): Promise<Buffer> {
    if (!this.imageMimes.has(mimeType)) return buffer;
    let pipeline = sharp(buffer, { failOn: 'warning', limitInputPixels: 40_000_000 }).rotate().resize({ width: 2500, height: 2500, fit: 'inside', withoutEnlargement: true });
    if (mimeType === 'image/jpeg') pipeline = pipeline.jpeg({ quality: 82, mozjpeg: true });
    if (mimeType === 'image/png') pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
    if (mimeType === 'image/webp') pipeline = pipeline.webp({ quality: 82, effort: 5 });
    return pipeline.toBuffer();
  }

  private static uploadBuffer(buffer: Buffer, options: UploadApiOptions): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(options, (error, result) => error || !result ? reject(error || new Error('Cloud upload returned no result')) : resolve(result));
      stream.end(buffer);
    });
  }
  private static encodeRef(ref: CloudAssetRef): string {
    const payload = Buffer.from(JSON.stringify(ref)).toString('base64url');
    const signature = crypto.createHmac('sha256', env.STORAGE_REFERENCE_SECRET!).update(payload).digest('base64url');
    return `${payload}.${signature}`;
  }
  static decodeRef(token: string): CloudAssetRef {
    try {
      const [payload, signature, extra] = token.split('.');
      if (!payload || !signature || extra || !env.STORAGE_REFERENCE_SECRET) throw new Error();
      const expected = crypto.createHmac('sha256', env.STORAGE_REFERENCE_SECRET).update(payload).digest();
      const actual = Buffer.from(signature, 'base64url');
      if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new Error();
      const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as CloudAssetRef;
      if (!value.publicId || !['image', 'raw'].includes(value.resourceType) || !['upload', 'authenticated'].includes(value.deliveryType)) throw new Error();
      return value;
    } catch { throw Object.assign(new Error('Invalid cloud file identifier.'), { statusCode: 400 }); }
  }

  static async uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
    this.assertConfigured();
    const mimeType = input.mimeType.toLowerCase();
    if (!this.isValidMimeType(mimeType) || !this.hasValidSignature(input.buffer, mimeType)) throw Object.assign(new Error('Unsupported or invalid file. Allowed: JPEG, PNG, WebP, PDF.'), { statusCode: 400 });
    const category = input.folder || 'general';
    if (!this.allowedFolders.has(category)) throw Object.assign(new Error('Invalid upload category.'), { statusCode: 400 });
    const buffer = await this.compressImage(input.buffer, mimeType);
    const resourceType: 'image' | 'raw' = this.imageMimes.has(mimeType) ? 'image' : 'raw';
    const isPublicPhoto = category === 'photos';
    const deliveryType: 'upload' | 'authenticated' = isPublicPhoto ? 'upload' : 'authenticated';
    const folder = isPublicPhoto ? env.CLOUDINARY_PHOTO_FOLDER : env.CLOUDINARY_KYC_FOLDER;
    const identifier = `${Date.now()}-${crypto.randomBytes(16).toString('hex')}${resourceType === 'raw' ? '.pdf' : ''}`;
    const result = await this.uploadBuffer(buffer, { public_id: identifier, folder, resource_type: resourceType, type: deliveryType, overwrite: false, unique_filename: false, use_filename: false, context: { original_name: path.basename(input.originalName).slice(0, 180), category } });
    const ref: CloudAssetRef = { publicId: result.public_id, resourceType, deliveryType, format: result.format };
    const token = this.encodeRef(ref);
    const fileUrl = isPublicPhoto ? result.secure_url : `/api/upload/private/cloud/${token}`;
    logger.info('Cloud file uploaded', { publicId: result.public_id, category, bytes: result.bytes, originalBytes: input.buffer.length });
    return { fileUrl, fileKey: token, fileName: input.originalName, mimeType, size: result.bytes || buffer.length, originalSize: input.buffer.length, compressionSavedBytes: Math.max(0, input.buffer.length - buffer.length), storageProvider: 'cloudinary' };
  }

  static getPrivateDownloadUrl(token: string, expiresInSeconds = 300): string {
    this.assertConfigured(); const ref = this.decodeRef(token);
    if (ref.deliveryType !== 'authenticated') throw Object.assign(new Error('Asset is not private.'), { statusCode: 400 });
    return cloudinary.utils.private_download_url(ref.publicId, ref.format || '', { resource_type: ref.resourceType, type: ref.deliveryType, expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds });
  }

  static assertPrivateDocumentUrl(fileUrl: string): void {
    if (fileUrl.startsWith('/uploads/kyc/')) return; // legacy records/imports
    const match = fileUrl.match(/^\/api\/upload\/private\/cloud\/([^/?#]+)$/);
    if (!match || this.decodeRef(match[1]).deliveryType !== 'authenticated') {
      throw Object.assign(new Error('KYC document must reference an authenticated uploaded asset.'), { statusCode: 400 });
    }
  }

  static resolvePrivateKycFile(fileName: string): string {
    if (!/^[a-zA-Z0-9.-]+$/.test(fileName) || fileName.includes('..')) throw Object.assign(new Error('Invalid file identifier.'), { statusCode: 400 });
    const directory = path.resolve(this.uploadBaseDir, 'kyc'); const filePath = path.resolve(directory, fileName);
    if (!filePath.startsWith(`${directory}${path.sep}`) || !fs.existsSync(filePath)) throw Object.assign(new Error('File not found.'), { statusCode: 404 });
    return filePath;
  }

  static async deleteFile(fileUrl: string): Promise<void> {
    if (!fileUrl) return;
    try {
      const cloudMatch = fileUrl.match(/^\/api\/upload\/private\/cloud\/([^/?#]+)$/);
      if (cloudMatch) {
        this.assertConfigured(); const ref = this.decodeRef(cloudMatch[1]);
        const result = await cloudinary.uploader.destroy(ref.publicId, { resource_type: ref.resourceType, type: ref.deliveryType, invalidate: true });
        if (!['ok', 'not found'].includes(result.result)) throw new Error(`Cloud asset deletion failed: ${result.result}`);
        logger.info('Cloud file deleted', { publicId: ref.publicId, result: result.result }); return;
      }
      if (fileUrl.startsWith('https://res.cloudinary.com/')) { logger.warn('Cloud asset deletion skipped because URL has no signed asset reference'); return; }
      const relativeKey = fileUrl.replace(/^\/uploads\//, ''); const filePath = path.resolve(this.uploadBaseDir, relativeKey);
      if (!filePath.startsWith(`${this.uploadBaseDir}${path.sep}`)) throw new Error('Refusing to delete outside upload directory');
      if (fs.existsSync(filePath)) await fs.promises.unlink(filePath);
    } catch (error) { logger.warn('Failed to delete stored file', { fileUrl, error }); }
  }
}
