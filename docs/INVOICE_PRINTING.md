# Professional invoice printing

Vault Ledger invoices are generated as authenticated backend PDFs. The screen modal is an operational preview only and is never printed. This prevents navigation, overlays, modal controls, browser page URLs and unrelated SPA content from appearing across multiple sheets.

## Output

- A4 portrait, normally one page.
- Business/branch/address and GSTIN are read from System Settings.
- Invoice number, issue/due dates and billing period.
- Customer identity/address and locker/agreement coordinates.
- Itemized rent, fees, discount and recorded tax.
- Invoice, paid and outstanding totals plus Indian amount-in-words.
- Up to five completed payment receipt references.
- Authorized-signatory area and system-generated record notice.
- A visible diagonal watermark for cancelled invoices.
- Private, no-store HTTP headers and an audit event for every PDF generation.

## GST data quality

The PDF never invents tax rates, SAC, recipient GSTIN or place-of-supply values that are absent from the ledger. Before treating a document as a statutory GST tax invoice, configure the supplier GSTIN/address and ensure the underlying billing data contains every field required by the applicable invoice rule. Legal/tax review remains the business owner's responsibility.

## Manual verification

1. Open Renewals and select an invoice.
2. Select **Print Invoice**. The authenticated PDF loads temporarily in the current page and the native browser print dialog opens directly; no extra tab is created.
3. Confirm customer, locker, dates, financial rows, receipts and status.
4. Print from the PDF viewer using A4 portrait and 100%/Fit settings.
5. Test issued, paid, partially paid, legacy and cancelled invoices.

The temporary print frame and PDF object URL are removed after printing. Firefox and Safari receive a slightly longer PDF-render delay for compatibility. If the browser blocks or cannot initialize its native PDF viewer, the UI reports the failure without navigating away from the invoice.
