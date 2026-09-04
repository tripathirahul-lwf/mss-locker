# Record Payment Collection modal audit

Date: 2026-09-04

## Outcome

The modal now supports a complete cashier flow: locate an unpaid invoice, verify the account, enter a full or partial payment, capture method-specific evidence, review the post-payment balance, submit once, and open the generated receipt.

## Confirmed issues and fixes

- **Blocked Other payments:** the server required a reference for `OTHER`, but the form rendered no field. A required transaction-reference field now appears for both Card and Other.
- **Success screen was unreachable in the unified dashboard:** its submit callback unmounted the modal immediately. Submission now leaves the modal mounted, shows the server-issued payment and receipt numbers, and lets the operator open the receipt.
- **Invoice context was lost:** paying from an invoice dossier reopened a generic search. The selected invoice ID is now carried into the payment modal.
- **Incorrect zero-balance fallback:** a zero balance previously fell back to invoice total. Zero-balance invoices are now blocked rather than repopulated as fully outstanding.
- **Stale method data:** hidden references from a previously selected payment method could be submitted. The payload now includes only fields relevant to the active method.
- **Search resilience:** out-of-order results are ignored, loading and no-results states are distinct, failures are visible, and retry is explicit.
- **Keyboard and modal behavior:** the dialog is named and described, initial focus moves inside, Tab is contained, Escape and backdrop dismissal work only while safe, background scrolling is locked, and focus returns to the launcher.
- **Form semantics:** labels are explicitly associated, dynamic references use native required validation and length limits, cheque-required labels match server rules, amount supports paise, and future payment dates are blocked in the UI.
- **Responsive layout:** dynamic viewport height prevents mobile-browser chrome from clipping the dialog; the footer provides both Cancel and a single clear primary action.
- **Transaction safety:** the existing idempotency key is retained across retry, and the backend already performs a live outstanding-balance check inside a MongoDB transaction.

## Research basis

- W3C WAI-ARIA APG Dialog (Modal) Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- WCAG 2.2 Understanding Error Identification: https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html
- WCAG 2.2 Understanding Labels or Instructions: https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html
- RFC 9110, Idempotent Methods: https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2
- MDN, HTML date input: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/date

W3C guidance supports the dialog focus and error/label behavior. RFC 9110 provides general idempotency semantics; the concrete idempotency-key contract is application-specific and was verified in this repository. MDN documents native date-input constraints. None of these sources are presented as Indian banking regulation.

## Validation and limits

Frontend TypeScript and the production Vite build pass. The backend payment transaction, overpayment protection, reference requirements, receipt generation and idempotency handling were statically inspected. Live payment-rail reconciliation, populated invoice fixtures, browser automation, screen-reader testing and finance-team acceptance testing were not available in this run.
