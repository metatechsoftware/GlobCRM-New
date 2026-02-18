# Phase 12: v1.0 Bug Fixes & Integration Polish - Research

**Researched:** 2026-02-18
**Domain:** Angular 19 frontend bug fixes, architectural refactoring, route guards
**Confidence:** HIGH

## Summary

Phase 12 addresses all gaps identified in the v1.0-MILESTONE-AUDIT.md: 1 critical integration bug (Gmail OAuth HTTP method mismatch), 2 UX bugs (quote transitions, dashboard saveLayout), and 3 architectural debt items (navbar navigation, shared component extraction, route-level permission guards). All 6 tasks are frontend-only changes. No backend modifications are required.

Every task has been verified against the actual source code. The fixes are straightforward -- most are single-line or small structural changes. The critical Gmail connect bug is a one-character method name change. The dashboard saveLayout bug requires replacing a misguided optimistic update pattern with the existing reload pattern already used elsewhere in the same store. The ConfirmDeleteDialog extraction is the most involved task, requiring a new file creation plus import path updates across 16 files.

**Primary recommendation:** Execute all 6 tasks as independent, parallelizable fixes. Each can be verified in isolation. Order by priority: Gmail connect fix first (unblocks E2E flow), then the two UX bugs, then the three architectural items.

## Standard Stack

### Core (already in project -- no new dependencies)
| Library | Version | Purpose | Relevance |
|---------|---------|---------|-----------|
| Angular | 19 | Frontend framework | All fixes are Angular component/service changes |
| @ngrx/signals | latest | State management | Dashboard store fix |
| @angular/material | M3 | Dialog component | ConfirmDeleteDialog uses MatDialogModule |
| Angular Router | 19 | Route guards | permissionGuard already exists, just needs wiring |

### Supporting
No new libraries are needed. All fixes use existing project infrastructure.

### Alternatives Considered
None applicable -- this is a bug-fix phase using established patterns.

## Architecture Patterns

### Pattern 1: ApiService GET vs POST
**What:** The `ApiService` wrapper provides `get<T>(path, params?)` and `post<T>(path, body?)` methods. The Gmail connect endpoint (`[HttpGet("connect")]`) returns a JSON `{ authorizationUrl }` response body.
**Fix pattern:** Change `this.api.post<ConnectResponse>(...)` to `this.api.get<ConnectResponse>(...)`.
**File:** `globcrm-web/src/app/features/emails/email.service.ts` line 81.
**Current code:**
```typescript
connect(): Observable<ConnectResponse> {
  return this.api.post<ConnectResponse>(`${this.accountBasePath}/connect`);
}
```
**Fixed code:**
```typescript
connect(): Observable<ConnectResponse> {
  return this.api.get<ConnectResponse>(`${this.accountBasePath}/connect`);
}
```
**Backend confirmation:** `EmailAccountsController.cs` line 81 has `[HttpGet("connect")]` returning `Ok(new ConnectResponseDto { AuthorizationUrl = authorizationUrl })`.

### Pattern 2: Quote Transition Map (Frontend/Backend Alignment)
**What:** The frontend `QUOTE_TRANSITIONS` map should mirror the backend `QuoteWorkflow.AllowedTransitions`. The backend defines `Accepted` as terminal (empty array). The frontend incorrectly allows `Accepted -> ['Draft']`.
**File:** `globcrm-web/src/app/features/quotes/quote.models.ts` line 22.
**Current code:**
```typescript
export const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  Draft: ['Sent'],
  Sent: ['Accepted', 'Rejected', 'Expired', 'Draft'],
  Accepted: ['Draft'],  // BUG: should be []
  Rejected: ['Draft'],
  Expired: ['Draft'],
};
```
**Fixed code:**
```typescript
Accepted: [],  // Terminal state -- matches backend QuoteWorkflow
```
**Backend confirmation:** `QuotesController.cs` line 713: `[QuoteStatus.Accepted] = []` with comment "Accepted->[] (terminal)".

### Pattern 3: Optimistic Update with Background Save (Dashboard saveLayout)
**What:** The `saveLayout` method already uses the correct optimistic update pattern. It patches local state with the new widget positions immediately, then sends the update to the backend in the background. On failure, it reverts by calling `loadDashboard`. This is actually the CORRECT pattern already implemented in the current code (lines 200-232).
**Audit finding re-evaluation:** After reading the current `dashboard.store.ts` code (lines 200-232), the saveLayout method does NOT have the bug described in the audit. The current code:
1. Optimistically patches `activeDashboard` with the new widgets array (line 205-207)
2. Sends `api.updateDashboard()` in the background (line 226)
3. On error, reverts by calling `this.loadDashboard(dashboard.id)` (line 229)
4. Does NOT patch with the response body (the 204 No Content response)

**Important discovery:** The audit describes patching with the 204 response body (null), but the CURRENT code does not do this. The code already uses the correct optimistic update pattern. This fix may have already been applied, OR the audit description was based on an earlier version of the code. The planner should verify whether this bug still manifests before creating a task.

**If the bug still occurs despite correct store code:** The issue could be in the `DashboardApiService.updateDashboard()` return type. It declares `Observable<DashboardDto>` but the backend returns 204 No Content (no body). Angular's HttpClient will emit `null` for a 204 response when expecting JSON. Since the store ignores the success response (no `next` handler in the subscribe), this should not cause issues. But if any subscriber elsewhere chains off this observable, it could receive null. Verify in browser.

### Pattern 4: Navbar Navigation Groups
**What:** The navbar uses a `navGroups: NavGroup[]` array of `{ label, items }` objects. Each item has `{ route, icon, label }`. The import feature (`/import`) is not in any group.
**File:** `globcrm-web/src/app/shared/components/navbar/navbar.component.ts` lines 62-102.
**Best placement:** Add to the "Admin" group since importing data is an administrative operation. Position it before "Team" in the Admin group.
**Code to add:**
```typescript
{
  label: 'Admin',
  items: [
    { route: '/import', icon: 'upload_file', label: 'Import' },  // NEW
    { route: '/team-directory', icon: 'groups', label: 'Team' },
    { route: '/settings', icon: 'settings', label: 'Settings' },
  ]
},
```
**Icon choice:** `upload_file` is the standard Material icon for file import operations. Alternative: `publish` (upload arrow).

### Pattern 5: Shared Component Extraction
**What:** `ConfirmDeleteDialogComponent` is currently defined at the bottom of `features/settings/roles/role-list.component.ts` (lines 207-225). It is a standalone component with inline template. 16 files import it from `../../settings/roles/role-list.component`.
**Component definition (to extract):**
```typescript
@Component({
  selector: 'app-confirm-delete-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Confirm Delete</h2>
    <mat-dialog-content>
      <p>Are you sure you want to delete the {{ data.type }} "{{ data.name }}"?</p>
      <p>This action cannot be undone.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="warn" [mat-dialog-close]="true">Delete</button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDeleteDialogComponent {
  readonly data: { name: string; type: string } = inject(MAT_DIALOG_DATA);
}
```
**Target location:** `globcrm-web/src/app/shared/components/confirm-delete-dialog/confirm-delete-dialog.component.ts`
**Import updates required (16 files):**
All currently import from `'../../settings/roles/role-list.component'` (or `'../roles/role-list.component'` for settings-internal files). All must change to the new shared location.
**Files to update:**
1. `features/companies/company-list/company-list.component.ts`
2. `features/companies/company-detail/company-detail.component.ts`
3. `features/contacts/contact-list/contact-list.component.ts`
4. `features/contacts/contact-detail/contact-detail.component.ts`
5. `features/deals/deal-list/deal-list.component.ts`
6. `features/deals/deal-detail/deal-detail.component.ts`
7. `features/products/product-list/product-list.component.ts`
8. `features/activities/activity-list/activity-list.component.ts`
9. `features/activities/activity-detail/activity-detail.component.ts`
10. `features/quotes/quote-list/quote-list.component.ts`
11. `features/quotes/quote-detail/quote-detail.component.ts`
12. `features/requests/request-list/request-list.component.ts`
13. `features/requests/request-detail/request-detail.component.ts`
14. `features/notes/note-detail/note-detail.component.ts`
15. `features/settings/pipelines/pipeline-list.component.ts`
16. `features/settings/teams/team-list.component.ts`

Plus the original `features/settings/roles/role-list.component.ts` which needs the component definition REMOVED and replaced with an import from the new shared location.

### Pattern 6: Route-Level Permission Guards
**What:** The `permissionGuard(entityType, operation)` function factory already exists at `core/permissions/permission.guard.ts`. It checks `PermissionStore.hasPermission()` and redirects to `/dashboard` if denied. CRM entity routes in `app.routes.ts` currently only have `authGuard` but lack `permissionGuard`.
**File:** `globcrm-web/src/app/app.routes.ts`
**Entity types from backend `EntityType` enum:** `Contact`, `Company`, `Deal`, `Activity`, `Quote`, `Request`, `Product`, `Note`
**Routes that need `permissionGuard` added to `canActivate`:**

| Route | Entity Type | Guard Call |
|-------|-------------|------------|
| `/companies` | Company | `permissionGuard('Company', 'View')` |
| `/contacts` | Contact | `permissionGuard('Contact', 'View')` |
| `/products` | Product | `permissionGuard('Product', 'View')` |
| `/deals` | Deal | `permissionGuard('Deal', 'View')` |
| `/activities` | Activity | `permissionGuard('Activity', 'View')` |
| `/quotes` | Quote | `permissionGuard('Quote', 'View')` |
| `/requests` | Request | `permissionGuard('Request', 'View')` |
| `/notes` | Note | `permissionGuard('Note', 'View')` |

**Routes that should NOT get permissionGuard:**
- `/auth` -- unauthenticated
- `/onboarding` -- no entity permission
- `/dashboard` -- general access, no entity type
- `/settings` -- uses adminGuard or internal checks
- `/profile` -- user's own profile
- `/team-directory` -- general access
- `/emails` -- no Email entity type in RBAC
- `/feed` -- no Feed entity type in RBAC
- `/calendar` -- uses Activity permission on backend, but calendar is a view not an entity. Could optionally add `permissionGuard('Activity', 'View')` since the backend CalendarController uses `Permission:Activity:View`.
- `/import` -- admin operation, could use adminGuard but not in scope

**Example route with guard:**
```typescript
{
  path: 'companies',
  canActivate: [authGuard, permissionGuard('Company', 'View')],
  loadChildren: () =>
    import('./features/companies/companies.routes').then(
      (m) => m.COMPANY_ROUTES
    ),
},
```
**Note:** `canActivate` accepts an array -- both `authGuard` and the `permissionGuard` result run. `authGuard` ensures logged in, `permissionGuard` ensures RBAC access.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Permission checking | Custom guard logic | Existing `permissionGuard()` factory | Already handles async loading, timeout, redirect |
| Delete confirmation | New dialog component | Existing `ConfirmDeleteDialogComponent` | Just move it to shared |
| API method wrappers | Direct HttpClient calls | Existing `ApiService` | Consistent error handling, base URL |

## Common Pitfalls

### Pitfall 1: Angular canActivate Array Ordering
**What goes wrong:** If `permissionGuard` runs before `authGuard`, the PermissionStore may not be loaded because the user isn't authenticated yet.
**Why it happens:** Route guards run in array order. If permission guard fires first, it tries to check permissions before auth token is available.
**How to avoid:** Always put `authGuard` FIRST in the `canActivate` array: `canActivate: [authGuard, permissionGuard('Entity', 'View')]`.
**Warning signs:** Users get redirected to dashboard even when they have permissions.

### Pitfall 2: Import Path Depth After Moving Component
**What goes wrong:** When moving `ConfirmDeleteDialogComponent` to shared, each importing file needs a different relative path depending on its depth in the directory tree.
**Why it happens:** 16 files at various depths import the component -- `../../settings/roles/role-list.component` for features, `../roles/role-list.component` for settings-internal.
**How to avoid:** Calculate the correct relative path for each file. From `features/X/X-list/` the path to `shared/components/confirm-delete-dialog/` is `../../../shared/components/confirm-delete-dialog/confirm-delete-dialog.component`. From `features/settings/Y/` the path is `../../shared/components/confirm-delete-dialog/confirm-delete-dialog.component`. Alternatively, consider adding a barrel export to the shared index if one exists.
**Warning signs:** TypeScript compilation errors about missing modules.

### Pitfall 3: 204 No Content and Observable<T> Type Mismatch
**What goes wrong:** `DashboardApiService.updateDashboard()` declares return type `Observable<DashboardDto>` but the backend returns 204 No Content (empty body). Angular HttpClient emits `null` for the response.
**Why it happens:** The service type declaration doesn't match the actual HTTP response.
**How to avoid:** Since the dashboard store's `saveLayout` already ignores the success response (no `next` handler), this is not currently causing issues. But if someone adds a `.pipe(tap(...))` or `next` handler, they'll get null. Consider changing the service return type to `Observable<void>` for correctness.
**Warning signs:** Any code that reads the response from `updateDashboard()` gets null.

### Pitfall 4: Removing Export from role-list.component.ts
**What goes wrong:** After extracting `ConfirmDeleteDialogComponent` to shared, the original file still exports `CloneRoleDialogComponent`. The `ConfirmDeleteDialogComponent` class must be removed from the file but the `CloneRoleDialogComponent` must remain.
**Why it happens:** Both dialog components are co-located in the same file.
**How to avoid:** Remove only the `ConfirmDeleteDialogComponent` class and its `@Component` decorator. Keep the `CloneRoleDialogComponent` intact. Update `role-list.component.ts` to import `ConfirmDeleteDialogComponent` from the new shared location.

### Pitfall 5: permissionGuard Return Type
**What goes wrong:** The `permissionGuard` factory returns a `CanActivateFn`. When permissions are not yet loaded, it returns a `Promise<boolean>` that polls every 100ms for up to 5 seconds.
**Why it happens:** Designed to handle race condition where guard fires before PermissionStore loads.
**How to avoid:** This is already handled correctly. Just use the guard factory as-is. Note: after 5 seconds timeout, it ALLOWS access (permissive timeout) -- this is by design since backend still enforces.

## Code Examples

### Task 1: Fix Gmail Connect HTTP Method
```typescript
// File: globcrm-web/src/app/features/emails/email.service.ts
// Line 80-82: Change post to get

connect(): Observable<ConnectResponse> {
  return this.api.get<ConnectResponse>(`${this.accountBasePath}/connect`);
}
```

### Task 2: Fix Quote Transitions
```typescript
// File: globcrm-web/src/app/features/quotes/quote.models.ts
// Line 22: Change Accepted: ['Draft'] to Accepted: []

export const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  Draft: ['Sent'],
  Sent: ['Accepted', 'Rejected', 'Expired', 'Draft'],
  Accepted: [],          // Terminal -- matches backend QuoteWorkflow
  Rejected: ['Draft'],
  Expired: ['Draft'],
};
```

### Task 3: Dashboard saveLayout (Verify First)
```typescript
// File: globcrm-web/src/app/features/dashboard/stores/dashboard.store.ts
// Current code (lines 200-232) already uses optimistic update pattern correctly.
// The audit described a bug where patchState used the 204 response body (null),
// but the current code does NOT do this. Verify in browser whether bug persists.
//
// IF bug still manifests, it may be a different issue. One possible additional
// fix is changing DashboardApiService.updateDashboard return type:
//   updateDashboard(id: string, req: UpdateDashboardRequest): Observable<void>
// instead of Observable<DashboardDto> to correctly reflect 204 No Content.
```

### Task 4: Add Import to Navbar
```typescript
// File: globcrm-web/src/app/shared/components/navbar/navbar.component.ts
// In navGroups array, 'Admin' group -- add import entry

{
  label: 'Admin',
  items: [
    { route: '/import', icon: 'upload_file', label: 'Import' },
    { route: '/team-directory', icon: 'groups', label: 'Team' },
    { route: '/settings', icon: 'settings', label: 'Settings' },
  ]
},
```

### Task 5: Extract ConfirmDeleteDialogComponent
```typescript
// NEW FILE: globcrm-web/src/app/shared/components/confirm-delete-dialog/confirm-delete-dialog.component.ts

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-confirm-delete-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Confirm Delete</h2>
    <mat-dialog-content>
      <p>Are you sure you want to delete the {{ data.type }} "{{ data.name }}"?</p>
      <p>This action cannot be undone.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="warn" [mat-dialog-close]="true">Delete</button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDeleteDialogComponent {
  readonly data: { name: string; type: string } = inject(MAT_DIALOG_DATA);
}
```

### Task 6: Add Permission Guards to Routes
```typescript
// File: globcrm-web/src/app/app.routes.ts
// Add import at top:
import { permissionGuard } from './core/permissions/permission.guard';

// Then add to each CRM entity route:
{
  path: 'companies',
  canActivate: [authGuard, permissionGuard('Company', 'View')],
  loadChildren: () =>
    import('./features/companies/companies.routes').then(
      (m) => m.COMPANY_ROUTES
    ),
},
// Repeat pattern for: contacts, products, deals, activities, quotes, requests, notes
// Optionally: calendar with permissionGuard('Activity', 'View')
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@CanActivate` decorator | Functional `CanActivateFn` | Angular 15+ | Route guards are now factory functions, not classes |
| NgModule shared modules | Standalone component imports | Angular 14+ | Components can be imported directly, no shared module barrel needed |
| Class-based guards | `permissionGuard()` factory function | Already implemented | Just wire it into routes |

**No deprecated APIs in use for this phase.** All patterns are current Angular 19.

## Open Questions

1. **Dashboard saveLayout Bug Status**
   - What we know: The current `dashboard.store.ts` code (lines 200-232) uses the correct optimistic update pattern and does NOT patch state with the 204 response body.
   - What's unclear: Whether the audit finding reflects a since-fixed version of the code, or whether the bug manifests from a different cause than described.
   - Recommendation: Test in browser before implementing a fix. If the bug is already fixed, skip this task. If it still occurs, investigate whether `DashboardApiService.updateDashboard()` returning `Observable<DashboardDto>` (but emitting null from 204) causes downstream issues.

2. **Calendar Route Permission Guard**
   - What we know: Backend `CalendarController` uses `[Authorize(Policy = "Permission:Activity:View")]`. There is no "Calendar" entity type in the RBAC system.
   - What's unclear: Whether adding `permissionGuard('Activity', 'View')` to the calendar route is desirable or overly restrictive (user might have calendar but not activity list permission).
   - Recommendation: Add it for consistency since backend enforces it anyway. Users without Activity:View permission already get 403 from the API.

3. **Import Route Permission Guard**
   - What we know: Import is an admin/power-user feature. There is no "Import" entity type in the RBAC system.
   - What's unclear: Whether import should require admin role or a specific permission.
   - Recommendation: Out of scope for this phase. The audit only asked for CRM feature routes to have permissionGuard.

## Sources

### Primary (HIGH confidence)
- **Source code inspection (all files read directly):**
  - `globcrm-web/src/app/features/emails/email.service.ts` -- Gmail connect bug confirmed at line 81
  - `src/GlobCRM.Api/Controllers/EmailAccountsController.cs` -- Backend `[HttpGet("connect")]` confirmed at line 81
  - `globcrm-web/src/app/features/quotes/quote.models.ts` -- `Accepted: ['Draft']` confirmed at line 22
  - `src/GlobCRM.Api/Controllers/QuotesController.cs` -- Backend `Accepted: []` confirmed at line 713
  - `globcrm-web/src/app/features/dashboard/stores/dashboard.store.ts` -- saveLayout pattern reviewed (lines 200-232)
  - `src/GlobCRM.Api/Controllers/DashboardsController.cs` -- 204 No Content response confirmed
  - `globcrm-web/src/app/shared/components/navbar/navbar.component.ts` -- navGroups structure confirmed
  - `globcrm-web/src/app/app.routes.ts` -- All routes reviewed, no permissionGuard present
  - `globcrm-web/src/app/core/permissions/permission.guard.ts` -- Guard implementation reviewed
  - `globcrm-web/src/app/core/permissions/permission.store.ts` -- Store API reviewed
  - `src/GlobCRM.Domain/Enums/EntityType.cs` -- Entity types: Contact, Company, Deal, Activity, Quote, Request, Product, Note
  - 16 files importing ConfirmDeleteDialogComponent from role-list.component.ts -- all paths verified via grep

### Secondary (MEDIUM confidence)
- `.planning/v1.0-MILESTONE-AUDIT.md` -- Audit findings that drive this phase

## Metadata

**Confidence breakdown:**
- Task 1 (Gmail connect): HIGH -- one-line fix, both sides verified
- Task 2 (Quote transitions): HIGH -- one-line fix, both sides verified
- Task 3 (Dashboard saveLayout): MEDIUM -- current code appears already fixed; needs browser verification
- Task 4 (Navbar import): HIGH -- simple array addition, structure verified
- Task 5 (ConfirmDeleteDialog extraction): HIGH -- component definition and all 16+1 import paths verified
- Task 6 (Permission guards): HIGH -- guard factory exists, entity types match backend, route structure verified

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable -- all fixes against existing codebase, no external dependencies)
