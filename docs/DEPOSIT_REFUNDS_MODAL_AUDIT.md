# Deposit and refunds modal audit

Date: 31 October 2026

## Fixed findings

- Adjustment and refund child dialogs were rendered below the locker overlay. They now render in a shared portal above it, contain keyboard focus, restore focus on close, and block closing/field changes during submission.
- Deposit read errors previously left actions enabled against stale cached values. The tab now provides explicit retry, checks summary identity and arithmetic, and disables financial actions until a current valid summary is available. Adjustment credits, deductions and the outstanding required amount are visible separately.
- Deposit coverage and overcollection checks used lifetime receipts and ignored adjustment credits, refunds and deductions. They now use net held funds. Replenishment after settlement is allowed up to the required balance, while overcollection still needs permission and justification.
- Ledger amounts are rounded to paise and malformed balances/reservations fail reconciliation checks instead of producing misleading refundable figures.
- Refund lifecycle audit failures were swallowed because the audit helper did not receive the transaction session. Refund request, submission, approval, rejection and cancellation now pass that session, so failed audit recording rolls back the operation.
- Cheque collection lacked bank/date fields required by the backend. These fields and their validation/payload are now present. Override reasons consistently require five characters.
- Collection/adjustment/refund forms prevent duplicate submissions. An uncertain collection response preserves the original payload and idempotency key, freezes edits and offers retry of the same collection.
- Refund history is scoped to the current allocation, and summary loads ignore stale responses. The approval form uses un-clamped headroom consistently with backend accounting. Successful collection can show its receipt within the current page.

Zero held deposit in the supplied screenshot means no held amount is recorded; required deposit is a separate figure. No collection or refund was fabricated, and no live records or environment secrets were modified.

## Verification

Isolated integration tests cover held-balance replenishment, fractional credits, overcollection prevention, audit rollback and the existing concurrency/maker-checker workflows. Desktop/mobile browser checks cover summary failure/retry, nested adjustment/refund dialogs, cheque payloads, keyboard handling and uncertain-response retries.

Final results: 12 unit tests, 64 integration tests and all 8 deposit desktop/mobile browser tests passed. Production build and whitespace checks passed.
