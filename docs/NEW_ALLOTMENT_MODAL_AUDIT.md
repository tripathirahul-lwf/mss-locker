# New allotment modal audit

Date: 31 October 2026

## Fixed findings

- Attaching ID proof without a number previously sent a fabricated value such as `AADHAAR Scan`, which failed typed-ID validation. Numberless attachments now save as generic OTHER documents with an empty number and Pending verification. Typed IDs still require a valid number; non-generic numbers are normalized before storage.
- Upload boxes silently rejected unsupported/oversized files and accepted empty files locally. They now show a field error, reject empty files and multi-file drops, support keyboard activation and permit selecting a rejected file again.
- Upload result MIME metadata was overwritten with the original local MIME type. The form now preserves the server's processed MIME type and size.
- Upload/drop/preview controls now respect the frozen uncertain-save state. Cash confirmation also resets after key or email changes. Receipt calendar dates are validated before uploads.
- Keyboard focus skips hidden/disabled controls and remains contained after a control disappears or during saving; Escape cannot close a busy form.
- Allotment replay previously returned every later payment on the allocation. It now returns only the original rent/deposit collections belonging to the request.

## Retained behavior verified

Rent/GST/fee/deposit totals, editable renewal dates, cash confirmation, optional attachments, local image/PDF preview, private upload validation, combined-operation permissions, atomic save and same-request lost-response retry remain in place. The existing-customer search field was not reintroduced.

Verification uses isolated database tests, unit checks, production build and desktop/mobile browser scenarios. No live customer/financial data or environment secrets were modified.

Final results: 12 unit tests, 66 database integration tests, 4 new upload/attachment browser tests and 8 existing allotment browser regressions passed. Production build and whitespace checks passed.
