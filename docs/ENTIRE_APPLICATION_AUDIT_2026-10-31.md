# Application-wide follow-up audit

Date: 31 October 2026 (Asia/Kolkata)

## Scope and method

Reviewed the module routes, permission boundaries, validation, state transitions, transaction/audit behavior and the existing regression coverage. Exercised the application against disposable MongoDB replicas and desktop/mobile browser fixtures. Did not connect to, seed or modify the configured live database. Environment secrets were not edited. Existing worktree changes were preserved.

## Module results

| Module | Review and fixes in this pass |
| --- | --- |
| Authentication/session | Refresh tokens now carry unique JWT IDs. Atomic compare-and-swap permits one concurrent rotation winner. Grace responses cannot overwrite the valid browser cookie with an unrecorded token. Expired/revoked sessions and infrastructure outages remain distinct. |
| Staff and roles | Reviewed staff escalation/deactivation/password-reset protections. Fixed role-management escalation: limited operators cannot modify protected/higher-privilege roles, grant permissions they do not possess or edit their own role permissions. Role permission changes revoke affected sessions and increment token versions. Audit failures roll back changes. |
| Customers/search | Escape customer search/city/state regex input. Invalid search IDs and fractional/nonfinite pagination return 400 rather than internal failures. Financial customer previews require their component permissions; locker previews restrict phone and dues fields. |
| KYC | Documents remain valid through the business expiry day. Revoked verification clears stale customer verification timestamps/actors. All KYC mutation audit writes now fail transactionally. Upload/preview/delete browser coverage rerun. |
| Lockers/catalogue | Existing status, availability, size/search, permission, catalogue editing and same-page detail flows exercised. |
| Allotment | Existing duplicate receipt/allotment protections, money/date validation, upload/preview handling and short-screen controls exercised. |
| Billing/renewal | Existing historical-period editing, coverage overlap guards, paid-through handling, invoice cancellation and same-page renewal scenarios exercised. |
| Payments | Reconciliation rounds paid/balance totals to paise while allowing a genuine zero balance; cancellation/idempotency/receipt scoping regressions exercised. |
| Deposits/refunds | Existing balance consistency, cheque fields, approval, ambiguous-response retry/idempotency and same-page flows exercised. |
| Locker closure | Existing checklist, settlement, maker/checker, maintenance, duplicate request recovery and closed-history scenarios exercised. |
| Audit logs | Filtering/counts/export/inspection/failure recovery browser scenarios exercised. Settings, role, import and KYC writes now require their audit records to commit with them. |
| Import/rollback | Only a READY job can atomically claim commit. Transaction retries reset caches/counters/record IDs. Failed commit does not persist rolled-back IDs. Automatic rollback is blocked for prior-record updates, later changes or dependent payments, invoices, deposits, refunds, closures, KYC or tenancies. Rollback locks affected records and emits transactional sync tombstones/audit. |
| Reports/export | Validate real dates; use IST date boundaries/month grouping. Exclude draft/cancelled invoices. Count the complete overdue result independently of the 200-row preview. Export fetches up to 10,000 rows and explicitly rejects truncation. |
| Settings/tariffs | Settings changes and tariff revisions now commit their audit records atomically. Verified rollback restores the original settings/active tariff on audit failure. This pass does not migrate historical tariff/financial data. |
| Offline/PWA sync | Reject malformed/null/unknown-scope cursors and invalid pagination with 400. Preserve supported legacy ISO cursors and scoped tombstones. Existing permission-aware sync tests rerun. |
| Document storage | Reviewed signed private references, authenticated delivery, MIME/signature limits and compression. Existing security/unit/upload browser scenarios exercised; no live Cloudinary writes. |

## Test reliability repairs

The complete browser run exposed shared-state contamination between tests and desktop/mobile projects. The test-only loopback server now snapshots its disposable fixture and resets it before each scenario. Updated stale closure/rent selectors and refund mock allocation/ledger fields to match the current UI and safety rules. Production APIs do not expose the test reset endpoint.

## Remaining dependency finding

`npm audit --omit=dev`: frontend has zero advisories. Backend has eight moderate findings in the ExcelJS/archiver/glob/minimatch dependency chain; no high/critical findings. The suggested ExcelJS downgrade/major dependency API changes were not applied blindly. These upstream advisories remain open and require a compatible dependency migration with spreadsheet import/export validation. This report is evidence of the reviewed paths and checks, not a guarantee that no undiscovered defects exist.

## Validation

Final test counts and build results are appended after completion below.

Final validation:
- 12 backend unit/security tests passed.
- 85 isolated backend integration tests passed, including the new session concurrency, report count/date, role escalation/revocation, KYC audit/expiry, settings/tariff rollback, import safety and malformed sync-cursor cases.
- Full desktop/mobile browser suite: 86 passed initially; the remaining two refund cases passed after correcting the stale overlay assertion and completing their deterministic mock. All 88 browser scenarios are verified.
- Production backend/frontend build and whitespace checks passed.
- Dependency audit: frontend 0 findings; backend 8 moderate, 0 high, 0 critical (upstream ExcelJS chain remains open).
