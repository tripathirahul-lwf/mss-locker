const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeMoney } = require('../dist/utils/money');
const { StorageService } = require('../dist/services/storage.service');
const sharp = require('sharp');
const { amountInWords } = require('../dist/services/invoice-pdf.service');

test('money values are normalized to paise precision', () => {
  assert.equal(normalizeMoney('10.129'), 10.13);
  assert.equal(normalizeMoney(0.1 + 0.2), 0.3);
});

test('invalid money values are rejected', () => {
  for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 'bad']) {
    assert.throws(() => normalizeMoney(value));
  }
});

test('upload signatures must match declared content type', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  assert.equal(StorageService.hasValidSignature(png, 'image/png'), true);
  assert.equal(StorageService.hasValidSignature(Buffer.from('not an image'), 'image/png'), false);
});

test('uploaded images are normalized and dimension-limited before cloud storage', async () => {
  const source = await sharp({ create: { width: 3000, height: 1800, channels: 3, background: '#f8fafc' } })
    .jpeg({ quality: 100 }).withMetadata({ orientation: 1 }).toBuffer();
  const output = await StorageService.compressImage(source, 'image/jpeg');
  const metadata = await sharp(output).metadata();
  assert.ok((metadata.width || 0) <= 2500);
  assert.ok((metadata.height || 0) <= 2500);
  assert.equal(metadata.exif, undefined);
});

test('PDF documents remain byte-identical instead of being rasterized', async () => {
  const pdf = Buffer.from('%PDF-1.4\nidentity document\n%%EOF');
  assert.deepEqual(await StorageService.compressImage(pdf, 'application/pdf'), pdf);
});

test('private cloud asset references reject tampering', () => {
  assert.throws(() => StorageService.decodeRef(`${Buffer.from(JSON.stringify({ publicId: 'another-asset', resourceType: 'image', deliveryType: 'authenticated' })).toString('base64url')}.invalid`));
});

test('invoice totals are rendered in Indian numbering words', () => {
  assert.equal(amountInWords(1400), 'Rupees One Thousand Four Hundred Only');
  assert.equal(amountInWords(125000.5), 'Rupees One Lakh Twenty Five Thousand and Fifty Paise Only');
});
