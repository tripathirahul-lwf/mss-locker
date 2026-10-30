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
  for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 'bad', true, [100], {}, '', '  ', 0.001]) {
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


test('private document reads return bytes rather than a browser redirect', async () => {
  const originalFetch = global.fetch;
  const originalUrl = StorageService.getPrivateDownloadUrl;
  const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#ffffff' } }).png().toBuffer();
  try {
    StorageService.getPrivateDownloadUrl = () => 'https://api.cloudinary.com/signed-test';
    global.fetch = async () => new Response(png, { headers: { 'Content-Type': 'image/png' } });
    const result = await StorageService.readPrivateFile('test-token');
    assert.deepEqual(result.buffer, png);
    assert.equal(result.mimeType, 'image/png');
    global.fetch = async () => new Response(Buffer.from('%PDF-1.4\ndocument\n%%EOF'), { headers: { 'Content-Type': 'application/octet-stream' } });
    assert.equal((await StorageService.readPrivateFile('test-token')).mimeType, 'application/pdf');
    global.fetch = async () => new Response('<html>error</html>', { headers: { 'Content-Type': 'text/html' } });
    await assert.rejects(StorageService.readPrivateFile('test-token'), /unsupported/);
    global.fetch = async () => new Response('unavailable', { status: 503 });
    await assert.rejects(StorageService.readPrivateFile('test-token'), /could not retrieve/);
  } finally {
    global.fetch = originalFetch;
    StorageService.getPrivateDownloadUrl = originalUrl;
  }
});


test('financial API errors distinguish uncertain commits from validation conflicts', () => {
  const { serviceErrorStatus } = require('../dist/utils/serviceErrorStatus');
  assert.equal(serviceErrorStatus({ name: 'MongoNetworkError' }), 503);
  assert.equal(serviceErrorStatus({ name: 'MongoServerError', errorLabels: ['UnknownTransactionCommitResult'] }), 503);
  assert.equal(serviceErrorStatus({ code: 11000 }), 409);
  assert.equal(serviceErrorStatus({ statusCode: 409 }), 409);
  assert.equal(serviceErrorStatus({ name: 'ValidationError' }), 400);
});


test('audit CSV escapes every cell and neutralizes spreadsheet formulas', () => {
  const { auditCsvCell, escapeAuditSearch } = require('../dist/utils/auditPresentation');
  assert.equal(auditCsvCell('comma, quote"\nline'), '"comma, quote""\nline"');
  for (const value of ['=1+1', '+SUM(1)', '-1+2', '@CMD', '\t =1']) assert.ok(auditCsvCell(value).startsWith('"\''));
  assert.equal(escapeAuditSearch('[x].*'), '\\[x\\]\\.\\*');
});
