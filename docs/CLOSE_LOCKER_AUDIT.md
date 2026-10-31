# Close Locker and Closed filter audit

Date: 31 October 2026

## UI and flow

- The locker-page closure wizard now opens a compact light modal with closing date, actual refundable balance, actual refund status, optional notes and handover confirmation. Damaged/key-issue lockers remain unavailable for maintenance after completion.
- Refund figures are read from the ledger. Selecting a label cannot manufacture a refund; refund management remains available on the same page.
- Confirm close atomically submits a closure request for review. Existing settlement, maker-checker approval and completion remain required before release. This is stated in the modal.
- Closed now filters completed customer-tenancy records within the dashboard instead of navigating to another page or confusing inactive physical units with closed tenancies. Historical records remain visible after the unit is allotted again.
- Closed records support customer/phone/locker search, size filters, pagination, refresh, retry and same-page detail/statement modals. Completed details show the recorded closure snapshot rather than a live readiness calculation.

## Audit fixes

- Serialize closure creation against the allocation, preventing duplicate open requests from concurrent operators.
- Closure creation and lifecycle audit entries use transactions; failed audit writes roll back the corresponding change.
- Validate closing dates and checklist values; preserve the selected business closing date while recording completion timestamps separately.
- Block closure approval for inconsistent invoice balances or deposit ledgers. A PAID label no longer hides a positive outstanding balance.
- Revalidate agreement links and other active tenancies before releasing a physical unit.
- Scope open-closure lookup to the actual allocation and fetch full details, avoiding truncated lists and missing tariff fields.
- Fix keyboard focus containment/restoration and preserve typed confirmation notes across renders.

Validation uses isolated database tests, desktop/mobile browser scenarios, production build and whitespace checks. No live financial/customer records or environment secrets were modified.

Final verification: 12 unit tests, 58 database integration tests and all 6 desktop/mobile closure browser tests passed. Production build and whitespace checks passed.

## Closure follow-up audit (31 October 2026)

- Distinguish missing deposit collections from completed refunds. Validate the allocation and settlement values before enabling submission, and show financial blockers with retry on inconsistent data.
- Accept short optional notes, enforce permission-aware actions and closing dates, and describe maintenance outcomes for damaged, key-issue and OTHER conditions accurately.
- Recover an interrupted create response by reopening the existing saved request instead of creating another one.
- Require actual booleans in physical checklists. Preserve existing subdocument confirmations during partial reviews.
- Read the required deposit from the agreement snapshot and return the actual pending refund count.
- Reject completion against an already closed agreement; never invent a completed record without its closure date and financial snapshot.

Follow-up validation: 12 unit tests and 69 isolated database integration tests passed. Production build passed. Desktop/mobile closure browser verification covers settlement integrity, interrupted saves, optional notes, review submission and same-page closed history. Live customer and financial records were not changed.
All 10 follow-up desktop/mobile closure browser tests passed; whitespace checks passed.
