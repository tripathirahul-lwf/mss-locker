# Occupied locker payment and coverage audit

Date: 31 October 2026

The supplied screenshot shows both next renewal and paid-through as 13 November 2026, with an unpaid renewal starting that same day. Since paid-through is inclusive, those records overlap. The audit does not guess whether the imported paid period or the unpaid bill needs correction.

## Fixed

- Allocation presentation no longer confirms a renewal boundary merely because a paid invoice extends beyond it. Conflicting boundaries and unpaid coverage overlapping paid coverage are reported explicitly.
- The occupied modal displays a coverage-review warning and hides collection/renewal actions for contradictory coverage. Existing bill history remains available for review. Recorded dates are not silently overwritten.
- Backend collection independently rejects coverage overlapping another paid bill, even if a stale browser attempts collection.
- Collection rejects a mismatch between the recorded paid amount and actual completed receipts, preserving imported partial payments instead of erasing them during recalculation.
- Adjustment payments and reversals do not extend or roll back rental coverage. Date advancement uses UTC calendar arithmetic.
- Due-status calculations use the India calendar day. The summary computes pending/overdue from the current date rather than trusting a stale due-status field.
- Receipts must belong to the current allocation and, when bill history is available, its known invoices. A foreign tenancy receipt cannot appear merely because its invoice reference matches.
- Historical paid bills without receipts are explained without fabricating a receipt. Malformed money/status fields render review states safely. The annual rent label now explicitly says before GST.

## Interpreting the screenshot

Payment pending can be correct for a future unpaid renewal bill; being listed under Due Soon does not mean that bill has been paid. Zero recorded deposit and missing ID/receipts reflect absent records and cannot be repaired by inventing a collection, identity or receipt.

No environment secrets, live records or imported financial dates were modified. The original ledger must establish which conflicting date is correct before record-level correction.

## Verification

12 unit tests, 61 database integration tests and all 16 occupied-modal desktop/mobile browser tests passed. Production frontend build and backend compilation passed. The integration rerun used a 15-second test timeout after an unrelated password-reset test exceeded its default five-second limit.
