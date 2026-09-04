# Unified operations page audit

Date: 2026-09-04

## Outcome

The primary workspace remains a continuous, single-page operations surface. The audit focused on correctness under real data growth, permissions, failure handling, keyboard use, request volume, and action clarity.

## Implemented fixes

- Replaced the dashboard's fixed 1,500-locker request with the existing pagination-safe `getAllLockers` API and compact records. The vault matrix can no longer silently omit inventory after the former cutoff.
- Debounced customer search by 300 ms, reset pagination only after the settled search changes, and added an accessible search name.
- Replaced clickable `div` KPI wrappers with native buttons. Space/Enter behavior, focus indication, and accessible action names now come from native semantics.
- Made all local create actions permission-aware. The Allocation Ready KPI becomes a navigation shortcut when allocation creation is not authorized.
- Removed dashboard-only edit/archive/cancel controls whose callbacks did no work. Shared tables now accept optional handlers and render transactional actions only when a real handler and permission both exist.
- Added differentiated query-error panels with preserved filters and local retry for lockers, customers, invoices, and payments. KPI failures now show an explicit warning and unavailable values rather than believable zeroes.
- Replaced global query-cache invalidation with a scoped dashboard refresh. Only visible, authorized datasets are refreshed.
- Added pressed-state semantics to invoice status filters, kept the section navigator as hash navigation rather than a false tab widget, and aligned deferred section scroll offsets with the sticky shell.
- Retained rack groups collapsed by default to keep the 1,484-item matrix scannable and avoid rendering every locker card at page entry.

## UX and architecture rationale

Native buttons follow the WAI-ARIA button interaction contract, including activation by Enter and Space. Error and refresh feedback use programmatic alert/status semantics. The section strip is navigation because it moves through simultaneously present page sections; it is not a tablist controlling mutually exclusive panels. Query cancellation is propagated through the existing all-lockers helper so superseded requests can be aborted.

Primary references:

- W3C WAI-ARIA APG, Button Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/button/
- W3C WCAG 2.2, Status Messages: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- W3C WAI-ARIA APG, Keyboard Interface: https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
- TanStack Query, Query Cancellation: https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation
- TanStack Query, Query Invalidation: https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation

## Validation and residual risk

The frontend TypeScript and production Vite build pass. Vite continues to report the pre-existing shared bundle warning (about 526 kB minified); the large secondary modules are already lazy-loaded. No backend contract or schema changed. Live-browser visual regression, production role-fixture testing, screen-reader testing, and production dataset profiling remain outside this repository-only run.
