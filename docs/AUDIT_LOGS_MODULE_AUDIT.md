# Security & Audit Logs audit

Date: 2026-10-30

## Confirmed issues fixed

- Summary counts now cover all matching events, independently of the current page.
- Category, severity, period and mutation filters run before pagination. Legacy module names and current entity types are normalized.
- Search covers operator names/usernames, IP addresses and entity IDs, and treats input as literal text.
- Date-only boundaries use Asia/Kolkata; invalid ranges and parameters are rejected. Auto-refresh recalculates relative periods each request.
- CSV/JSON export includes the full filtered history, not only the visible page. CSV quoting and spreadsheet formula protection are applied. An explicit 10,000-event cap requires narrower filters instead of silently truncating results.
- Legacy details and current metadata are available in Inspect; sensitive credential, identity and key fields are redacted in API responses and exports.
- Inspect no longer invents operator, device, IP authorization or completed refund payout details. Reservation and payment approval descriptions reflect their actual stage.
- Table and timeline share pagination; request failures show retry controls. Export errors are visible and exports wait for search/filter updates.
- Inspect traps keyboard focus, restores focus on close and supports Escape. Clipboard failures are reported. Print styles isolate the audit view or selected event.
- Misleading active-session and immutable/tamper-proof claims were removed. Ten-second polling is labelled auto-refresh.

## Validation

Backend unit and integration tests use disposable test data; browser checks run against an isolated test server on desktop and mobile. Tests cover full-history counts, normalized filters, IST boundaries, query validation, authorization, export limits, redaction, CSV safety, legacy metadata, focus handling, error recovery and refresh.

No production database migration or live financial-record changes were made. Environment secrets were not changed. This audit does not establish cryptographic tamper evidence or an external append-only storage guarantee.

Final verification: 10 unit tests, 39 integration tests and 24 desktop/mobile browser tests passed. Production build and TypeScript checks passed. npm audit reported zero vulnerabilities in both packages.
