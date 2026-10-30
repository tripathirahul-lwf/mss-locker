# Staff & User Management audit

Date: 2026-10-30

## Findings and fixes

1. Removed unconditional frontend permission bypasses (`|| true`). Create, edit, status and reset controls now respect permissions, including actions reached through the profile dialog. Server authorization remains mandatory.
2. Added a permission-scoped assignable-role endpoint. Staff management does not depend on unrelated role-management access; inactive roles and assignments exceeding the actor's permissions are rejected. A role must be explicitly selected when creating an account.
3. Restricted permission overrides to super administrators. Account status changes require the separate `users.deactivate` permission. Self role/status/override changes are rejected.
4. Serialized account mutations through the acting account inside MongoDB transactions. Concurrent administrators cannot disable each other and leave no active super administrator. Account, session and audit writes commit together.
5. Added a user token version checked on access and refresh requests. Password resets, password changes and role/status/permission changes invalidate old access tokens; refresh sessions are revoked. Existing records without a version continue to use version zero.
6. Corrected manual LOCKED account handling: a correct password cannot unlock it. Password reset does not silently reactivate a locked/inactive account. Explicit reactivation clears obsolete failed-attempt counters and lock deadlines. Inactive or missing roles cannot sign in or refresh.
7. Moved staff KPI calculations to database queries over the full filtered set. Administrative and restricted KPI filters match their labels; unknown roles return zero results. Sorting has an ID tie-breaker and pages reset/clamp after filtering.
8. Added ObjectId, trimmed-name, normalized username/email and password byte-limit validation. Literal searches, including @username, work without regex interpretation. Edit rejects empty/unknown fields. Phone input preserves country codes and formatting and supports 10-15 digits rather than silently truncating numbers.
9. Replaced Math.random password generation with Web Crypto and guaranteed uppercase, lowercase, numeric and symbol characters. Generated passwords are 16 characters. Client policy matches API validation. Reset input is masked; clipboard success is reported only after the copy succeeds. Copied pre-save credentials are labelled draft.
10. Added modal focus trapping/restoration, Escape handling, body scroll locking, accessible field names and short-viewport scrolling. Duplicate submits and dismissal while saving are guarded. Directory/role loading errors have retry controls and no fabricated zero counts or endless loading indication.
11. Added before/after metadata to staff update audit records without password/token values. Staff API responses use private, no-store caching.

## Validation and scope

Tests use an isolated MongoDB replica set and browser fixture server, not the configured application database. New backend coverage checks pagination-independent counts, search, validation, permissions, escalation attempts, old-token revocation, lock/reactivation, transactional rollback and concurrent administrators. Desktop/mobile browser coverage checks staff dialogs, CRUD, generated passwords, reset, status changes, read-only controls, keyboard focus, phone preservation and request recovery.

No live accounts, financial records or environment secrets were edited. The normal application must run the updated backend and frontend together. This is a code and isolated integration audit, not a production account/data reconciliation.

Final verification: 10 unit tests, 45 database integration tests and 30 desktop/mobile browser tests passed. Production build and TypeScript compilation passed. npm audit reported zero vulnerabilities in both packages.
