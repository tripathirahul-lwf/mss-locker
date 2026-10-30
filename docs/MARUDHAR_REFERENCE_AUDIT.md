# Marudhar Vault Ledger implementation and verification

Reference: `frontend/Marudhar Vault Ledger.html`. Updated 30 October 2026.

## Implemented flow

| Step | Implementation |
| --- | --- |
| Sign in | Existing API authentication, roles and sessions retained; revoked refresh cookies are rejected. |
| Overview | Six server-backed locker KPIs and the reference's locker-first dashboard. |
| Directory | Search by locker, tenant name/phone and permitted key reference; size, occupancy, due-soon, overdue and KYC filters; cards/table/rack layouts retained. |
| Vacant card | Opens one combined allotment form. |
| Allotment | Select an existing customer or enter a new customer; enter key, opening date, annual base rent, refundable deposit, and one/three-year tenure. |
| Charges | Rent for selected tenure + 18% GST on rent + one Rs 50 KYC charge + one refundable deposit. Client preview and server invoice use matching paise rounding. |
| Documents | Optional photo, ID proof and receipt attachment in the same form; JPEG/PNG/WebP/PDF up to 5 MB each. Files upload through the existing storage service before database commit. |
| Collection | Explicit cash-received confirmation, operator-entered unique receipt number, rent receipt and separate deposit receipt with `-DEP` suffix. Existing payment pages retain other payment methods. |
| Persistence | Customer, key, allocation, initial invoice, paid rent record, deposit payment/ledger, document links, audit and retry token commit in one MongoDB transaction. Failures roll back database records. |
| Receipt history | Existing payment/history views plus immediate rent/deposit receipt opening after allotment. Receipt dialog supports keyboard focus and paise wording. |
| Occupied card | Customer, phone, renewal date, due status and KYC state; direct details/KYC actions. |
| Renewal | One/three-year terms, GST breakdown, duplicate-period protection under concurrent requests; paid-through date advances after payment. |
| Closure | Existing checklist, settlement, maker-checker approval, refund and closure history retained; successful closure releases the physical unit and keeps history. |
| Staff/audit | Existing role-protected staff, audit, reports and settings pages remain reachable through operational navigation. |

Example: annual base rent Rs 1,000, three-year tenure and Rs 2,000 deposit collect Rs 5,590: rent 3,000 + GST 540 + KYC 50 + deposit 2,000. The rent invoice/receipt is Rs 3,590; refundable deposit receipt is Rs 2,000. Renewals do not repeat the opening KYC charge.

## Correctness and security changes

- Due-soon means today through the next 30 calendar days in Asia/Kolkata; overdue takes precedence. Lists, details and filtered counts share the due groups. Debts from past tenancies do not classify a replacement tenancy.
- Virtual status filters combine with size/search and server-side pagination. Ready-to-allot vacancy matches its KPI. Multiple URL parameter updates no longer overwrite each other.
- Billing months/years clamp leap-day and month-end dates consistently. Annual tariff is independent of refundable deposit.
- Allotment retry tokens are persisted with actor and request fingerprint. Identical retries return the original agreement; different details cannot reuse a committed token.
- Concurrent requests cannot allocate one unit twice or issue two renewals for the same period. Unique receipt/document/request indexes and transactional locker writes enforce conflicts.
- CORS and browser-origin verification use explicit configured origins. Arbitrary Vercel/Render subdomains are no longer trusted. Development-only localhost allowance remains.
- All mutating API routes validate browser origin. Cookie-authenticated changes without an origin/referer are rejected; non-browser bearer clients remain supported.
- Private Cloudinary download URLs require authentication and document/receipt permission. Signed references alone do not grant anonymous access. Files already attached to documents, customer photos or payments cannot be deleted through the unattached-file route.
- Cookie authentication checks the stored session's revocation and expiration. URL tokens cannot authorize mutations.
- Newly attached IDs remain pending verification; uploads do not automatically grant verified KYC. Expired verified documents no longer count as current verification.
- Updated vulnerable dependencies and Zod/resolver integration. Both frontend and backend npm audits report zero known vulnerabilities at verification time. The PWA build uses a pinned compatible deepmerge version; backend tests pin the patched Vite 7/Vitest 4 line to avoid unsupported native tooling on this Windows host.

## Validation

Run from the repository root:

```powershell
npm run type-check
npm run build
npm test
npm run test:e2e
npm run audit
```

- 7 backend unit tests: paise normalization, invalid amounts, file signatures, image normalization, PDF preservation, signed-reference tampering, Indian currency words.
- 18 replica-set integration tests: due/KYC/filter consistency, key permission, three-year billing, complete-allotment totals and retry, rollback on duplicate receipt, concurrent allotment, pending document links, zero balances, fractional tariffs, renewal/payment/refund/closure history, trusted origins, leap-day dates, API permission checks, private-file login and revoked cookies, CSRF, concurrent renewals, sequence allocation and sync tombstones.
- 10 automated Chromium browser tests: desktop and phone layouts, sign-in, vacant-card allotment with all three attachments, three-year total, rent/deposit receipts, receipt opening, KYC reopening, no page runtime errors and no horizontal overflow.
- Screenshots in `frontend/test-results/` were visually inspected. Browser tests use ports 25099/25173 and automatically managed servers.
- Build now builds both backend and frontend, including PWA generation.

## Operational requirements and limits

- Use Node 22.12+ and a MongoDB replica set, as required by the existing financial transaction architecture. Configure the current environment normally; no user `.env` values were changed.
- `CLIENT_URL` can contain one exact origin or a comma-separated list of exact origins. Include every deployed frontend explicitly; preview domains are not automatically trusted.
- The initial combined screen records a completed cash collection. For a reservation or another payment method, use the existing reservation/payment workspaces.
- Photo/ID attachment and verified KYC remain separate states. A permitted reviewer must verify identity documents; the reference's browser-only demo treated attachments as completion.
- Browser/integration tests use disposable MongoDB data. The browser fixture stubs the Cloudinary boundary; it does not upload test identity files to a live cloud account. Production Cloudinary credentials/connectivity and deployment acceptance require environment-specific checks.
- Uploads precede the database transaction because object storage does not participate in MongoDB transactions. Failed submissions keep uploaded references available for retry; database customer/financial/document links are rolled back. Review unused cloud uploads through normal storage housekeeping.
- No deployment, production-database migration, live cash entry or real refund was performed by verification.

## Allotment modal follow-up audit

The modal was re-audited after the layout changes. Fixed:

- Duplicate rack prefix in the title; explanatory receipt text no longer exposes internal receipt-suffix mechanics.
- Independent form-body scrolling with a persistent title and action footer, including a scrollable result view on short screens.
- Keyboard focus is contained in enabled modal controls; the background app is inert while the modal is open. Focus/scroll is no longer reset by a parent callback re-render.
- Cash confirmation is controlled and resets on amount, customer, locker or receipt changes. The API also requires explicit confirmation.
- Receipt date is independent of the lease opening date, and future receipt dates are rejected. Deposit and rent records use the receipt date.
- Names, phone/email, whitespace-only key/receipt, ID formats, monetary precision, file types/sizes and empty files are checked before uploads. API validation rejects fractional paise and PDF photos too.
- Entered identity details cannot be silently discarded when no proof is attached; the form explains the requirement.
- Amount inputs can be cleared without silently converting an empty field into zero. Attachments can be removed, and switching customers clears previous attachments.
- Customer/locker lookups are debounced. A chosen locker remains visible if its search result is filtered away.
- A lost response freezes the submitted payload and permits an identical idempotent retry rather than a changed request or another collection. Definitive validation errors keep the form editable.
- Backend validation issues appear as actionable messages; upload/save progress and errors are visible in the modal.

Added regression coverage checks validation before any upload/write, stale cash confirmation, oversized files, visible action buttons and recovery after an actual saved response is deliberately interrupted. Tests run on desktop and phone with disposable MongoDB data and a stubbed storage provider. Live provider connectivity remains environment-specific.

## Opening invoice versus renewal audit - locker 123

Read-only inspection matched the reported locker and invoice. The active agreement starts 20 October 2026 and its next renewal is scheduled for 20 October 2027. Invoice `INV-2026-000407` is `NEW_ALLOCATION`, total Rs 1,180, paid Rs 0, outstanding Rs 1,180, due 20 October 2026. No payment or deposit-transaction records were found for this locker. Thus the opening rent invoice was ten calendar days overdue on 30 October 2026; the future renewal was not overdue.

Confirmed code defects and corrections:

1. The detail banner labelled every unpaid invoice as renewal. It now identifies opening rent, renewal or another invoice payment, scopes it to the current agreement, ignores cancelled/draft invoices, and selects the earliest outstanding invoice. Dates use Asia/Kolkata calendar days.
2. Creation/reservation and GET enrichment fabricated paid-through coverage from the scheduled term end. New unpaid agreements no longer receive paid-through dates. Read views derive confirmed coverage from settled invoices and no longer write fabricated financial metadata on GET. Legacy stored metadata was not changed.
3. The combined cash allotment explicitly records coverage after its opening invoice is settled. Normal payment reconciliation grants coverage after full payment and clears unsupported coverage on reversal.
4. Opening payment debts no longer inflate renewal-specific card/KPI classifications. A pending opening bill remains payable through its invoice. Generating a renewal before settling the opening invoice is rejected.
5. The detail modal showed the required deposit as money already held. Its held amount now comes from the deposit ledger, with loading/restricted/error states. The invoice count is labelled Invoices rather than Receipts.

Regression tests recreate an unpaid opening invoice and incorrect legacy coverage, check that reads do not mutate the stored agreement, verify zero renewal arrears/zero held deposit, and confirm coverage after an actual test payment. Desktop and mobile tests assert the corrected labels. Live balances, payment records and stored coverage were not changed during the audit.


## Additional financial workflow audit - 2026-10-30

- Deposit retries now resolve an existing matching receipt before checking overcollection. Changed amount, allocation, payment purpose, method or cancelled status rejects key reuse.
- Invoice retries reject a key reused against another invoice, amount, method, purpose or cancelled payment.
- Generic payment cancellation rejects deposit/refund receipts so it cannot silently leave their dedicated ledger entries completed.
- Refund creation and draft submission now serialize deposit reservations in MongoDB transactions. Approval and payout use raw held balance minus other pending reservations, avoiding a clamped-balance headroom bug; approval and payout acquire the allocation write lock.
- Refund payout retries must match the original paid refund and its ledger entry.
- Completing an approved closure rechecks physical and financial readiness, respecting the explicitly recorded financial override. New unpaid invoices block completion.
- Regression coverage adds full-deposit retry, conflicting keys, concurrent refund creation, concurrent draft submission, payout replay isolation, ledger cancellation rejection, and changed readiness after closure approval.
- Tests run against disposable databases; live financial records and backend/.env remain unchanged.


## Private preview and React rendering audit - 2026-10-30

- Fixed private Cloudinary previews: authenticated API requests return validated document bytes instead of a 302 to a cloud endpoint that rejects credentialed browser CORS. Permission checks remain in place; no browser credentials or signed download URLs are forwarded to the browser.
- Cloud reads have a 20-second timeout, 5 MB limit, MIME/signature validation, and private no-store responses. Generic binary responses are identified by file signature for image/PDF previews.
- Removed router navigation side effects from dashboard pagination and sort state updater callbacks. Existing browser workflows now assert that the React cross-component render warning does not occur.
- Cloud response regression tests use stubbed image/PDF bytes and upstream failures; no live KYC files are modified.


## Generic KYC cards - 2026-10-30

- Replaced fixed document-type slots with one generic KYC Document uploader. Existing active documents remain visible; a plus action adds additional documents without selecting an identity type.
- Uploaded cards retain Preview and Replace and now include Delete with inline confirmation/cancel, using the existing authorized deletion API and refreshing customer/locker KYC counts.
- Replacement preserves existing identity metadata. New generic attachments use the supported OTHER category. Document preview object URLs are revoked on close/unmount.
- Browser coverage exercises add, replacement, delete cancellation, confirmed deletion, preview and staying in the locker modal on desktop and mobile.


## Locker edit modal audit - 2026-10-30

- Edit mode loads a complete, fresh locker record before allowing changes, avoiding loss of position, notes and other fields absent from compact list projections.
- Financial inputs reject blank, negative, nonfinite and fractional-paise values rather than silently converting invalid data to zero. Catalogue edits explicitly explain that existing lease invoices/deposit balances are unchanged.
- Optional position/section/floor can be cleared without being silently restored or omitted. Empty existing location fields no longer make an untouched form dirty.
- Locker code changes now persist, locker number checks treat input literally, and catalogue writes plus audit records are transactional. Concurrent updates against one expected revision admit only one writer; stale updates return 409.
- Occupancy changes cannot bypass allotment/reservation/closure via the update API. Active allocations cannot be deactivated through this endpoint.
- Added keyboard focus containment/restoration, a shared discard confirmation, submit guards, disabled inputs while saving, and an accessible mobile Edit action.
- Added backend snapshot/occupancy/concurrent-edit regression coverage and desktop/mobile edit validation, discard, save/reopen and optional-field clearing checks.


## Locker dossier tabs audit - 2026-10-30

- Details use current agreement rent (including valid zero tariffs) rather than changing retroactively with catalogue edits; GST splitting preserves paise.
- Invoice, allotment, KYC and refund queries respect view permissions. Loading/failure states no longer pretend to be empty records, and billing failures suppress the renewal shortcut. Failed invoice loading supports retry.
- Legacy VERIFIED customers with no active digital attachments show Legacy verification plus a clear missing-files note. No live legacy records are reclassified or modified.
- Removed unverified claims about bank escrow/custody. Deposit tab identifies required, collected, held, refunded, pending and refundable balances from the ledger, distinguishes settled deposits from no collection, and exposes restricted/unavailable states.
- Refund history is filtered to the current allocation and supports pagination; previous tenants' claims are not mixed into the current settlement.
- Draft/cancelled invoices are not payable from the dossier. Invoice actions have accessible names; invoice overlay Escape no longer closes the locker overlay.
- Locker dialog contains focus, restores scroll/focus, and keeps body scrolling separate from header/footer within the viewport. Footer controls wrap on mobile/short screens.
- Added desktop/mobile regression checks for zero agreement rent, invoice failure/retry, nested invoice close, legacy KYC, deposit totals and short-screen actions.


## Locker workflows without page navigation - 2026-10-30

- Customer Profile and customer-name actions now open a profile overlay above the locker. Profile viewing, editing and links back to the locker KYC/invoice panels keep the URL, filters and list position unchanged.
- Close Locker opens the closure wizard or the existing current-allocation closure workflow in place. Approval/review/completion, closure statement and settlement actions reuse existing services and permission/maker-checker checks.
- Deposit collection/adjustment, refund creation/review/payout and invoice payment are available as child dialogs on the same locker page. Settlement changes refresh the ledger and closure readiness; completed closure refreshes the locker list.
- Allocation fallback opens the allotment dialog rather than navigating to a separate page.
- Customer editing converts stored +91/0-prefixed Indian numbers to the ten-digit input format and loads date-only values, fixing subsequent edit validation after a previous save.
- Desktop/mobile browser coverage verifies unchanged URL during profile edit/save, KYC return, closure initiation, existing closure payment handoff and deposit collection dialog. Test closure records are confined to the disposable browser-test database.


## Broad follow-up audit - 2026-10-30

Reviewed authentication/permission boundaries, locker/customer/KYC APIs, private uploads, invoice/payment/deposit/refund/closure state changes, printable records, customer edits, modal lifecycle and settlement retries. No production database or cloud assets were mutated during verification.

Confirmed issues fixed:

1. Printable invoice, receipt and closure HTML inserted stored names/settings/notes without HTML escaping. Document text is now escaped without changing numeric/date calculations or stored data.
2. Deposit adjustment accepted ledger types beyond addition/deduction at runtime, allowing direct requests to bypass refund workflow. The service now permits only the two supported adjustment types.
3. Deposit credit cancellation ignored reserved pending refunds and could strand an approved refund. Allocation locks and reservation-aware balance checks now prevent it.
4. Generic ledger cancellation could reverse refund payments while leaving the refund PAID. Refund ledger entries now require an explicit refund reversal workflow.
5. Refund cancellation/rejection raced with payout. Allocation-scoped transactions now serialize these transitions; concurrent payout retries return one disbursement.
6. Payment retries racing before the first response could fail after payment settlement. Matching retries are now recognized inside the financial transaction before balance checks.
7. The backend could collect against draft or already-settled imported invoices. These states now reject collection. Closed allotments reject new collections/adjustments or receipt cancellation.
8. KYC mutation URLs did not bind document IDs to the named customer. Parent/document mismatches now return 404. Deleted documents cannot be edited/verified and expired documents cannot be newly verified.
9. KYC type edits retained verified status. Identity-type changes now reset verification; customer KYC state and document changes are committed together. Storage cleanup runs after commit and preserves attachments still referenced by receipts/customer records.
10. Locker update responses exposed key references to operators lacking sensitive permission; key edits and response fields now enforce the sensitive permission. KYC mutation responses mask identity numbers when required.
11. Customer edits could overwrite concurrent changes; update/deactivation checks and audit writes now share a transaction. Optional email, date of birth and photo fields can be cleared; invalid calendar dates/revision timestamps are rejected.
12. Money normalization accepted booleans/arrays and positive amounts that rounded down to zero. Unsafe input types and values below one paisa are rejected. Manual non-cash deposit/refund methods require references.
13. Refund payout UI did not preserve a recoverable request across an uncertain response. It now sends a stable payout key, freezes the attempted payload, warns against disbursing again and offers a same-request retry.
14. Same-page settlement dialogs retained old dark surfaces; they now use the light theme. Sub-rupee adjustments/refunds can be entered at paisa precision. Draft refunds have a submit action in the locker modal.
15. Closure dialogs contained hooks after conditional returns, readiness failures were hidden, and cancellation could leave the new-request wizard unable to close. Hook order, error/retry feedback, focus handling and exit state are corrected.

Validation uses unit tests, MongoDB replica-set integration tests and desktop/mobile browser flows. Dependency audits report zero known vulnerabilities in both packages. External Cloudinary account connectivity and deployment are outside these automated checks; existing legacy financial/KYC records remain unchanged.


Final verification for this audit: 9 unit tests, 36 MongoDB integration tests and 20 desktop/mobile browser checks passed. Backend/frontend TypeScript checks and production builds passed; both npm dependency audits reported zero vulnerabilities. Git whitespace validation passed. No deployment, production record repair or .env change was performed.
