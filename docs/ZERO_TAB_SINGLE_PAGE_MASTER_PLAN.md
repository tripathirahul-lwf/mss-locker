# MSS Locker — Zero-Tab Single-Page Master Plan

**Date:** 4 September 2026  
**Requirement interpretation:** No Dashboard/Lockers/Customers-style module tabs in the header, no Vault/Customer/Renewal/Payment tabs inside content, and no mobile bottom-tab equivalent. All operational information must live in one continuous page.

## Final recommendation

Replace the present route-tab and in-page-tab design with a **continuous operations canvas**. The user scrolls through logically ordered sections; search, KPI cards, alerts and contextual actions take the user directly to the relevant section or record. Sections remain on the same document and are identified by headings and hash anchors.

This is the target—not five panels where only one is visible:

```text
ONE URL: /workspace

Utility header
Operational command centre
Attention queue
Vault inventory
Customers & KYC
Active agreements
Renewals & invoices
Payments & receipts
Deposits & refunds
Closures
Reports snapshot
Administration (permission-gated)
```

`/workspace#payments` and `/workspace#customer-CUS123` are allowed because they remain the same page. Existing `/lockers`, `/customers/:id`, etc. survive only as invisible compatibility redirects to anchors; they are not displayed as tabs.

## Why the current result is still wrong

The screenshot contains two visible module-switching systems:

1. Header row: Dashboard, Lockers, Customers, Allocations, Renewals, Payments, System.
2. Content selector: Vault Matrix Grid, Customer Directory, Renewals & Invoices, Receipts & Payments, Capacity & Telemetry.

The implementation confirms a third mobile representation of the same route navigation:

- `TopNavHeader.tsx:26–40` defines the route items.
- `TopNavHeader.tsx:140–147` renders desktop navigation.
- `TopNavHeader.tsx:157–164` renders mobile navigation and bottom items.
- `DashboardPage.tsx:57` defines `ConsoleView`.
- `DashboardPage.tsx:219` owns `activeView`.
- `DashboardPage.tsx:445–506` renders the second tab-like button row.
- `DashboardPage.tsx:510–700` conditionally displays only one content panel.

Therefore the application is “one shell with tab switches,” not “everything on one page.” The text “without switching tabs” also conflicts with what the interface visibly asks users to do.

## Zero-tab experience blueprint

### 1. Utility header only

Keep one 64px header containing:

- Logo and product name
- Global search / command palette
- Actual online/offline/sync state
- Notifications/attention count
- Signed-in user menu

Remove the entire second header row. System administration moves to the bottom Administration section and the user command palette.

### 2. Compact command centre

Replace the oversized hero with a compact page title and one action toolbar:

```text
Vault Operations                         Synced 11:02
[New allocation] [Add customer] [Record payment] [More ▾]
```

Only the most frequent role-allowed action is primary. Remaining actions sit in “More actions”; do not repeat them again in every section unless the scope differs.

### 3. Actionable operational summary

Use at most six compact metrics. Each card is a normal anchor link, not a tab:

- Available lockers → scroll/focus `#vault`, applying `status=vacant`
- Due this month → `#renewals`
- Overdue invoices → `#renewals-overdue`
- Today's collection → `#payments-today`
- KYC pending → `#customers-kyc`
- Closures/refunds awaiting approval → `#attention`

The selected filter is shown in the destination section and can be cleared. Clicking a metric never hides the other sections.

### 4. Attention queue before inventory

Daily operator work should appear before master data:

```text
Needs attention (12)
2 KYC reviews · 4 overdue invoices · 3 refunds · 3 closures
[Each row: entity | reason | age | owner | next action]
```

This replaces “dashboard as passive numbers” with a task-oriented landing area.

### 5. Continuous section cards

Every domain is a full-width section with the same anatomy:

```text
Section heading + count + health/status
One-line explanation
Scoped filters/search                         Section action
Compact preview: 5–20 records / virtualized viewport
View more / Load more (expands inline; never switches a tab)
```

Recommended order:

1. Needs attention
2. Vault inventory
3. Customers & KYC
4. Agreements / allocations
5. Renewals & invoices
6. Payments & receipts
7. Deposits & refunds
8. Locker closures
9. Reports snapshot
10. Administration

The order follows the common operational journey: capacity → customer → agreement → billing → settlement/closure.

### 6. Expansion without tabs

Use three levels:

- **Always visible:** heading, key counts, warnings and a small useful preview.
- **Inline expansion:** “Show all 372 customers” or “Expand rack” reveals more content directly below its section heading.
- **Focused overlay:** row details open a right-side inspector; create/approve/pay actions open one modal/wizard.

Section expansion is a disclosure/accordion interaction, not a mutually exclusive tab. Multiple sections may remain expanded. W3C describes accordions as vertically stacked headings that reveal/hide same-page content and documents their `aria-expanded`/`aria-controls` behavior: [WAI-ARIA Accordion Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/).

### 7. Navigation without visible tabs

- Global search: customer, locker, agreement, invoice or receipt → scroll to relevant section and open the row inspector.
- `Ctrl/Cmd+K`: also accepts commands such as “Go to payments” and “New allocation.”
- A small floating “Jump to section” button may open a plain list of anchors. It is not permanently displayed as a tab strip.
- Browser Find remains useful because section headings and loaded preview records exist in document order.
- A keyboard-visible “Skip to operations” link bypasses the utility header.

Named HTML sections and landmarks help assistive-technology users understand and navigate a long page. W3C cautions that landmark value drops when there are too many, so use landmarks for major page areas and semantic `section` + headings for individual domains: [WAI-ARIA Landmarks](https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/) and [Landmark Regions](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/).

## Screen layout

### Wide desktop

```text
┌────────────────────────────────────────────────────────────────┐
│ Logo       Global search                Sync  Alerts  User     │
├────────────────────────────────────────────────────────────────┤
│ Vault Operations       [primary actions......................] │
│ KPI summary links ............................................ │
├────────────────────────────────────────────────────────────────┤
│ Needs attention .............................................. │
├────────────────────────────────────────────────────────────────┤
│ Vault inventory / rack matrix ................................ │
├────────────────────────────────────────────────────────────────┤
│ Customers & KYC .............................................. │
├────────────────────────────────────────────────────────────────┤
│ Agreements ................................................... │
├────────────────────────────────────────────────────────────────┤
│ Renewals & invoices .......................................... │
├────────────────────────────────────────────────────────────────┤
│ Payments & receipts .......................................... │
├────────────────────────────────────────────────────────────────┤
│ Deposits/refunds · Closures · Reports · Administration ....... │
└────────────────────────────────────────────────────────────────┘
                                    ┌────────────────────────────┐
                                    │ Optional record inspector  │
                                    └────────────────────────────┘
```

### Tablet/mobile

- Same section order and same page.
- KPI cards become a two-column/one-column grid, not a horizontal carousel.
- Tables switch to labeled record cards or horizontally scroll only inside the data table—not for page navigation.
- Inspector becomes a full-screen dialog/sheet.
- No fixed bottom navigation bar.

## Component architecture

```text
SinglePageOperations
├── UtilityHeader
├── CommandCentre
├── OperationalSummary
├── AttentionQueueSection
├── DeferredSection id="vault"
│   └── VaultSection
├── DeferredSection id="customers"
│   └── CustomerSection
├── DeferredSection id="agreements"
│   └── AgreementSection
├── DeferredSection id="renewals"
│   └── RenewalSection
├── DeferredSection id="payments"
│   └── PaymentSection
├── DeferredSection id="deposits-refunds"
├── DeferredSection id="closures"
├── DeferredSection id="reports"
├── DeferredSection id="administration"
├── RecordInspector
└── TaskDialogHost
```

Rules:

- Parent page coordinates only summary, anchors and the shared inspector/dialog host.
- Each section owns its filters, queries, mutations, empty/error/loading UI and permissions.
- Section code uses dynamic imports. Offscreen sections render a stable skeleton/summary and mount heavy content near the viewport.
- Visibility affects expensive list/matrix queries, never top-level critical counts.
- Every section has a stable `id`, descriptive `h2`, and optional `aria-labelledby`.
- Hash state owns the current scroll target; query parameters can own filter/record/action state without introducing visible tabs.

## Data-loading strategy

Literal single-page display must not mean eager database loading.

### Initial request budget

On page entry load only:

1. Auth/user permissions
2. Compact `/workspace/summary`
3. Attention queue first page
4. Vault summary/rack counts

Do not load 1,500 locker records, all customers, invoices and payments together.

### Near-viewport loading

- Use `IntersectionObserver` or equivalent to enable each section query shortly before it enters the viewport.
- Preserve already-loaded data in TanStack Query cache when the user scrolls away.
- `Show more` uses server pagination/cursors.
- Locker matrix virtualizes cells/racks; tables virtualize only when pagination alone is insufficient.
- Prefetch a section when a KPI/attention link receives hover or keyboard focus.
- Use targeted invalidation; never `queryClient.invalidateQueries()` without a scoped key.

TanStack Query supports conditional queries through `enabled`, while its documentation warns that serial dependent queries create request waterfalls: [Disabling/Pausing Queries](https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries) and [Dependent Queries](https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries). web.dev recommends component-level code splitting so startup downloads only necessary JavaScript: [Code splitting guidance](https://web.dev/articles/reduce-javascript-payloads-with-code-splitting).

## URL, scroll and history behavior

Canonical forms:

```text
/workspace
/workspace#payments
/workspace?filter=overdue#renewals
/workspace?record=customer:64...#customers
/workspace?action=allocate&locker=64...#vault
```

- On anchor navigation, scroll with `scroll-margin-top` so the 64px header does not cover the heading.
- Move keyboard focus to the destination `h2` using `tabindex="-1"`; announce filter result count with `role="status"`.
- Back closes an action, then inspector, then returns to the previous anchor/filter state.
- Refresh reconstructs the selected record/action safely.
- Smooth scrolling respects `prefers-reduced-motion`.

W3C requires logical focus order and descriptive headings, especially important on a long canvas: [Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) and [Headings and Labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html). Dynamic result/sync messages should be programmatically announced without stealing focus: [Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages).

## Permissions and sensitive information

- Omit unauthorized sections entirely; do not show empty locked cards.
- For mixed sections, fetch and render only allowed subsections/actions.
- Fix current permission mismatches before migration: `audit_logs.view` → `audit.view`; define whether import visibility requires `imports.view` or `imports.create`; combined deposits/refunds must support both permission families.
- Sensitive KYC/master-key fields remain masked until an explicit permission-gated reveal, logged by the server.
- Maker-checker actions remain separated even though they appear on one page.

## Phased implementation plan

### Phase 0 — Requirement contract and task observation (2–3 days)

- Get written client confirmation of the annotated zero-tab layout.
- Observe actual staff doing allocation, lookup, payment, renewal, refund and closure.
- Rank sections by daily frequency; confirm whether Administration may start collapsed.
- Record baseline network requests, scroll/task time, bundle size, keyboard path and error states.
- Finalize role/permission/action matrix.

**Gate:** client approves “continuous page + inline expansion + inspector/dialog” vocabulary and wireframe.

### Phase 1 — Remove visible tabs and establish skeleton (3–4 days)

- Refactor `TopNavHeader` into `UtilityHeader`; delete desktop route row, mobile route grid and bottom nav.
- Remove `ConsoleView`, `activeView`, selector buttons and conditional panels from Dashboard.
- Create `SinglePageOperations` with all section headings in correct DOM order.
- Add anchors, skip link, scroll/focus manager and command-palette “go to section” commands.
- Route `/` and legacy module URLs to `/workspace` anchors.

**Gate:** no visible module tabs at desktop/tablet/mobile; every section is discoverable on one scrollable page.

### Phase 2 — Summary and read-only sections (5–7 days)

- Implement `/workspace/summary` DTO and attention queue.
- Extract Vault, Customers, Agreements, Renewals and Payments into independent section components.
- Keep compact previews visible; add inline Show more/Show less.
- Add deferred code/data loading and stable-height placeholders to prevent layout jump.
- Implement shared inspector for locker/customer/invoice/payment details.

**Gate:** hidden/offscreen full lists do not fetch initially; search/KPI links land on and focus the correct section.

### Phase 3 — Transaction workflows (7–10 days)

- Wire Add customer, KYC, allocate, renew, payment and receipt workflows through one task-dialog host.
- Add Deposits/Refunds and Closures sections with maker-checker states.
- Standardize success/error/offline/conflict announcements and targeted cache invalidation.
- Preserve draft/unsaved-change protection and prevent duplicate financial submissions.

**Gate:** five golden operational journeys finish without route/tab switching and match existing ledger/audit results.

### Phase 4 — Reports and administration (4–6 days)

- Add report snapshot and on-demand detailed report expansion.
- Add permission-gated Import/Export, Users, Roles, Audit and Settings sections near page end.
- Lazy-load heavy import wizard and administrative forms only on expansion/action.
- Remove old page implementations only after parity tests and legacy-link coverage.

**Gate:** every existing module has an explicit continuous-page location or an approved focused dialog.

### Phase 5 — Hardening and rollout (5–7 days)

- Unit/component tests: section ordering, permissions, deferred query enabling, anchor focus and disclosure state.
- Backend integration tests: summary authorization, money/state transitions, maker-checker and idempotency.
- E2E: allocation, KYC, payment/receipt, refund, closure; refresh and Back behavior.
- Keyboard/screen-reader pass, 400% zoom/reflow, mobile/tablet/wide desktop visual regression.
- Load test summary endpoint and 1,484-locker section; enforce request and chunk budgets.
- Feature-flag rollout: admins → counter pilot → all operators; keep rollback for one release.

**Gate:** zero P0/P1 defects, client acceptance, performance/accessibility budgets met.

Estimated delivery: **4–6 weeks for one focused full-stack engineer** or **3–4 weeks with coordinated frontend, backend and QA overlap**, after the zero-tab wireframe is approved.

## Definition of done

### Literal requirement

- Zero header module tabs.
- Zero content module tabs.
- Zero mobile bottom tabs/navigation cards.
- All permitted domain headings and compact summaries exist in one DOM/document flow.
- Expanding one section never hides another section.

### Performance

- Initial page does not issue customer, renewal, payment, closure and administration list requests together.
- No eager 1,500-locker fetch.
- Shared bundle does not exceed the present 544.16 kB minified baseline and should be reduced below the Vite warning threshold.
- Section placeholders prevent major layout shifts; slow/error/offline states are isolated per section.

### Usability/accessibility

- Search, KPI and attention links focus the correct destination.
- Logical `h1 → h2 → h3` structure; skip link and visible focus.
- No page-level horizontal scroll at 320 CSS px equivalent.
- All disclosures expose `aria-expanded` and `aria-controls`; status updates use appropriate live semantics.
- Inspector/dialog focus is contained and restored; no stacked task dialogs.

### Security/data integrity

- Section visibility and actions match centralized permission constants.
- API authorization remains mandatory.
- Financial/closure/refund actions remain validated, audited and duplicate-safe.
- Offline queued work is never displayed as completed before server confirmation.

## Files expected to change

Primary:

- `frontend/src/components/layout/TopNavHeader.tsx` → simplify/replace with `UtilityHeader`.
- `frontend/src/pages/DashboardPage.tsx` → replace monolith with page composition.
- `frontend/src/routes/AppRouter.tsx` → canonical workspace + legacy redirects.
- `frontend/src/constants/navigation.ts` → remove duplicated visible nav; retain typed section/action metadata only.
- New `frontend/src/features/workspace/*` shell, summary and section orchestration.
- Existing domain pages/components → extract reusable section containers rather than copy logic.
- New backend workspace summary route/controller/service/DTO.

No database schema change is expected for layout alone. Index/aggregation changes should be based on measured summary-query performance.

## Research limits

This plan is based on repository/screenshot audit and authoritative technical guidance. It does not replace observing the client's real operators. Exact section order, preview row counts and time estimates should be validated in Phase 0. The recommendation intentionally distinguishes “all capabilities on one page” from “all records loaded at once.”

