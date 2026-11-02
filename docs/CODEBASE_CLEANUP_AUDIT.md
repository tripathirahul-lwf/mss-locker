# Codebase cleanup audit

## Scope and evidence
Reviewed frontend/backend source, TypeScript diagnostics, module references (including lazy imports and test entrypoints), package manifests and generated root logs. Existing application changes and environment files were preserved.

## Removed
Ten unreferenced frontend modules:
- components/common/ChangePasswordModal.tsx
- components/common/CommandPalette.tsx
- components/layout/Sidebar.tsx
- components/ui/avatar.tsx
- features/dashboard/components/DashboardCustomersWorkspace.tsx
- features/dashboard/components/DashboardPaymentsWorkspace.tsx
- features/dashboard/components/DashboardRenewalsWorkspace.tsx
- lib/dexie.ts (obsolete wrapper; active offline database retained)
- services/roleService.ts
- constants/navigation.ts (obsolete sidebar navigation)

Removed unused imports, dead handlers, state and local helpers across frontend/backend. Removed unused header command-palette callback; active global search shortcut remains. Preserved positional Express handler arguments using underscore names where needed.

Removed unused direct frontend dependencies @hookform/resolvers, react-hook-form and zod, with package-lock updated. Backend Zod, Sharp runtime packages, active Dexie database, migration/import scripts, model exports, reference HTML, documents and active routes remain.

Removed generated audit/build/test logs from the workspace root. Build caches, uploaded files and user data were not recursively deleted.

## Prevention
Enabled noUnusedLocals and noUnusedParameters in both TypeScript configurations. These checks now run through normal build/type-check commands.

## Verification
- Frontend and backend production build passed with strict unused-code checks.
- 90 backend integration tests passed against isolated test data.
- 12 backend unit tests passed.
- Full browser suite: 98 passed initially; 8 obsolete selectors referenced the previous inline edit/deposit UI or old invoice label. Updated those selectors to the current popup/label contracts and all 8 affected desktop/mobile cases passed on rerun (106 cases validated across the runs).
- Git whitespace check passed.

No live database mutation, credential changes or deployment. Existing dependency advisories were not force-upgraded during this cleanup.
