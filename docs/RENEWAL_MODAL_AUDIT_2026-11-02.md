# Renewal modal audit - 2 November 2026

Fixed negotiated amount scaling across tenure changes, custom coverage explanation/reset, advance renewal notice, visible validation, upload progress, invalid paid-through fallback, and background focus isolation.

An unconfirmed collection now stays frozen through subsequent failed retries. The original request ID and payload are reused. Backend replay validates invoice settlement, payment amount/purpose, and agreement/customer/locker links; collection asserts full reconciliation before success. Completion callbacks run outside financial error handling.

The screenshot's disabled Renew button was expected because the required receipt number was blank. The dialog now explains this.

Verification: production build passed; 90 integration tests, 12 unit tests, and 8 desktop/mobile renewal browser tests passed. Browser coverage includes negotiated pricing, custom dates, file validation/preview/removal, focus restoration, and lost response followed by HTTP 429 then successful identical retry. Mobile screenshot reviewed. No live ledger data or environment secrets changed.

Guidance consulted: [W3C modal dialogs](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) and [MDN date inputs](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/date).

Advance renewal remains allowed; imported financial dates and tax policy were not changed.
