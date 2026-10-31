# Renewal modal audit

Date: 31 October 2026

## Implemented flow

Renew opens a light, responsive modal on the locker page. It shows the customer, phone, masked identity, opening and next-renewal dates, recorded annual tariff, held deposit, and bill/receipt history. KYC, closure, bill and receipt actions remain on the same page.

The renewal form allows editing the start date, tenure, next renewal date, rent, late fee, other charges, discount, tax and notes. Coverage ends one day before the next renewal date. A custom date does not automatically prorate the entered rent; this is explained in the form. Nonstandard coverage is saved as a custom billing period.

Issuing creates an unpaid bill and opens payment collection for authorized operators. It does not fabricate a receipt or charge the security deposit again. Paid coverage and the last-renewed timestamp change only after collection.

## Fixed findings

- Monthly, quarterly and half-yearly defaults previously charged a full year's base rent. Defaults now scale by term, preserve zero tariffs, and avoid repeated rounding drift when switching terms.
- Tax calculations now use the displayed net charges and two-decimal rounding consistently. Invalid amounts, excessive discounts, zero totals and invalid calendar dates are rejected.
- Exact-duplicate protection missed partially overlapping invoices. Generation now rejects overlapping coverage, recorded paid coverage and unresolved rent bills, and serializes concurrent issuance against the allocation.
- Invoice creation and its audit entry share a transaction. Audit failure rolls back issuance.
- Issuance previously updated the last-renewed timestamp before payment. It now preserves paid metadata until collection.
- Replaced tiny controls, silent search failures and unstable focus effects with readable fields, explicit recovery, labelled controls, contained keyboard focus and restoration. Submission locks prevent duplicate requests and closing during a save.

## Verification

Isolated database tests cover invalid dates/amounts, overlap protection, custom dates, term calculations, payment synchronization, concurrent renewal issuance and audit rollback. Desktop/mobile browser tests cover reference details, masking, editable coverage, GST, server errors, focus, same-page actions and the issuance-to-collection flow. Production build and whitespace checks are also run.

Final results: 12 unit tests and 55 database integration tests passed; all 6 renewal browser tests passed across desktop/mobile; production build and whitespace checks passed. An initial concurrent run hit an unrelated staff-test timeout; the isolated full backend rerun passed.

No environment secrets or live customer/financial records were modified.
