---
phase: 22-shared-foundation-entity-preview-sidebar
verified: 2026-02-20T10:30:00Z
status: human_needed
score: 17/17 must-haves verified
re_verification:
  previous_status: human_needed
  previous_score: 14/14
  gaps_closed:
    - "Association chips show clear hover state (cursor pointer, elevated shadow, opacity change)"
    - "Preview sidebar starts below the 56px topbar — no content hidden behind fixed content-header"
    - "Stale Angular build cache cleared — avatar 404 no longer triggered by old compiled template"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Navigate to the Feed page. Click an entity name link in any feed item."
    expected: "Preview sidebar slides in from the right at 480px. Feed does NOT navigate away. Feed scroll position is preserved."
    why_human: "Visual behavior and scroll preservation cannot be verified programmatically. The stale cache that caused the avatar 404 during UAT was cleared in commit 455cbaa — this test confirms the fix is runtime-effective."
  - test: "Hover over association chips in the preview sidebar."
    expected: "Cursor changes to pointer. Chip background shifts to a slightly darker/highlighted color. A subtle shadow appears. The change is clearly visible and signals interactivity."
    why_human: "Material CSS custom property overrides verified in source, but visual effectiveness requires browser rendering to confirm."
  - test: "Open the preview sidebar. Observe the header area (entity type badge, open-full-record button, close X)."
    expected: "Sidebar header is fully visible below the topbar — no part of it is hidden behind the fixed navbar. The close button and entity name are interactable."
    why_human: "Layout correctness (margin-top: 56px fix) requires runtime verification."
  - test: "With the preview sidebar open, click an association chip for a different entity type."
    expected: "The new entity preview loads. A breadcrumb trail appears in the header showing the navigation path. Clicking an earlier breadcrumb returns to that entity's preview."
    why_human: "Breadcrumb navigation stack behavior requires runtime interaction."
  - test: "In the preview sidebar, click the Notes tab, then the Activities tab, then the Timeline tab."
    expected: "Each tab loads and shows data (or an empty-state message). The tab indicator moves. No errors are thrown."
    why_human: "Tab switching and data loading behavior requires runtime verification."
  - test: "Click 'Open full record' from the preview sidebar."
    expected: "Sidebar closes and browser navigates to the entity's full detail page (e.g. /contacts/{id})."
    why_human: "Navigation behavior requires runtime verification."
---

# Phase 22: Shared Foundation — Entity Preview Sidebar Verification Report

**Phase Goal:** Users can peek at any entity from the feed without losing context — clicking an entity name opens a slide-in preview with key details, associations, and recent activity.
**Verified:** 2026-02-20T10:30:00Z
**Status:** human_needed — all 17 automated must-haves VERIFIED; runtime/visual behavior requires human confirmation
**Re-verification:** Yes — after UAT gap closure (plan 22-05)

---

## Re-verification Context

Previous verification (2026-02-20) had `status: human_needed` with 14/14 automated must-haves passing and 6 human verification items. The UAT (22-UAT.md) then ran and identified 3 concrete issues:

1. Avatar 404 error on entity link click (stale Angular cache)
2. Association chips hover state invisible (Material internal DOM not targeted)
3. Preview sidebar header hidden behind the topbar

Plan 22-05 addressed all 3 issues in commits `455cbaa` and `9e0b878`. This re-verification confirms those fixes, checks for regressions, and accounts for enhancements made to the sidebar (tabs, breadcrumbs, entity link component).

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | EntityTypeRegistry provides icon, label, labelPlural, routePrefix, color for all 6 entity types | VERIFIED | Unchanged from previous verification — `ENTITY_TYPE_REGISTRY` with 6 types intact |
| 2 | RelatedEntityTabsComponent emits tab label strings, not numeric indices | VERIFIED | Unchanged — `tabChanged = output<string>()`, `onTabChange` emits `tab.label` |
| 3 | All 5 entity detail pages match on label strings, not index numbers | VERIFIED | Unchanged — all detail pages use `if (label === 'Activities')` pattern |
| 4 | FeedItem entity has EntityName string property persisted and in FeedItemDto | VERIFIED | Unchanged — `public string? EntityName` in `FeedItem.cs`, migration exists |
| 5 | CustomFieldDefinition has ShowInPreview boolean (default false) | VERIFIED | Unchanged — `public bool ShowInPreview { get; set; } = false;` present |
| 6 | All feed item creation points populate EntityName | VERIFIED | Unchanged — 16 population points across controllers, seeder, services |
| 7 | GET /api/entities/{type}/{id}/preview returns entity-appropriate fields for all 6 types | VERIFIED | Unchanged — `EntityPreviewController` with full per-type dispatch |
| 8 | Preview endpoint enforces RBAC scope checking | VERIFIED | Unchanged — `GetEffectivePermissionAsync` + `IsWithinScope` per type |
| 9 | Preview endpoint returns 404 with graceful message for missing entities | VERIFIED | Unchanged — all 6 handlers return `NotFound(new { error = "..." })` |
| 10 | Preview response includes association summaries (counts + first 3 named items) | VERIFIED | Unchanged — `Count()` + `Take(3)` pattern in all 6 per-type handlers |
| 11 | Preview response includes last 3 recent activities | VERIFIED | Unchanged — `GetRecentActivities` with `OrderByDescending().Take(3)` |
| 12 | Preview response includes pinned custom fields (ShowInPreview = true) | VERIFIED | Unchanged — `GetPinnedForPreviewAsync` called in all handlers |
| 13 | Deal and Lead previews include pipeline stage information | VERIFIED | Unchanged — `GetDealPipelineStage` / `GetLeadPipelineStage` both implemented |
| 14 | Clicking entity names in feed opens preview sidebar (not navigate) | VERIFIED | Unchanged — `onEntityClick` calls `previewStore.open()` in feed-list.component.ts |
| 15 | Association chips show clear hover state indicating they are clickable | VERIFIED | `association-chips.component.ts` lines 54-68: `--mdc-chip-hover-state-layer-opacity: 0.12`, `--mdc-chip-elevated-container-color` on `:hover`, `::ng-deep .mdc-evolution-chip__action--presentational { cursor: pointer !important; }` — commit `455cbaa` |
| 16 | Preview sidebar starts below the 56px topbar — header not hidden | VERIFIED | `app.component.ts` lines 57-62: `.app-sidenav-container.has-nav-sidebar { margin-left: 240px; height: calc(100vh - 56px); margin-top: 56px; }` — commit `9e0b878`. No `padding-top` on `.has-nav-sidebar` |
| 17 | Stale Angular build cache cleared — avatar 404 resolved | VERIFIED | Commit `455cbaa` message documents cache deletion. `entity-preview-sidebar.component.html` lines 34-38 use `@if (data.ownerAvatarUrl) ... @else { <mat-icon> }` guard — no unconditional asset reference. Current `.angular/cache/` is freshly generated (version 19.2.20) |

**Score:** 17/17 truths verified

---

## Required Artifacts

| Artifact | Status | Evidence |
|----------|--------|----------|
| `globcrm-web/src/app/shared/services/entity-type-registry.ts` | VERIFIED | Unchanged — 6 entity type entries with all required fields |
| `src/GlobCRM.Domain/Entities/FeedItem.cs` | VERIFIED | Unchanged — `EntityName` property present |
| `src/GlobCRM.Domain/Entities/CustomFieldDefinition.cs` | VERIFIED | Unchanged — `ShowInPreview` property present |
| `src/GlobCRM.Api/Controllers/EntityPreviewController.cs` | VERIFIED | Unchanged — all 6 entity handlers implemented |
| `globcrm-web/src/app/shared/stores/preview-sidebar.store.ts` | VERIFIED | Enhanced — adds `navigateTo(index)` method for breadcrumb navigation; all original methods (`open`, `pushPreview`, `goBack`, `close`, `openFullRecord`) still present; `providedIn: 'root'` confirmed |
| `globcrm-web/src/app/shared/services/entity-preview.service.ts` | VERIFIED | Unchanged |
| `globcrm-web/src/app/shared/models/entity-preview.models.ts` | VERIFIED | Unchanged — all 8 interfaces present |
| `globcrm-web/src/app/app.component.ts` | VERIFIED | **Fixed** — `.has-nav-sidebar` now has `margin-top: 56px` + `height: calc(100vh - 56px)`. Escape key handler, content click-to-close, `[opened]="previewStore.isOpen()"`, `<app-entity-preview-sidebar />` all intact |
| `globcrm-web/src/app/shared/components/entity-preview-sidebar/entity-preview-sidebar.component.ts` | VERIFIED | **Enhanced** — now imports and hosts `PreviewBreadcrumbsComponent`, `PreviewNotesTabComponent`, `PreviewActivitiesTabComponent`, `PreviewTimelineTabComponent`; all 6 entity preview components still imported; `@switch` on entityType intact |
| `globcrm-web/src/app/shared/components/entity-preview-sidebar/entity-preview-sidebar.component.html` | VERIFIED | **Enhanced** — tabs added (Notes, Activities, Timeline via mat-tab-group); `#overviewContent` template still renders all 6 entity type cases + associations + mini timeline + pinned custom fields |
| `globcrm-web/src/app/shared/components/entity-preview-sidebar/entity-preview-sidebar.component.scss` | VERIFIED | **Enhanced** — adds tab override styles (`.preview-tabs`, `.tab-label`, `.tab-content`); original styles intact |
| `globcrm-web/src/app/shared/components/entity-preview-sidebar/preview-skeleton.component.ts` | VERIFIED | Unchanged |
| `globcrm-web/src/app/shared/components/entity-preview-sidebar/preview-breadcrumbs.component.ts` | VERIFIED | New — substantive 135-line breadcrumb component; `stack` input, `navigate` output; handles collapsed display for > 4 items; wired to store via sidebar component's `onBreadcrumbNavigate()` |
| `globcrm-web/src/app/shared/components/entity-preview/contact-preview.component.ts` | VERIFIED | Unchanged |
| `globcrm-web/src/app/shared/components/entity-preview/company-preview.component.ts` | VERIFIED | Unchanged |
| `globcrm-web/src/app/shared/components/entity-preview/deal-preview.component.ts` | VERIFIED | Unchanged |
| `globcrm-web/src/app/shared/components/entity-preview/lead-preview.component.ts` | VERIFIED | Unchanged |
| `globcrm-web/src/app/shared/components/entity-preview/activity-preview.component.ts` | VERIFIED | Unchanged |
| `globcrm-web/src/app/shared/components/entity-preview/product-preview.component.ts` | VERIFIED | Unchanged |
| `globcrm-web/src/app/shared/components/entity-preview/mini-stage-bar.component.ts` | VERIFIED | Unchanged |
| `globcrm-web/src/app/shared/components/entity-preview/mini-timeline.component.ts` | VERIFIED | Unchanged |
| `globcrm-web/src/app/shared/components/entity-preview/association-chips.component.ts` | VERIFIED | **Fixed** — Material CSS custom property overrides present; `::ng-deep .mdc-evolution-chip__action--presentational { cursor: pointer !important }` present |
| `globcrm-web/src/app/shared/components/entity-preview/preview-notes-tab.component.ts` | VERIFIED | New — 139 lines; calls `noteService.getEntityNotes(entityType, entityId)` which hits real `/api/notes/entity/{type}/{id}` endpoint; loading/empty states present |
| `globcrm-web/src/app/shared/components/entity-preview/preview-activities-tab.component.ts` | VERIFIED | New — 159 lines; calls `activityService.getList({ linkedEntityType, linkedEntityId, pageSize: 10 })` — real API call; loading/empty states present |
| `globcrm-web/src/app/shared/components/entity-preview/preview-timeline-tab.component.ts` | VERIFIED | New — 45 lines; calls `/api/{plural}/{entityId}/timeline` via `ApiService`; uses existing `EntityTimelineComponent` |
| `globcrm-web/src/app/shared/components/entity-preview/preview-entity-link.component.ts` | VERIFIED | New — reusable inline entity link button; calls `store.pushPreview()` on click; substantive with icon, color, hover underline styles |
| `globcrm-web/src/app/features/feed/feed-list/feed-list.component.ts` | VERIFIED | Unchanged from previous — `previewStore.open()` on entity click, `getEntityConfig`/`getEntityRoute` imported and used |
| Migration `20260219230958_AddEntityNameAndShowInPreview.cs` | VERIFIED | Unchanged |
| `src/GlobCRM.Domain/Interfaces/ICustomFieldRepository.cs` | VERIFIED | Unchanged |
| `src/GlobCRM.Infrastructure/Persistence/Repositories/CustomFieldRepository.cs` | VERIFIED | Unchanged |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `preview-sidebar.store.ts` | `entity-preview.service.ts` | `previewService.getPreview()` in `loadPreview()` | WIRED | Line 47: `previewService.getPreview(entry.entityType, entry.entityId).subscribe(...)` |
| `app.component.ts` | `preview-sidebar.store.ts` | `[opened]="previewStore.isOpen()"` on mat-sidenav | WIRED | Line 38 confirmed |
| `entity-preview-sidebar.component.ts` | Per-entity preview components | `@switch (store.currentData()!.entityType)` in `#overviewContent` template | WIRED | All 6 `@case` blocks confirmed in HTML lines 111-116 |
| `entity-preview-sidebar.component.ts` | Tab components | `mat-tab-group` with `@switch (tab.key)` for notes/activities/timeline | WIRED | HTML lines 77-93: `@case ('notes')`, `@case ('activities')`, `@case ('timeline')` each render respective tab components |
| `entity-preview-sidebar.component.ts` | `preview-sidebar.store.ts` | `store.navigateTo(index)` called from `onBreadcrumbNavigate()` | WIRED | `.ts` line 108: `onBreadcrumbNavigate(index)` calls `this.store.navigateTo(index)` |
| `feed-list.component.ts` | `preview-sidebar.store.ts` | `onEntityClick` calls `previewStore.open()` | WIRED | Line 22: `PreviewSidebarStore` imported; `previewStore.open()` called on entity click |
| `feed-list.component.ts` | `entity-type-registry.ts` | `getEntityConfig` + `getEntityRoute` for tooltip/icon/navigation | WIRED | Both imported at line 23; used in `onEntityClick`, `getEntityIcon`, `getEntityTooltip` |
| `EntityPreviewController.cs` | `IPermissionService.GetEffectivePermissionAsync` | RBAC scope enforcement per entity type | WIRED | Unchanged from previous verification |
| `EntityPreviewController.cs` | Entity repositories (all 6) | Per-type dispatch via `type.ToLower() switch` | WIRED | Unchanged from previous verification |
| `association-chips.component.ts` | Material mat-chip internal DOM | CSS custom properties + ::ng-deep | WIRED | Lines 57-58: `--mdc-chip-elevated-container-color`, `--mdc-chip-hover-state-layer-opacity`; line 66: `::ng-deep .mdc-evolution-chip__action--presentational { cursor: pointer !important }` |
| `app.component.ts .has-nav-sidebar` | navbar content-header (fixed, 56px) | `margin-top: 56px` instead of `padding-top` | WIRED | Lines 59-60: `height: calc(100vh - 56px); margin-top: 56px;` — no `padding-top` on `.has-nav-sidebar` |
| `preview-notes-tab.component.ts` | `NoteService.getEntityNotes()` | Direct service injection + `ngOnInit` subscribe | WIRED | Line 123: `this.noteService.getEntityNotes(this.entityType(), this.entityId()).subscribe(...)` calls real API endpoint `/api/notes/entity/{type}/{id}` |
| `preview-activities-tab.component.ts` | `ActivityService.getList()` | Direct service injection + `ngOnInit` subscribe | WIRED | Line 144: `this.activityService.getList({ linkedEntityType, linkedEntityId, pageSize: 10 })` — real filter supported by service and backend |
| `preview-timeline-tab.component.ts` | `/api/{plural}/{id}/timeline` | `ApiService.get()` + `EntityTimelineComponent` | WIRED | Lines 34, 20: `this.api.get(...)` subscribed; result bound to `[entries]="entries()"` on `EntityTimelineComponent` |
| `related-entity-tabs.component.ts` | All detail pages `onTabChanged` | `tabChanged` output emitting string labels | WIRED | Unchanged from previous verification |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PREVIEW-01 | 22-04, 22-05 | Click entity names to open preview sidebar | SATISFIED | `onEntityClick` in feed-list calls `previewStore.open()`. Runtime test blocked by stale cache during UAT (resolved in 22-05 — commit 455cbaa). Ctrl/Cmd+click still navigates directly. |
| PREVIEW-02 | 22-03 | Sidebar slides in from right (~400px) without displacing content | SATISFIED (with note) | Implemented as push-content (`mode="side"`, 480px) per explicit user decision documented in 22-RESEARCH.md. REQUIREMENTS.md text says "overlay" but this was superseded. |
| PREVIEW-03 | 22-02 | Key properties visible for each entity type | SATISFIED | All 6 entity-type preview components render entity-appropriate fields. Tabs (Notes/Activities/Timeline) provide additional depth beyond this requirement. |
| PREVIEW-04 | 22-03 | "Open full record" navigates to entity detail page | SATISFIED | `store.openFullRecord()` calls `getEntityRoute()` then `router.navigate()` and closes sidebar. |
| PREVIEW-05 | 22-03, 22-05 | Close by clicking outside or pressing Escape | SATISFIED | `@HostListener('document:keydown.escape')` and `onContentClick()` both close the sidebar. Sidebar header now fully visible (topbar overlap fixed in 22-05). |
| PREVIEW-06 | 22-03 | Loading skeleton while data fetches | SATISFIED | `@if (store.isLoading())` shows `<app-preview-skeleton />` with pulse animation. |
| PREVIEW-07 | 22-04 | Feed scroll position preserved | SATISFIED (human verify) | `mat-sidenav-content` with `overflow: auto` preserves scroll on open/close by architecture. |
| PREVIEW-12 | 22-02, 22-05 | Association chips in preview | SATISFIED | `AssociationChipsComponent` present with named chips and count chips. Material hover state now properly overridden via CSS custom properties. |
| PREVIEW-13 | 22-02 | Last 3 recent activities in condensed timeline | SATISFIED | `GetRecentActivities` returns `Take(3)`; `MiniTimelineComponent` renders vertical timeline in overview tab. |

All 9 required requirement IDs (PREVIEW-01 through PREVIEW-07, PREVIEW-12, PREVIEW-13) are accounted for. No orphaned requirements from REQUIREMENTS.md map to phase 22 that are unaccounted for.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `preview-notes-tab.component.ts` | 120 | `signal<any[]>([])` | Info | Uses `any[]` type for notes signal. Not a stub — data is fetched and rendered. A typed interface would be cleaner but is not a blocker. |
| `preview-activities-tab.component.ts` | 141 | `signal<any[]>([])` | Info | Uses `any[]` type for activities signal. Same pattern as above. |

No blocker anti-patterns found. Both `any[]` usages reflect real data that is fetched and rendered; the tabs are substantive components, not stubs.

---

## Regression Check

All 14 previously-verified truths re-checked for regression. Findings:

- All 14 truths confirmed present and wired — no regressions.
- The sidebar component was enhanced (tabs added) but all original functionality is preserved.
- The `previewStore` was enhanced (`navigateTo` added) but all original methods are intact.
- The `app.component.ts` layout fix (`margin-top` replacing `padding-top`) has no effect on non-nav-sidebar routes (auth pages use `height: 100vh` base rule which is unchanged).

---

## Commit Verification

| Commit | Plan | Description | Verified |
|--------|------|-------------|---------|
| `34fbb3a` | 22-01 Task 1 | EntityTypeRegistry + tab index refactor | Yes |
| `a53bf1c` | 22-01 Task 2 | entity_name + ShowInPreview migrations | Yes |
| `fe244a6` | 22-02 Task 1 | EntityPreviewController | Yes |
| `2b1d44a` | 22-03 Task 1 | Preview models, service, store, AppComponent refactor | Yes |
| `1d80bc6` | 22-03 Task 2 | Sidebar shell + 6 entity preview templates | Yes |
| `ea47d83` | 22-04 Task 1 | Feed entity link preview integration | Yes |
| `455cbaa` | 22-05 Task 1 | Clear stale cache + association chip hover fixes | Yes — stat confirms `association-chips.component.ts` modified; commit message documents cache deletion |
| `9e0b878` | 22-05 Task 2 | Sidebar topbar overlap fix | Yes — stat confirms `app.component.ts` modified (+17/-3 lines) |

---

## Human Verification Required

### 1. Feed entity link opens preview sidebar (PREVIEW-01)

**Test:** Navigate to the Feed page. Find a feed item referencing an entity. Click the entity name.
**Expected:** Preview sidebar slides in from the right at 480px. Feed does NOT navigate away. No 404 errors in console.
**Why human:** The stale cache that caused the UAT avatar 404 was cleared in commit 455cbaa, but runtime verification is needed to confirm the fix is effective in the current dev environment.

### 2. Association chips hover state is visually effective (PREVIEW-12)

**Test:** Open the preview sidebar. Hover over any association chip in the "Related" section.
**Expected:** Cursor changes to pointer. Chip background shifts to a slightly highlighted color. A subtle box shadow appears. The effect is clearly visible and signals the chip is clickable.
**Why human:** CSS custom property overrides for Material components are confirmed in source, but visual effectiveness of `--mdc-chip-elevated-container-color` requires browser rendering to confirm.

### 3. Sidebar header fully visible below topbar (PREVIEW-05)

**Test:** Open the preview sidebar. Observe the header area (entity badge, "Open full record" button, X close button).
**Expected:** All header elements are fully visible and interactable. No part of the sidebar header is hidden behind the fixed navbar at the top of the screen.
**Why human:** The `margin-top: 56px` layout fix is confirmed in source, but visual correctness requires browser rendering to confirm.

### 4. Sidebar tabs function correctly

**Test:** Open a Contact or Deal preview. Click the "Notes" tab, then "Activities", then "Timeline".
**Expected:** Each tab loads content (or shows an appropriate empty state). No JavaScript errors. The previously-selected tab indicator moves correctly.
**Why human:** Tab functionality is new (not in original plan 22-01 to 22-04 scope) and has not been UAT-tested. Service calls are wired but need runtime confirmation.

### 5. Breadcrumb navigation after drilling through entities

**Test:** Open a Contact preview. Click a Company chip in the "Related" section. Observe the header.
**Expected:** Company preview loads. Breadcrumb trail shows "Contact Name > Company Name" (Contact is a clickable back link, Company Name is the current). Clicking the Contact breadcrumb returns to the Contact preview.
**Why human:** Breadcrumb navigation replaces the simple back button from the previous UAT and has not been runtime-tested.

### 6. "Open full record" and Escape/click-outside close (PREVIEW-04, PREVIEW-05)

**Test:** Click "Open full record" from any open preview. Separately, open a preview and press Escape. Separately, open a preview and click the main feed area.
**Expected:** "Open full record" navigates to the entity's full detail page. Escape closes the sidebar. Clicking the feed area closes the sidebar.
**Why human:** Navigation and interaction behaviors require runtime verification.

### 7. PREVIEW-02 design decision confirmation

**Test:** Observe the sidebar behavior when it opens.
**Expected:** The feed content compresses to the left (push-content, `mode="side"`) rather than the sidebar overlaying the feed. Confirm this push-content behavior is the accepted shipped design.
**Why human:** REQUIREMENTS.md text says "overlay" but 22-RESEARCH.md documents an explicit user override decision. The implementation is intentional, not a mistake — human must confirm the design decision stands.

---

## Notable Design Additions Beyond Original Scope

The sidebar was enhanced beyond the original phase 22 specification:

1. **Tabs** — Notes, Activities, and Timeline tabs added via `mat-tab-group`. Each tab makes real API calls. This exceeds PREVIEW-03 (key properties visible) significantly.
2. **Breadcrumb navigation** — Replaces simple back button with a full breadcrumb trail showing the entity navigation stack. Handles collapsed display for stacks deeper than 4.
3. **PreviewEntityLinkComponent** — Reusable inline entity link component that calls `pushPreview()` for use in future entity detail page integrations.

These additions are not regressions — they extend the feature positively. They have not been UAT-tested and are included in the human verification items above.

---

_Verified: 2026-02-20T10:30:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — after plan 22-05 UAT gap closure_
