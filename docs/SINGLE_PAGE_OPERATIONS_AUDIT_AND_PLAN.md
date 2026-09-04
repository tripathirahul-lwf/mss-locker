# MSS Locker — Single-Page Operations Workspace Audit & Delivery Plan

**Audience:** Client, product owner, designer, frontend/backend engineers, QA  
**Audit date:** 4 September 2026  
**Decision:** How to consolidate the operational application into one understandable workspace without turning it into one slow, inaccessible, unmaintainable screen.

## Executive decision

Build a **single persistent operations workspace**, not a single giant document and not a second set of tabs inside Dashboard. Keep one app shell and one canonical workspace route, but render only the selected operational module. Represent workspace state in the URL, lazy-load each module, fetch only visible-module data, and show record details/actions in URL-addressable drawers or focused task dialogs.

Recommended route contract:

```text
/workspace?view=overview
/workspace?view=lockers&rack=20&status=VACANT
/workspace?view=customers&q=...
/workspace?view=allocations&status=ACTIVE
/workspace?view=billing&subview=renewals
/workspace?view=billing&subview=payments
/workspace?view=closures
/workspace?view=reports
/workspace?view=admin&subview=users

Record context:
/workspace?view=customers&record=customer:<id>&panel=summary
/workspace?view=lockers&record=locker:<id>&action=allocate
```

Legacy URLs such as `/lockers` and `/customers/:id` should redirect to the equivalent workspace URL for bookmarks, refresh, browser Back/Forward, and phased rollout compatibility.

## What was audited

- React/Vite frontend, app shell, route map, page composition, feature components, query usage, permissions and offline layer.
- Express/Mongoose backend routes, domain boundaries and transactional workflows.
- Current working-tree prototype shown in the supplied screenshot and its implementation in `DashboardPage.tsx`.
- Build output and existing automated tests.
- Authoritative guidance from W3C/WAI, React Router, TanStack Query, and web.dev.

The audit is static/code-based plus production-build verification. It is not a live usability study, browser accessibility scan, database load test, or stakeholder workflow observation.

## Current-state map

The product is already a client-side SPA, but business capability is divided across route pages:

| Domain | Existing UI | Business importance | Unified prototype coverage |
|---|---|---:|---|
| Overview | Dashboard | High | Yes |
| Locker inventory / rack matrix | Lockers + locker detail | Critical | Partial |
| Customers / KYC | Customers + customer detail | Critical | Partial |
| Allocations | Allocation list/wizard/detail | Critical | Action modal only |
| Renewals / invoices | Renewals | Critical | Partial |
| Payments / receipts | Payments | Critical | Partial |
| Deposits / refunds | Deposits & Refunds | Critical | Missing |
| Closures | Closure workflow | Critical | Missing |
| Reports | Reports | Medium | Missing |
| Import/export | Import wizard/history | Admin/high-risk | Missing |
| Users / roles / audit / settings | Administration | High-risk | Missing |

The backend exposes roughly 121 route declarations across these domains. Several workflows are stateful and irreversible or maker-checker sensitive, especially payment cancellation, refunds, closure approval/completion, import commit/rollback, and permission management.

## Findings, ordered by severity

### P0 — Resolve before extending the prototype

1. **Current Dashboard is becoming the new monolith.** It is 856 lines and directly owns five module views, four list query states, many selection/modal states, mutations and cross-domain invalidations. Adding the missing modules here will make regressions and permission leakage increasingly likely.
2. **Hidden modules still fetch.** Customer, renewal and payment list queries are enabled by permission, not by the active view. The locker query requests up to 1,500 records on workspace entry. A user opening the vault view therefore also pays for unrelated modules.
3. **The screenshot's tab strip does not satisfy the intent by itself.** It duplicates top navigation, overflows horizontally, has no URL state, no browser-history semantics, and currently uses plain buttons without the WAI-ARIA tabs keyboard/relationship contract.
4. **Coverage is incomplete.** Allocations, deposits/refunds, closures, reports, import/export and system administration remain separate. Calling the prototype “single-page unified operations” is premature.
5. **Permission vocabulary is inconsistent.** `TopNavHeader` checks `audit_logs.view`, while the backend and router use `audit.view`. Import access differs between `imports.view` in the header and `imports.create` in router/older navigation. Deposits & Refunds is variously gated by `deposits.view` and `refunds.view`. Centralize this before navigation consolidation.

### P1 — Architecture and workflow risks

1. Query keys are fragmented (`lockers`, `lockers-all`, `locker-stats`; similar patterns elsewhere), so mutations can refresh one surface while leaving another stale.
2. `refreshAll()` invalidates the entire query cache. In a consolidated workspace this creates avoidable request storms.
3. Page components duplicate orchestration already embedded in feature components. Reuse the domain feature, not the route page, as the workspace module boundary.
4. Detail pages carry important cross-domain context: `CustomerDetailPage` loads customer, KYC, allocations, invoices and payments. A shallow preview modal cannot replace that dossier.
5. Numerous stacked custom modals will become difficult to reason about. High-risk tasks need one focused dialog/wizard at a time; record inspection belongs in a side panel.
6. Offline support exists, but mutation availability, queued action status, conflict handling and post-sync refresh need one workspace-wide policy.

### P1 — UI/UX risks

1. The hero, six KPI cards, module selector and module-local toolbar consume substantial vertical space before primary work begins.
2. Emoji embedded in labels render as mojibake in source (`ðŸ…`, `â€”`), indicating encoding damage and inconsistent iconography.
3. Horizontal scrolling is being used for global module discovery and rack navigation simultaneously. Users can lose orientation, especially at zoom or tablet widths.
4. Repeated “Add/Record/Generate” actions appear both globally and within modules, making action scope ambiguous.
5. “Live synced 10:55 am” is static copy in the current implementation; it must derive from query/sync state and distinguish cached, refreshing, offline, failed and last-successful states.
6. Large matrices and tables need explicit keyboard behavior, focus visibility, row/cell semantics, virtualization and a non-visual list alternative.

### P2 — Quality and maintainability

- Frontend has no application-owned automated tests in the audited tree.
- Backend unit suite has only seven tests; it passes, but does not cover full business workflows.
- Both production TypeScript builds pass. Frontend build warns that the shared `index` chunk is 544.16 kB minified (171.03 kB gzip); the PWA precache is about 2.5 MB. Folding every module into one eager route would worsen startup cost.
- Three very large page files (`CustomerDetailPage` 939 lines, `UsersPage` 898, Dashboard 856) are refactoring hotspots.

## Target information architecture

Use task language and business grouping rather than mirroring database entities:

1. **Today** — actionable work queue, due renewals, overdue invoices, pending KYC/refunds/closures, recent exceptions; KPI cards filter a queue rather than acting as decoration.
2. **Vault** — rack/matrix and accessible list switch; status/size/floor filters; locker inspector panel; allocation entry point.
3. **Customers** — directory, KYC queue, customer dossier panel; allocation/billing/deposit timeline.
4. **Agreements** — allocations/reservations, activation/cancellation, tenure state.
5. **Billing** — Renewals, invoices, payments, receipts, deposits and refunds as secondary views under one financial domain.
6. **Closures** — explicit staged work queue because maker-checker and financial clearance require stronger context.
7. **Reports** — date-scoped reporting/export.
8. **Administration** — imports, users, roles, audit and settings; permission-gated and visually separated from daily counter operations.

On desktop/tablet, use a compact left rail or command switcher plus a sticky contextual toolbar. On small screens, use a module picker and full-screen inspectors. Do not put 10–13 peer tabs in one horizontal strip.

## Target component architecture

```text
WorkspaceRoute
└── WorkspaceShell
    ├── WorkspaceHeader (search, connectivity, identity)
    ├── WorkspaceNav (permission-filtered module registry)
    ├── ContextBar (title, saved view, filters, primary action)
    ├── ModuleBoundary (lazy import + error/suspense boundary)
    │   ├── TodayModule
    │   ├── VaultModule
    │   ├── CustomersModule
    │   ├── AgreementsModule
    │   ├── BillingModule
    │   ├── ClosuresModule
    │   ├── ReportsModule
    │   └── AdminModule
    ├── InspectorRoute (record side panel)
    └── TaskDialogRoute (mutating wizard/dialog)
```

Create a typed module registry as the single source of truth:

```ts
type WorkspaceModule = {
  id: WorkspaceView;
  label: string;
  icon: LucideIcon;
  requiredAny: PermissionCode[];
  load: () => Promise<{ default: ComponentType }>;
  defaultAction?: WorkspaceAction;
};
```

Key implementation rules:

- URL search params own `view`, `subview`, filters, sort, page, selected record and active action. Ephemeral typing/draft state remains local.
- Each module exports a small container plus presentational components and domain hooks. The shell must not import feature tables/modals eagerly.
- Standardize query-key factories (`lockerKeys`, `customerKeys`, etc.) and invalidate only affected aggregates/lists/details.
- Gate queries by both permission **and visibility**; prefetch on explicit hover/focus or predicted next task.
- Add a purpose-built `GET /api/workspace/summary` (or extend the existing dashboard sync endpoint) for compact counts/queues. Do not assemble the landing view from many full list endpoints.
- Keep server authorization on every endpoint. UI permission filtering is only presentation, never enforcement.
- Virtualize the 1,484-locker matrix and large tables; preserve pagination/server filters for screen readers and low-power devices.
- Use one record inspector at a time. Use dialogs only for short, focused or transactional tasks, with focus trap/restore and unsaved-change protection.

## Core interaction blueprint

### Desktop (recommended primary layout)

```text
┌──────────────── Search / Sync / Alerts / User ────────────────┐
│ Nav rail │ Module title + scoped filters + primary action     │
│          ├─────────────────────────────────────┬───────────────┤
│ Today    │ Work queue / matrix / table         │ Inspector     │
│ Vault    │ (only active module is mounted)     │ record detail │
│ Customer │                                     │ + actions     │
│ Billing  │                                     │               │
└──────────┴─────────────────────────────────────┴───────────────┘
```

- Opening a record adds `record=` to the URL and opens the right inspector without losing filters/scroll.
- Starting an action adds `action=` and opens a focused wizard. Completion closes the task, refreshes targeted queries, announces success and leaves the affected record selected.
- Browser Back closes action → inspector → returns to prior filter/view in a predictable order.
- Global search opens any record in its relevant workspace context rather than navigating away.

### Visual hierarchy

- Level 1: current module and one primary action.
- Level 2: 3–5 actionable summary items or a compact work queue.
- Level 3: filters + data surface.
- Level 4: inspector/detailed timeline.
- Status uses icon + text + color; never color alone. Financial and irreversible actions use explicit amount/entity confirmation.

## Phased implementation plan

### Phase 0 — Definition and baseline (2–3 days)

- Observe 3–5 real operators completing allocation, payment, renewal, KYC and closure tasks; capture frequency, handoffs and failure points.
- Agree that “single page” means one persistent workspace with no full-page context switch, not simultaneous rendering of every dataset.
- Capture baseline: task completion time/clicks, API count and bytes on first load, bundle chunks, INP/LCP, error rate, accessibility scan.
- Freeze a module/action/permission matrix and resolve the three permission inconsistencies above.

**Exit:** signed IA, workflow priorities, permission contract and measurable baseline.

### Phase 1 — Workspace foundation (3–5 days)

- Add `/workspace`; build `WorkspaceShell`, typed registry, permission-filtered rail/picker and URL-state parser.
- Redirect `/` to `/workspace?view=today`; retain old routes as compatibility redirects.
- Add module-level `lazy`, Suspense and error boundaries; route focus/announcement behavior; responsive shell.
- Add shared inspector and task-dialog routing primitives.

**Exit:** navigation, refresh, deep links and Back/Forward work with placeholder modules at 320 CSS px through wide desktop.

### Phase 2 — Read-only operational slice (5–7 days)

- Extract Today, Vault and Customers from `DashboardPage` into independent modules.
- Create compact workspace-summary API; fetch lists only when their module is active.
- Add locker virtualization and matrix/list switch; preserve server filtering.
- Move locker/customer details into inspectors; retain full dossier content and permissions.
- Standardize loading/empty/error/offline/stale states and query keys.

**Exit:** initial workspace avoids unrelated list calls; vault and customer lookup meet baseline parity; no route functionality removed.

### Phase 3 — Core revenue workflow (7–10 days)

- Add Agreements and Billing modules.
- Implement task journeys: new customer → KYC → allocation → deposit/payment → receipt; renewal → invoice → payment.
- Consolidate invoices, payments, deposits/refunds under Billing secondary navigation.
- Add targeted cache updates, duplicate-submit prevention, transaction progress and print recovery.

**Exit:** top counter workflows finish without leaving workspace; totals and audit events match legacy flows.

### Phase 4 — Controlled/high-risk workflows (5–8 days)

- Add Closures, refund approval/disbursement, cancellation and overrides.
- Preserve maker-checker separation, reason capture, readiness checks and least-destructive initial focus.
- Add Reports and permission-gated Administration; keep large import wizard code lazily loaded.

**Exit:** role-by-role parity matrix passes; forbidden data/actions are absent from UI and rejected by API.

### Phase 5 — Hardening and rollout (5–7 days)

- Component/unit tests for URL state, module registry, permission filtering, query enabling and focus restore.
- Integration tests for every high-risk backend state transition; E2E tests for five golden journeys and Back/Forward/deep-link behavior.
- Automated accessibility checks plus keyboard/screen-reader manual pass; responsive and 400% zoom checks.
- Performance budgets and request-count assertions; offline/slow network/conflict tests.
- Release behind `workspace_v2` feature flag: internal admin → counter staff pilot → all users. Keep legacy redirects/rollback path for one release window.

**Exit:** acceptance metrics met, no P0/P1 defects, support/runbook updated, client sign-off obtained.

Estimated engineering elapsed time: **4–6 weeks for one focused full-stack engineer**, or **3–4 weeks with frontend/backend/QA overlap**, after workflow validation. This is an estimate, not a code-derived fact; data-volume and acceptance feedback can change it.

## Acceptance criteria

### Functional

- Every currently authorized workflow is reachable from `/workspace` without a document reload.
- Every module, filter set, selected record and task entry point can be refreshed/bookmarked when safe.
- Old URLs resolve to equivalent workspace context.
- All role combinations see only allowed modules/actions; APIs remain authoritative.
- High-risk mutations are idempotent or guarded against duplicate submission and produce audit records.

### UX/accessibility

- Module navigation is operable by keyboard and announces the current module.
- Focus moves into inspectors/dialogs and returns logically on close; Escape behavior and unsaved changes are predictable.
- No required content/action is available only by horizontal scrolling.
- 400% zoom/reflow, visible focus, status text, error association and touch targets pass the chosen WCAG 2.2 AA test set.
- Matrix has an equivalent list/table route and efficient arrow-key navigation if implemented as an ARIA grid.

### Performance/reliability budgets

- Initial workspace loads summary plus the active module only; zero hidden-module list requests.
- No request of all 1,484 locker records merely to render overview KPIs.
- Set budgets after baseline; proposed starting gates: initial app JS ≤ current production baseline, active-view switch cached ≤200 ms perceived, uncached usable state ≤2 s on agreed office network, and no >500 kB minified shared chunk.
- Offline state never presents a queued mutation as completed; last successful sync timestamp is real data.

### Quality

- Golden E2E journeys: allocate, KYC update, renewal/payment/receipt, refund, closure.
- Contract tests cover workspace summary and permission-denied responses.
- Visual regression at phone, tablet, 1366×768 and wide desktop; empty, error, loading, stale and maximum-data fixtures included.

## Migration sequence (file-level)

1. Leave domain APIs/components in `frontend/src/features/*`; add `workspace/registry.ts`, `WorkspaceRoute.tsx`, shell primitives and URL schemas.
2. Split `DashboardPage.tsx` into `TodayModule`, `VaultModule`, `CustomersModule` and feature-specific hooks. Delete the old orchestration only after parity tests pass.
3. Replace duplicated string query keys with domain key factories and mutation invalidation maps.
4. Replace `TopNavHeader` route arrays and `constants/navigation.ts` with the registry; both currently duplicate navigation/permission rules.
5. Add legacy redirect adapters in `AppRouter.tsx`; do not remove old route behavior in the first release.
6. Add backend workspace DTO/service/controller using aggregation/count queries, field projection and permission-scoped sections.

## Decisions the client should approve

1. Whether “single page” allows URL changes and browser history (recommended: yes; still zero document reload).
2. Primary operator role/device and the five most frequent workflows.
3. Whether administration must visually live in the same workspace or only share the same shell.
4. Which summary cards are actionable priorities versus reporting-only metrics.
5. Pilot cohort, success metrics and legacy-workspace fallback period.

## Evidence behind the design

- React Router recommends URL search parameters for view state, avoiding duplicate local/URL synchronization and preserving addressability: [React Router — State Management](https://reactrouter.com/explanation/state-management).
- TanStack Query supports visibility-dependent queries via `enabled` and warns that dependent waterfalls harm performance: [Disabling/Pausing Queries](https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries) and [Dependent Queries](https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries).
- web.dev recommends route/component code splitting and sending only startup-critical JavaScript; this directly argues against eager imports for all workspace modules: [Reduce JavaScript payloads with code splitting](https://web.dev/articles/reduce-javascript-payloads-with-code-splitting) and [Code-split JavaScript](https://web.dev/learn/performance/code-split-javascript).
- W3C's tabs pattern requires tab/tabpanel relationships, arrow-key behavior and advises automatic activation only when panels have no noticeable latency: [WAI-ARIA Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).
- W3C's grid guidance describes managed arrow-key navigation and a shorter tab sequence for interactive tabular content: [WAI-ARIA Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/).
- W3C requires predictable focus and modal focus containment/return; transactional workspace dialogs must implement this behavior: [WAI-ARIA Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) and [Keyboard Interface Guidance](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/).
- WCAG reflow guidance highlights the risk of sticky/fixed UI obscuring content or focus under zoom: [Understanding WCAG 2.2 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

## Verification record

- `frontend`: `npm.cmd run build` — passed; Vite chunk-size warning recorded above.
- `backend`: `npm.cmd run build` — passed.
- `backend`: `npm.cmd run test:unit` — 7/7 passed.
- Frontend application-owned tests: none found.
- Existing user changes were not overwritten; this audit adds documentation only.

