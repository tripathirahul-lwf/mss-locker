# Workspace Section Navigation Audit

Date: 2026-09-04

## Decision

Restore the previous five shortcuts at the KPI/content boundary, but implement them as in-page navigation rather than an ARIA tablist. All corresponding sections remain visible in the continuous workspace; selecting an item updates the URL hash and moves focus/scroll to that section.

## Implemented behavior

- Restored Vault matrix, Customers, Renewals & invoices, Receipts & payments, and Capacity & telemetry shortcuts.
- Filters shortcuts by effective user permissions.
- Displays available record counts without blocking navigation while deferred data loads.
- Uses a labelled `nav`, real hash links and `aria-current="location"` for the active section.
- Tracks the current section with `IntersectionObserver` while scrolling.
- Supports keyboard activation, visible focus and reduced-motion preferences through the existing section-scroll helper.
- Uses horizontal overflow on narrow screens rather than compressing or wrapping controls unpredictably.
- Keeps the strip sticky below the application header and increases section scroll margin so headings are not obscured.

## Why these are not semantic tabs

ARIA tabs represent one selected tab controlling one associated panel, normally with non-selected panels hidden. Here all sections remain present as a single document. A navigation landmark with links accurately communicates the interaction and preserves the zero-tab single-page architecture.

## Verification

- TypeScript and Vite production build passed.
- Existing section IDs and hash routing remain intact.
- No API or database changes.

Research evidence is maintained in [report-source.md](../report-source.md).
