# Locker module performance audit

## Findings and changes
1. Normal paginated locker requests calculated ledger status by loading all active tenancies, populating customers and loading outstanding renewal invoices. Status is now derived from the existing page-scoped enrichment data instead. Removes three redundant database operations on a populated normal page and avoids scanning unrelated tenancies. Older tenancy invoices are excluded from page classification. Virtual due/KYC filters retain global classification to preserve existing date-fallback/filter semantics.
2. Locker statistics previously used six locker operations (two counts, three grouped aggregations, and an ID read). One indexed-match-first `$facet` now computes the same dimensions, availability and matching IDs. Matching is applied before faceting; no cross-user server response cache added.
3. The directory eagerly imported dossier, allocation wizard and edit tools. React lazy/Suspense now defers these tools until requested and keeps the directory visible while tools load.
4. Opening locker details eagerly loaded refund history even when viewing rent/customer information. Refund history now loads when Deposit & Refunds opens. Deposit summary remains eager because it is needed for the visible held-balance card.
5. Dashboard metric and directory observers now share a consistent 60-second stale window with focus refetch disabled. Existing mutation invalidations and explicit refresh remain in place. Financial action dialogs still fetch their own current summary and the backend revalidates writes.

## Reviewed without unnecessary changes
Search already debounces input by 350 ms and passes cancellation signals. List pagination already requests compact data; rack grouping/tiles already use memoization. Existing locker-number collation and tenancy/invoice indexes were retained. No speculative indexes, live index rebuilds or persistent ledger caches were added.

## Verification
- Production build and strict type checks passed.
- 91 isolated backend integration tests passed, including new assertions for page-scoped tenancy queries and one locker stats aggregation.
- 12 backend unit tests passed.
- 38 desktop/mobile browser checks passed: request-count/lazy-loading regression, occupied details, renewals, scroll locking, allotment, edits, customer profile and closure.
- Request regression verifies one initial stats API request, no initial dossier module request, no initial refund-history request, and one refund-history request after opening its popup.

## Limits and environment
These are verified query/request reductions, not a measured production latency percentage. Production cold starts, database region/network latency and virtual-filter global classification need production tracing for further tuning. Build chunk size alone does not quantify the initial dependency graph, so no unsupported bundle-size saving is claimed.

The local C: drive had 0 bytes free and npm failed with ENOSPC. Verification used D:/locker/.tmp for temporary files and npm cache. No personal files, environment secrets or live ledger data were deleted or changed. Deployment was not performed as part of this audit.

## Primary guidance
- [MongoDB $facet](https://www.mongodb.com/docs/manual/reference/operator/aggregation/facet/): shared input processing, match-first index use, memory limits.
- [React lazy](https://react.dev/reference/react/lazy): module-level lazy declarations and local Suspense boundaries.
