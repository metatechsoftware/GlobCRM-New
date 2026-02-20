# Phase 26: Integration Fix -- Preview Sidebar + My Day Wiring - Research

**Researched:** 2026-02-20
**Domain:** Cross-phase integration wiring (Angular signals/stores, API call integration)
**Confidence:** HIGH

## Summary

Phase 26 is a gap closure phase that addresses two broken E2E flows and one tech debt item discovered during the v1.2 milestone audit. All three issues are well-scoped, small changes in existing files with no new libraries, no backend changes, and no architectural decisions needed.

The three fixes are: (1) `pushPreview()` in the preview sidebar store does not set `isOpen: true`, so entity links from closed-sidebar contexts (My Day widgets) load data but never show the sidebar; (2) `MyDayService.trackView()` exists but is never called, leaving the `recently_viewed_entities` database table permanently empty; (3) `GlobalSearchComponent` maintains a duplicate icon switch statement instead of using the centralized `EntityTypeRegistry`, causing Lead entities to show a generic 'search' icon instead of 'trending_up'.

**Primary recommendation:** Fix all three issues in a single plan. The `pushPreview()` fix is one line. The `trackView()` wiring requires a new root-level service (since `MyDayService` is component-scoped). The icon fix is a simple refactor to delete the switch statement and call `getEntityConfig()` instead. Additionally, `Quote` and `Request` should be added to `ENTITY_TYPE_REGISTRY` since the search API returns these entity types but the registry currently omits them.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MYDAY-08 | My Day shows a recent records widget (last 5-8 recently viewed entities) | Fix 1 (pushPreview isOpen) makes widget entity links open sidebar. Fix 2 (trackView wiring) populates the backend data that feeds this widget. |
| MYDAY-11 | My Day includes a feed preview widget (last 5 feed items, compact format) | Fix 1 (pushPreview isOpen) makes entity links within feed preview widget correctly open the preview sidebar. |
</phase_requirements>

## Standard Stack

### Core

No new libraries needed. This phase uses only existing project infrastructure:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @ngrx/signals | (already installed) | PreviewSidebarStore state management | Project standard for signal stores |
| @angular/core | 19 | Injectable services, dependency injection | Project framework |

### Supporting

No new supporting libraries needed.

### Alternatives Considered

N/A -- No decisions to make. All fixes use existing patterns.

## Architecture Patterns

### Pattern 1: pushPreview() isOpen Fix

**What:** Add `isOpen: true` to the `patchState` call inside `pushPreview()` in `preview-sidebar.store.ts`.

**When to use:** When a method needs to both push to the navigation stack AND ensure the sidebar is visible.

**Current code (line 90-96 of preview-sidebar.store.ts):**
```typescript
pushPreview(entry: PreviewEntry): void {
  let newStack = [...store.stack(), entry];
  if (newStack.length > MAX_STACK_DEPTH) {
    newStack = newStack.slice(newStack.length - MAX_STACK_DEPTH);
  }
  patchState(store, {
    stack: newStack,
    isLoading: true,
    error: null,
    currentData: null,
  });
  loadPreview(entry);
},
```

**Fix:** Add `isOpen: true` to the `patchState` call:
```typescript
patchState(store, {
  isOpen: true,  // <-- ADD THIS LINE
  stack: newStack,
  isLoading: true,
  error: null,
  currentData: null,
});
```

**Why this is safe:** When the sidebar is already open (drill-down within sidebar), `isOpen` is already `true`, so setting it again is a no-op. When the sidebar is closed (My Day widget context), this correctly opens it. This is idempotent.

**Impact analysis:** `pushPreview()` is called in exactly 2 places:
1. `PreviewEntityLinkComponent.onClick()` -- used in 4+ My Day widgets (tasks, feed, recent records, notifications) and inside preview sub-components (contact-preview company link). This is the primary caller that benefits from the fix.
2. `EntityPreviewSidebarComponent.onAssociationClick()` -- used for within-sidebar navigation where `isOpen` is already `true`. No behavior change.

### Pattern 2: trackView() Wiring via Root-Level Service

**What:** Create a root-level `RecentViewTrackingService` (or add a `trackView` method to the existing `EntityPreviewService`) that calls `POST /api/my-day/track-view`. Then invoke it from the `loadPreview` success handler in `preview-sidebar.store.ts`.

**Why a new service or addition to EntityPreviewService:** `MyDayService` is component-provided (`@Injectable()` without `providedIn: 'root'`), scoped only to the My Day page component. It cannot be injected from the root-level `PreviewSidebarStore`. Options:

| Approach | Pros | Cons | Recommended |
|----------|------|------|-------------|
| Add `trackView()` to `EntityPreviewService` | No new files; service is already injected in the store | Slightly violates SRP (preview service now also tracks views) | YES -- pragmatic |
| Create new `RecentViewTrackingService` | Clean SRP | New file for a 3-line method | Acceptable alternative |
| Make `MyDayService` root-level | Reuses existing method | Changes scope of unrelated methods (getMyDay, completeTask); leaks My Day implementation into root DI | NO |

**Recommended approach -- add to EntityPreviewService:**
```typescript
// In entity-preview.service.ts
trackView(entityType: string, entityId: string, entityName: string): Observable<void> {
  return this.api.post<void>('/api/my-day/track-view', { entityType, entityId, entityName });
}
```

**Then in preview-sidebar.store.ts `loadPreview` success handler:**
```typescript
next: (data) => {
  // ... existing state update logic ...

  // Track view for Recent Records widget (fire-and-forget)
  previewService.trackView(entry.entityType, entry.entityId, data.name || entry.entityName || '').subscribe();
},
```

**Key considerations:**
- Fire-and-forget: The `trackView()` call MUST NOT block or affect preview loading. Subscribe but ignore errors.
- This follows the existing pattern in the backend where feed/notification dispatches are wrapped in try/catch.
- The backend `TrackView` endpoint uses an upsert pattern (unique constraint on tenant+user+entityType+entityId), so duplicate calls are safe.
- The `loadPreview` success handler already has the loaded `data.name` available for the `entityName` parameter.

### Pattern 3: GlobalSearchComponent Icon Refactor

**What:** Replace the `getEntityIcon()` switch statement with a call to `getEntityConfig()` from `EntityTypeRegistry`.

**Current code (line 593-612 of global-search.component.ts):**
```typescript
getEntityIcon(type: string): string {
  switch (type) {
    case 'Company': return 'business';
    case 'Contact': return 'person';
    case 'Deal': return 'handshake';
    case 'Product': return 'inventory_2';
    case 'Activity': return 'task_alt';
    case 'Quote': return 'request_quote';
    case 'Request': return 'support_agent';
    default: return 'search';
  }
}
```

**Fix:**
```typescript
getEntityIcon(type: string): string {
  return getEntityConfig(type)?.icon ?? 'search';
}
```

**Pre-requisite:** The `EntityTypeRegistry` must include `Quote` and `Request` entries, otherwise those icons will regress to the fallback 'search'. The registry currently has 6 entries (Contact, Company, Deal, Lead, Activity, Product) but is missing Quote and Request which are returned by the search API.

**Required addition to entity-type-registry.ts:**
```typescript
Quote:    { icon: 'request_quote', label: 'Quote',   labelPlural: 'Quotes',   routePrefix: '/quotes',   color: 'var(--color-warning)' },
Request:  { icon: 'support_agent', label: 'Request', labelPlural: 'Requests', routePrefix: '/requests', color: 'var(--color-danger)' },
```

Icon and color values are verified from:
- `related-entity-tabs.component.ts`: Quote = 'request_quote', Request = 'support_agent'
- `navbar.component.ts`: Quote = 'request_quote', Request = 'support_agent'
- `webhook-edit.component.ts`: Quote color = 'var(--color-warning)', Request color = 'var(--color-danger)'

Adding these to the registry also benefits the 15+ other files that use the registry for icon/color lookups.

**Import change:** `global-search.component.ts` does NOT currently import from `entity-type-registry`. Need to add:
```typescript
import { getEntityConfig } from '../../services/entity-type-registry';
```

### Anti-Patterns to Avoid

- **Changing pushPreview to call open():** Don't replace `pushPreview` with `open`. They serve different purposes: `open` resets the stack (for first-time open), while `pushPreview` adds to the navigation stack (for drill-down). The fix is specifically to also set `isOpen: true` in `pushPreview`, preserving the stack behavior.
- **Making trackView synchronous or blocking:** The view tracking must be fire-and-forget. Never await it before showing preview data.
- **Calling trackView from PreviewEntityLinkComponent:** This would create a tight coupling. The tracking should happen in the store after successful data load, since the store is the centralized point for all preview opens (widget links, search results, feed links, association chips).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Entity icon/color lookup | Switch statements per component | `EntityTypeRegistry` | Single source of truth, already used in 15+ files |
| Duplicate API calls for view tracking | Custom deduplication logic | Backend upsert pattern | The backend `TrackView` endpoint already handles deduplication via unique index |

**Key insight:** The entity type registry already exists and is the canonical source. The GlobalSearchComponent switch statement is the only remaining consumer that doesn't use it.

## Common Pitfalls

### Pitfall 1: MyDayService Scope Mismatch

**What goes wrong:** Attempting to inject `MyDayService` (component-scoped) into `PreviewSidebarStore` (root-scoped) would fail at runtime with a "NullInjectorError: No provider for MyDayService" error.

**Why it happens:** `MyDayService` is decorated with `@Injectable()` (no `providedIn`) and only provided in `MyDayComponent.providers`. It's not available in the root injector.

**How to avoid:** Add the `trackView()` method to `EntityPreviewService` (already root-scoped and already injected in the store) rather than trying to use `MyDayService`.

**Warning signs:** If you see `inject(MyDayService)` in `preview-sidebar.store.ts`, it will fail.

### Pitfall 2: EntityTypeRegistry Missing Quote and Request

**What goes wrong:** Replacing the GlobalSearchComponent switch statement with `getEntityConfig()` without first adding Quote and Request to the registry would cause those entity types to fall back to the default icon ('search' or whatever fallback is used), regressing from the current correct icons.

**Why it happens:** The registry was created during Phase 22 for preview sidebar entities. Quote and Request don't have preview endpoints, so they were never added.

**How to avoid:** Add Quote and Request entries to `ENTITY_TYPE_REGISTRY` BEFORE refactoring `getEntityIcon()`. Verify icons match the existing switch statement values.

**Warning signs:** After the refactor, search for a Quote or Request -- if the icon shows 'search' instead of 'request_quote'/'support_agent', the entries are missing.

### Pitfall 3: trackView() Called Before Data Loads

**What goes wrong:** If `trackView()` is called in the `loadPreview` start (before HTTP response), the `entityName` might be empty or undefined, resulting in blank names in the Recent Records widget.

**Why it happens:** The `entityName` on `PreviewEntry` is optional (user may not pass it in all contexts, e.g., association chips).

**How to avoid:** Call `trackView()` in the `next` handler of `loadPreview`, after `data` is available. Use `data.name` (from the API response) as the authoritative entity name, with `entry.entityName` as fallback.

### Pitfall 4: Observable Not Subscribed (Fire-and-Forget Silently Fails)

**What goes wrong:** Calling `previewService.trackView(...)` without `.subscribe()` means the HTTP request is never sent (RxJS Observables are lazy).

**Why it happens:** Common mistake when transitioning between Promise-based and Observable-based patterns.

**How to avoid:** Always `.subscribe()` on fire-and-forget calls. The pattern: `previewService.trackView(...).subscribe()` (no handlers needed -- errors are silently ignored).

## Code Examples

### Fix 1: pushPreview isOpen (preview-sidebar.store.ts)

```typescript
// File: globcrm-web/src/app/shared/stores/preview-sidebar.store.ts
// Change in pushPreview method (around line 90)

pushPreview(entry: PreviewEntry): void {
  let newStack = [...store.stack(), entry];
  if (newStack.length > MAX_STACK_DEPTH) {
    newStack = newStack.slice(newStack.length - MAX_STACK_DEPTH);
  }
  patchState(store, {
    isOpen: true,  // FIX: ensure sidebar opens when called from closed context
    stack: newStack,
    isLoading: true,
    error: null,
    currentData: null,
  });
  loadPreview(entry);
},
```

### Fix 2: trackView Wiring (entity-preview.service.ts + preview-sidebar.store.ts)

```typescript
// File: globcrm-web/src/app/shared/services/entity-preview.service.ts
// Add new method:

trackView(entityType: string, entityId: string, entityName: string): Observable<void> {
  return this.api.post<void>('/api/my-day/track-view', { entityType, entityId, entityName });
}
```

```typescript
// File: globcrm-web/src/app/shared/stores/preview-sidebar.store.ts
// In loadPreview() success handler, after state update:

next: (data) => {
  // ... existing patchState logic ...

  // Track recently viewed entity (fire-and-forget, errors silently ignored)
  previewService.trackView(
    entry.entityType,
    entry.entityId,
    data.name || entry.entityName || ''
  ).subscribe();
},
```

### Fix 3: GlobalSearchComponent Icon Refactor

```typescript
// File: globcrm-web/src/app/shared/services/entity-type-registry.ts
// Add Quote and Request entries:

export const ENTITY_TYPE_REGISTRY: Record<string, EntityTypeConfig> = {
  Contact:  { icon: 'person',        label: 'Contact',  labelPlural: 'Contacts',   routePrefix: '/contacts',   color: 'var(--color-info)' },
  Company:  { icon: 'business',      label: 'Company',  labelPlural: 'Companies',  routePrefix: '/companies',  color: 'var(--color-secondary)' },
  Deal:     { icon: 'handshake',     label: 'Deal',     labelPlural: 'Deals',      routePrefix: '/deals',      color: 'var(--color-warning)' },
  Lead:     { icon: 'trending_up',   label: 'Lead',     labelPlural: 'Leads',      routePrefix: '/leads',      color: 'var(--color-success)' },
  Activity: { icon: 'task_alt',      label: 'Activity', labelPlural: 'Activities', routePrefix: '/activities', color: 'var(--color-accent)' },
  Product:  { icon: 'inventory_2',   label: 'Product',  labelPlural: 'Products',   routePrefix: '/products',   color: 'var(--color-primary)' },
  Quote:    { icon: 'request_quote', label: 'Quote',    labelPlural: 'Quotes',     routePrefix: '/quotes',     color: 'var(--color-warning)' },
  Request:  { icon: 'support_agent', label: 'Request',  labelPlural: 'Requests',   routePrefix: '/requests',   color: 'var(--color-danger)' },
};
```

```typescript
// File: globcrm-web/src/app/shared/components/global-search/global-search.component.ts
// Add import:
import { getEntityConfig } from '../../services/entity-type-registry';

// Replace getEntityIcon method (lines 593-612):
getEntityIcon(type: string): string {
  return getEntityConfig(type)?.icon ?? 'search';
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Duplicate icon maps per component | Centralized `EntityTypeRegistry` | Phase 22 (Feb 2026) | GlobalSearchComponent is the last holdout |

**Deprecated/outdated:**
- Per-component switch statements for entity icons: Should use `EntityTypeRegistry` instead. GlobalSearchComponent is the only remaining offender.

## Open Questions

1. **Should trackView also be called from `open()` method?**
   - What we know: Currently only `pushPreview` is used by `PreviewEntityLinkComponent`. The `open()` method is used by `GlobalSearchComponent` and `feed-list.component.ts` directly.
   - What's clear: ALL preview openings should track views, regardless of entry point.
   - Recommendation: Add the `trackView` call to the `loadPreview` private function (which is shared by `open`, `pushPreview`, `goBack`, `navigateTo`, and `refreshCurrent`). However, `goBack` and `navigateTo` revisit already-tracked entities (acceptable due to upsert), and `refreshCurrent` should NOT re-track (it's a silent data refresh). Best approach: add tracking in `loadPreview` but exclude calls from `refreshCurrent` (which calls `previewService.getPreview` directly, not `loadPreview`). This naturally gives us tracking for `open`, `pushPreview`, `goBack`, and `navigateTo` -- all correct behaviors.

2. **Should the `RecentPreviewsService` (localStorage-based) also be updated when `trackView` is called?**
   - What we know: `GlobalSearchComponent` uses `RecentPreviewsService` for its "Recently Viewed" dropdown. This is client-side only (localStorage). The backend `recently_viewed_entities` table is a separate system used by the My Day Recent Records widget.
   - Recommendation: These are two separate concerns. The localStorage cache serves the search UI; the backend table serves the dashboard widget. No need to merge them in this phase. They can coexist.

## Sources

### Primary (HIGH confidence)

All findings are based on direct codebase inspection:

- `globcrm-web/src/app/shared/stores/preview-sidebar.store.ts` -- Verified pushPreview() method lacks `isOpen: true` at line 90
- `globcrm-web/src/app/shared/components/entity-preview/preview-entity-link.component.ts` -- Verified calls `store.pushPreview()` not `store.open()` at line 74
- `globcrm-web/src/app/features/my-day/my-day.service.ts` -- Verified `trackView()` exists but is `@Injectable()` (not root), line 11
- `globcrm-web/src/app/shared/components/global-search/global-search.component.ts` -- Verified duplicate icon switch at line 593, missing Lead
- `globcrm-web/src/app/shared/services/entity-type-registry.ts` -- Verified missing Quote and Request entries
- `src/GlobCRM.Api/Controllers/MyDayController.cs` -- Verified `TrackView` endpoint with upsert pattern at line 293
- `src/GlobCRM.Infrastructure/Search/GlobalSearchService.cs` -- Verified search returns Quote and Request entity types
- `.planning/v1.2-MILESTONE-AUDIT.md` -- Source of all gap definitions

### Secondary (MEDIUM confidence)

- Icon/color values for Quote and Request cross-verified across 4 independent sources: navbar, related-entity-tabs, webhook-edit, report-builder (all consistently use 'request_quote' / 'support_agent')

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all changes in existing files using existing patterns
- Architecture: HIGH -- all three fixes are well-understood, code-verified, with clear before/after
- Pitfalls: HIGH -- scope mismatch and registry completeness are verified via codebase inspection

**Files to modify (complete list):**
1. `globcrm-web/src/app/shared/stores/preview-sidebar.store.ts` -- Add `isOpen: true` to pushPreview + add trackView call in loadPreview
2. `globcrm-web/src/app/shared/services/entity-preview.service.ts` -- Add `trackView()` method
3. `globcrm-web/src/app/shared/services/entity-type-registry.ts` -- Add Quote and Request entries
4. `globcrm-web/src/app/shared/components/global-search/global-search.component.ts` -- Replace getEntityIcon switch with getEntityConfig call + add import

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (30 days -- stable codebase, no external dependencies)
