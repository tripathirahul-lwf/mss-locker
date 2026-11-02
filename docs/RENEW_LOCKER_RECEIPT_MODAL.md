# Renew locker reference modal

Date: 1 November 2026 (Asia/Kolkata)

The locker detail Renew action opens the compact reference layout on the same page: customer/current renewal, amount paid including GST, tenure, editable next renewal date in a green panel, receipt number/date, optional image/PDF attachment with preview, Renew and Close.

A new permission-protected POST /api/renewals/collect saves the renewal invoice and cash receipt in one transaction, then updates paid-through/next-renewal dates. No second deposit is collected. Both renewals.create and payments.create permissions are required. Existing bill-only operations elsewhere retain their workflow; existing outstanding invoices still use their settlement action to prevent overlapping bills.

The request includes the expected current renewal date and a unique request ID. Duplicate receipt numbers, stale dates, invalid money/dates, inactive tenancies, unpaid opening balances and overlapping invoices are rejected. Same-request retries return the original collection. Ambiguous responses freeze fields and retry the exact request without collecting cash again. Audit failures roll back the transaction.

Attachment validation allows JPG/PNG/WebP/PDF up to 5 MB; previews stay local until saving. Uploaded server MIME is preserved. Dialogs support Escape, focus containment/restoration, sticky actions, scrolling and mobile layout. Success refreshes receipts, invoices, allocation and dashboard locker counts.

Validation: 89 isolated backend integration tests, 12 unit/security tests and 22 desktop/mobile occupied/renewal browser scenarios passed. The six renewal browser scenarios passed again after final UI refinements. Production build and whitespace checks passed. Desktop and mobile screenshots were visually inspected. No live database or environment secrets were changed.
