# Collect Deposit Modal Audit

Date: 2026-09-04

## Result

The collect-deposit flow is now a responsive light-workspace dialog with explicit transaction review, stronger reconciliation data, keyboard containment, duplicate-submit protection and server-enforced override authorization.

## Findings resolved

| Severity | Finding | Resolution |
|---|---|---|
| Critical | Any user with `deposits.collect` could send `allowOverride: true`; the server did not enforce `deposits.override`. | Controller now rejects unauthorized overrides with HTTP 403; the override control is shown only to authorized users. |
| High | Deposit requests did not send the idempotency key already supported by the backend. | A unique key is created per opened transaction flow and sent in `Idempotency-Key`. |
| High | Non-cash payments could be submitted without a reconciliation reference. | Transaction/UTR or cheque reference is now required for non-cash methods. |
| High | Custom overlay lacked dialog semantics, focus containment, Escape handling and focus restoration. | Added named modal semantics, initial focus, a focus loop, Escape handling, body scroll lock and return focus. |
| Medium | Dark styling conflicted with the light continuous workspace. | Rebuilt header, account summary, inputs, warnings and sticky review footer using the light design system. |
| Medium | Errors were detached from fields and disabled-state causes were unclear. | Added textual alert feedback, input descriptions, invalid state, contextual overcollection guidance and validation-specific messages. |
| Medium | Payment options were visual buttons without native selection semantics. | Converted the selector to a labelled radio group with visible keyboard focus. |
| Medium | Final action did not provide a compact review. | Sticky footer repeats receipt amount and payment method immediately before confirmation. |

## Verification

- Frontend TypeScript and production build passed.
- Backend TypeScript build passed.
- Backend unit tests: 7 passed.
- Backend integration tests: 3 passed.
- No database schema change.

## Remaining validation

Run role-based browser tests using a collector with and without `deposits.override`, validate actual UPI/card/bank/cheque reconciliation requirements with the client, and perform keyboard plus screen-reader testing in supported browsers.

Research basis is maintained in [report-source.md](../report-source.md).
