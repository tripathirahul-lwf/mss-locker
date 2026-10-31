# Invoice modal audit

Date: 31 October 2026

Scope: invoice details, historical billing-period edits, payment/cancellation consistency, same-page navigation and printing.

## Fixed findings

- Editing an old paid bill could overwrite the active allocation's renewal dates. Only the paid invoice covering the current allocation end can synchronize those dates; historical edits preserve the current tenancy. Adjustment invoices do not determine paid coverage.
- Billing-period updates now validate real calendar dates, reject overlapping coverage and cancelled invoices, and detect stale edits. Invoice, allocation and audit changes commit in one transaction; audit failures roll back the edit.
- Cancellation now rejects collected payments, including inconsistent stored payment summaries. Cancellation and payment collection cannot both succeed concurrently. Cancellation and its audit event commit together.
- The modal and printed statement use recorded amounts, including explicit zero tax. Invalid or inconsistent balances/statuses show a review state and disable financial actions instead of claiming settlement or crashing.
- Removed hardcoded payment destination, unsupported SAC/tax-split claims and certification text from print output. Print content is HTML-escaped and prints through a same-page isolated frame.
- Profile and locker location open within the current page. Nested customer editing and confirmation dialogs have appropriate stacking, keyboard focus and focus restoration.
- Invoice refresh, receipt loading, clipboard, print and save failures are visible with recovery paths. Period editing preserves the version originally opened, and duplicate submission is blocked.

## Validation

- Backend unit and isolated database integration suites.
- Desktop and mobile invoice browser scenarios covering stored zero tax, same-page profile/location, nested editing, stale period edits, cancellation errors, load/print failures, isolated printing and malformed balances.
- Production build and whitespace checks.

No live financial records or environment secrets were modified. Historical coverage dates were not guessed or automatically rewritten; imported date discrepancies still require checking against the original ledger.
