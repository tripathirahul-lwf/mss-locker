# Unified locker details: inline Edit and KYC

Date: 1 November 2026 (Asia/Kolkata)

## Root causes

The occupied-locker Edit handler closed the dossier and delegated to the old standalone form. KYC replaced the summary with the former tab layout, making it appear like a different modal. Invoice history was duplicated when retaining the summary.

## Changes

- Edit opens an inline region within the existing locker dialog. The original header and occupied customer/financial summary stay mounted. The existing validated form is reused in embedded mode, without another backdrop, portal, dialog header or second scroll container. Standalone create/edit usages remain supported elsewhere.
- Saved locker data updates the current dossier immediately. Dirty cancellation retains the explicit discard confirmation; saves retain double-submit protection, stale-record checks, field validation and permissions.
- KYC expands under the summary actions within the same layout. Upload, replace, preview and confirmed delete remain linked to the current customer. Done collapses the section.
- Editing and KYC work retain the same page URL and prevent conflicting actions during save/upload. Escape and focus restoration preserve the current dossier.
- KYC uses uploaded server MIME metadata and refreshes locker/customer counts after changes.
- Occupied invoice links use the existing bill/receipt history instead of rendering a duplicate legacy invoice list. Deposit operations stay within the dossier.
- Full-record loading errors/retry stay inline. Allocation context is fetched only with allocation-view permission.

## Validation

Desktop/mobile tests cover one-dialog editing, field validation, save/discard, retained summary, inline KYC upload/delete, busy guards, attachment flows, bill-history recovery, same-page customer/closure and renewal behavior. Final results appended below. No backend financial rules, live records or environment secrets were changed.

Final verification: 48 unique desktop/mobile scenarios verified across the locker/ledger/renewal regression run and focused rechecks. This includes occupied and vacant inline editors, saving/discarding, KYC busy guards and confirmed deletion, retained customer summary/history and invoice recovery. Production build and whitespace checks passed; desktop/mobile screenshots were inspected. The reusable form still serves standalone creation and direct catalogue editing where explicitly used.

## KYC popup preference update - 2 November 2026

KYC & ID documents now opens a separate light popup above the occupied locker dossier. Edit remains inline. The popup reuses the existing document upload/replace/preview/delete panel, blocks dismissal during uploads, keeps destructive confirmations and previews above its layer, and restores focus to the original KYC action on Close/Escape. The dossier retains its state and owns the body scroll lock, including direct KYC-card entry.

Validation: 16 focused desktop/mobile scenarios passed, including KYC upload, replacement, preview, confirmed deletion, initial KYC entry, keyboard focus/Escape, same-page profile navigation and unchanged inline editing. Production build and whitespace checks passed; popup screenshot visually checked.
