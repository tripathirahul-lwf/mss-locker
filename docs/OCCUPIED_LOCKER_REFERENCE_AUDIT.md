# Occupied locker reference implementation and audit

Date: 2026-10-31

## Reference layout

Occupied lockers open a light, wide dialog with the locker title, size/rack/key line, payment/renewal status, seven summary cards, Renew or Record Payment, KYC & ID documents, Close locker and inline bill/receipt history. Additional invoice, deposit/refund and customer-profile tools remain available on the same page. Other locker states retain their existing workflow.

## Data and flow corrections

- Rent is taken from the active agreement, including a valid zero rent. The reference-style base annual rent is labelled +18% GST, with the inclusive total shown explicitly.
- Security deposit shows the actual recorded ledger balance, with loading/error/restricted states, rather than presenting the required tariff as cash already collected.
- ID numbers are masked by default. Explicit reveal requires sensitive-customer permission. Missing identity data is not invented; document upload/preview remains in the existing KYC panel.
- Payment/renewal health uses current-allocation invoices, confirmed coverage and IST calendar dates. Failed/restricted billing cannot produce an optimistic All good badge. Opening rent debt remains distinct from renewal debt.
- Default history is scoped to the active allotment. All-locker invoice history remains available through Invoices. Historical or unlinked records are not attributed to a new customer by guessing.
- Invoice totals and actual receipt collections are distinct. Rent/KYC invoices and deposit receipts are shown separately, reflecting the existing backend ledger. Cancelled/pending payments are not labelled collected, and a paid bill without a stored receipt does not get a fabricated preview.
- Receipt preview loads the full payment record, opens in a nested dialog and reports errors. Only the requested receipt shows its loading indicator. Payment/deposit mutations invalidate receipt history.
- Existing permission gates and payment/renewal/closure safeguards remain in force. All actions use the current backend APIs and same-page workflows.
- Fixed a mobile layering bug where the dashboard success notification could intercept the occupied dialog Edit button. Added explicit dialog naming and corrected focus trapping from the dialog root.

## Verification

Desktop/mobile browser coverage includes reference cards and amounts, masked/revealed ID, rent and deposit receipt previews, same-page KYC, error recovery, tenancy isolation, short-screen scrolling and existing ledger/profile/closure/refund workflows. Test data uses a disposable database and mock storage. No live financial records or environment secrets are modified.

Final verification: all 34 desktop/mobile browser tests passed, production backend/frontend build and TypeScript compilation passed, and git diff --check passed. Desktop and mobile screenshots were visually inspected.


## Follow-up audit: 2026-10-31

Confirmed screenshot issue: generic uploads stored the literal label KYC Document as a document number, producing ****ment. Generic uploads now support an empty number. Known placeholder labels are suppressed in read responses and never offered for reveal; legacy stored data is not rewritten. Numbered ID types still require a number. An explicit reveal is bound to the selected document and value, so changed identity data is masked again.

Other confirmed corrections:

- An older settled invoice no longer confirms an advanced renewal period. Coverage must reach the required period end. Contradictory totals, paid amounts or balances produce Billing needs review and block payment/renewal shortcuts.
- Zero recorded deposit distinguishes no collection from a collected-and-settled deposit, and shows the required amount separately. A failed refresh does not present stale deposit/receipt data as a successful current response.
- History counts explicitly distinguish bills and receipts.
- Receipt previews use cancellation and latest-request guards, including cancellation when the locker closes. Switching receipts no longer silently ignores the new selection.
- Focus lifecycle uses a stable close callback and skips hidden controls instead of resetting focus when the parent refreshes.
- Test connection fallback/reconnect is disabled in test mode, preventing a disconnected disposable fixture from reaching the configured database.

Research references: React documents cleanup on unmount/dependency changes and guarding asynchronous fetch results ([useEffect](https://react.dev/reference/react/useEffect)). W3C describes contained Tab/Shift+Tab navigation, Escape dismissal, initial focus and focus restoration for modal dialogs ([Dialog Modal Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)). These references guided the asynchronous preview and keyboard fixes; financial and identity findings were established from local source code and isolated fixtures.

Follow-up verification: 12 unit tests, 47 disposable-database integration tests and 40 desktop/mobile browser tests passed (99 total). Production build and TypeScript compilation passed. No migration or correction of existing financial records was performed.
