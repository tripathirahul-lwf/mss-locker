# Deposits & Refunds UI/UX Audit

Date: 2026-09-04

## Outcome

The module is now an embedded light-workspace section rather than a visually separate dark dashboard. Financial actions require an explicit active customer-locker account and are shown only when the authenticated user has the corresponding permission.

## Material findings and resolution

| Severity | Finding | Resolution |
|---|---|---|
| Critical | New operations silently used `transactions[0].allocationId`; an empty ledger left actions without a target. | Added an explicit active allocation selector and pass its ID to every account-scoped modal. |
| High | Collect, adjust, create, approve, pay, cancel and submit controls ignored UI permissions. | Added permission-aware visibility matching backend permission codes. |
| High | Refund cancellation used `window.prompt`, with weak context and validation. | Added a contextual modal, mandatory reason, disabled invalid confirmation and audit copy. |
| Medium | Dark cards/tables broke the continuous page hierarchy and produced low contrast in the light shell. | Converted the module surface, cards, controls, tables and badges to the shared light visual language. |
| Medium | Tables lacked captions/header scope and destructive icon buttons lacked accessible names. | Added native table semantics, busy/status states and explicit accessible labels. |
| Medium | Empty states were undifferentiated dead space. | Added compact, explanatory empty states with filter recovery guidance. |

## Workflow model

1. Select an active customer-locker account.
2. Start only an authorized collect, adjust or refund task.
3. Review the relevant ledger or maker-checker queue in its own semantic section.
4. Confirm destructive actions with transaction/request context and a recorded reason.
5. Refresh affected ledger, queue and summary totals after success.

## Validation and follow-up

- `npm.cmd run build`: passed (TypeScript plus production Vite build).
- No API or database schema changes.
- Recommended next validation: role-by-role browser test, populated-data visual regression at 320/768/1440 px, keyboard-only dialog testing, and a screen-reader smoke test.
- Existing platform warning: shared application chunk remains roughly 526 kB minified; treat vendor/manual chunking as separate performance work.

Research basis is recorded in the canonical [report-source.md](../report-source.md).
