# Cloudinary document storage

## Implemented architecture

Uploads remain server-side and permission protected. The browser sends multipart data to Vault Ledger; the backend verifies the declared MIME type and magic bytes, compresses supported images, and performs a signed Cloudinary upload. No Cloudinary secret or unsigned upload preset is exposed to the browser.

- KYC and general documents use Cloudinary delivery type `authenticated`.
- Customer photos use public `upload` delivery to preserve existing `<img>` behavior.
- Private document references are HMAC-signed to prevent users changing a public ID and asking the server to sign another asset.
- Access requires `customers.kyc.view`; the backend issues a five-minute Cloudinary download URL with `Cache-Control: private, no-store`.
- JPEG, PNG and WebP are auto-rotated, capped at 2500 × 2500 pixels and re-encoded without metadata using Sharp.
- PDF bytes are preserved. Rasterizing identity PDFs could change signatures, text quality, page structure or evidentiary value.
- Replaced, deleted and abandoned modal uploads are removed from Cloudinary. Existing local KYC URLs remain readable during migration.
- A document URL can be attached to only one KYC record, and the temporary cleanup endpoint refuses to delete an asset that is attached to an active record.
- Asset-reference signing uses `STORAGE_REFERENCE_SECRET`, independent from Cloudinary credentials, so API credential rotation does not invalidate stored links.

## Environment

Configure all three values together in the backend secret manager:

```env
CLOUDINARY_CLOUD_NAME=<product-environment-cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
STORAGE_REFERENCE_SECRET=<independent-random-secret-at-least-32-characters>
CLOUDINARY_KYC_FOLDER=vault-ledger/kyc
CLOUDINARY_PHOTO_FOLDER=vault-ledger/photos
```

Never expose `CLOUDINARY_API_SECRET` through Vite variables, browser code, logs, screenshots or source control. Rotate the key immediately if it has been disclosed. `.env` files are ignored by the repository.

## Credential verification

Before rollout, verify `cloudinary.api.ping()` succeeds from the backend deployment environment. A mismatch must block deployment. The current implementation deliberately returns 503 when Cloudinary is not configured instead of silently placing new KYC files on ephemeral local disk.

## Existing local assets

Local `/uploads/kyc/...` records are supported as legacy reads. Migration should be a separate, resumable job that:

1. selects active local KYC records in batches;
2. verifies file path containment, MIME signature and record ownership;
3. uploads as `authenticated` using the same compression policy;
4. updates the database only after successful upload;
5. records old/new references and an audit event;
6. verifies signed download access before deleting the local source;
7. supports retry and reconciliation without duplicate assets.

Do not bulk-delete the local upload directory until every active database record has been reconciled and a backup has been verified.

## Rollout checklist

- Use the correct API secret and pass the API ping.
- Run backend tests/build and frontend build.
- Upload and view one JPEG, PNG, WebP and PDF using a non-admin KYC operator account.
- Confirm an unauthorized account gets 403 and a modified asset token gets 400.
- Replace and delete a test document, then confirm the prior Cloudinary asset is gone.
- Confirm Cloudinary retention, region and account limits meet the organization's KYC policy.
