---
phase: 22-shared-foundation-entity-preview-sidebar
plan: 03
subsystem: ui
tags: [angular, material-sidenav, signal-store, preview-sidebar, entity-preview, pipeline-stage-bar]

# Dependency graph
requires:
  - phase: 22-01
    provides: "EntityTypeRegistry constant map with icon/label/color/route for 6 entity types"
  - phase: 22-02
    provides: "GET /api/entities/{type}/{id}/preview polymorphic endpoint with EntityPreviewDto"
provides:
  - "EntityPreviewSidebarComponent shell with header, back/close/open-full-record, loading/error states"
  - "PreviewSidebarStore root-level signal store with navigation stack (open/push/goBack/close/openFullRecord)"
  - "EntityPreviewService calling backend preview endpoint"
  - "6 entity-type preview templates (Contact, Company, Deal, Lead, Activity, Product)"
  - "MiniStageBarComponent for deal/lead pipeline stage visualization"
  - "MiniTimelineComponent for recent activities display"
  - "AssociationChipsComponent for related entity chip rendering"
  - "AppComponent mat-sidenav-container layout with push-content mode at 480px"
affects: [22-04, phase-23]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Preview sidebar store: root-level signalStore with navigation stack, open/push/goBack/close pattern"
    - "mat-sidenav-container push-content layout: mode=side + position=end for right-side preview panel"
    - "Entity preview template pattern: standalone OnPush component with input<EntityPreviewDto>()"

key-files:
  created:
    - globcrm-web/src/app/shared/models/entity-preview.models.ts
    - globcrm-web/src/app/shared/services/entity-preview.service.ts
    - globcrm-web/src/app/shared/stores/preview-sidebar.store.ts
    - globcrm-web/src/app/shared/components/entity-preview-sidebar/entity-preview-sidebar.component.ts
    - globcrm-web/src/app/shared/components/entity-preview-sidebar/entity-preview-sidebar.component.html
    - globcrm-web/src/app/shared/components/entity-preview-sidebar/entity-preview-sidebar.component.scss
    - globcrm-web/src/app/shared/components/entity-preview-sidebar/preview-skeleton.component.ts
    - globcrm-web/src/app/shared/components/entity-preview/contact-preview.component.ts
    - globcrm-web/src/app/shared/components/entity-preview/company-preview.component.ts
    - globcrm-web/src/app/shared/components/entity-preview/deal-preview.component.ts
    - globcrm-web/src/app/shared/components/entity-preview/lead-preview.component.ts
    - globcrm-web/src/app/shared/components/entity-preview/activity-preview.component.ts
    - globcrm-web/src/app/shared/components/entity-preview/product-preview.component.ts
    - globcrm-web/src/app/shared/components/entity-preview/mini-stage-bar.component.ts
    - globcrm-web/src/app/shared/components/entity-preview/mini-timeline.component.ts
    - globcrm-web/src/app/shared/components/entity-preview/association-chips.component.ts
  modified:
    - globcrm-web/src/app/app.component.ts

key-decisions:
  - "AppComponent uses mat-sidenav-container with mode=side and position=end for push-content behavior at 480px width"
  - "Preview sidebar store uses navigation stack with max depth 10, cap-and-trim strategy"
  - "Entity preview components are fully standalone with input<EntityPreviewDto>(), no shared base class"
  - "Association chips with count > 3 show aggregate count chip instead of individual named chips"
  - "MiniTimelineComponent uses computed relative time strings rather than Angular DatePipe for concise display"

patterns-established:
  - "Preview sidebar store pattern: inject PreviewSidebarStore, call store.open({entityType, entityId}) to open"
  - "Entity preview template pattern: create standalone component with input<EntityPreviewDto>(), render entity-specific fields"
  - "Preview navigation: store.pushPreview() for drill-down, store.goBack() for back, store.close() for dismiss"

requirements-completed: [PREVIEW-02, PREVIEW-04, PREVIEW-05, PREVIEW-06]

# Metrics
duration: 5min
completed: 2026-02-20
---

# Phase 22 Plan 03: Frontend Preview Sidebar Summary

**Complete preview sidebar UI with mat-sidenav-container push layout, PreviewSidebarStore with navigation stack, 6 entity-type preview templates, mini stage bar, mini timeline, and association chips**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-19T23:23:40Z
- **Completed:** 2026-02-19T23:29:24Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments
- Created PreviewSidebarStore as root-level signal store with open/pushPreview/goBack/close/openFullRecord methods and navigation stack capped at 10
- Refactored AppComponent to use mat-sidenav-container with push-content mode, 480px preview drawer with 350ms ease animation
- Built 6 entity-type preview templates (Contact, Company, Deal, Lead, Activity, Product) each rendering entity-specific fields
- Created MiniStageBarComponent for deal/lead pipeline stage visualization with past/current/future coloring
- Created MiniTimelineComponent for recent activities with relative time display and activity type coloring
- Created AssociationChipsComponent with named chips (count <= 3) or aggregate count chips (count > 3)
- Added PreviewSkeletonComponent with pulse-animated loading placeholders
- Escape key and content area click close the sidebar

## Task Commits

Each task was committed atomically:

1. **Task 1: Preview models, service, store, and AppComponent layout refactor** - `2b1d44a` (feat)
2. **Task 2: Sidebar shell component and all 6 entity-type preview templates** - `1d80bc6` (feat)

## Files Created/Modified

### Created
- `globcrm-web/src/app/shared/models/entity-preview.models.ts` - TypeScript interfaces matching backend EntityPreviewDto and related types
- `globcrm-web/src/app/shared/services/entity-preview.service.ts` - API service calling /api/entities/{type}/{id}/preview
- `globcrm-web/src/app/shared/stores/preview-sidebar.store.ts` - Root-level signal store with navigation stack, loading, and error states
- `globcrm-web/src/app/shared/components/entity-preview-sidebar/entity-preview-sidebar.component.ts` - Sidebar shell with header, back/close/open-full-record
- `globcrm-web/src/app/shared/components/entity-preview-sidebar/entity-preview-sidebar.component.html` - Sidebar template with @switch on entity type
- `globcrm-web/src/app/shared/components/entity-preview-sidebar/entity-preview-sidebar.component.scss` - Sidebar styles with sticky header, error state, field rows
- `globcrm-web/src/app/shared/components/entity-preview-sidebar/preview-skeleton.component.ts` - Loading skeleton with CSS pulse animation
- `globcrm-web/src/app/shared/components/entity-preview/contact-preview.component.ts` - Email (mailto), Phone, Job Title, Company, City
- `globcrm-web/src/app/shared/components/entity-preview/company-preview.component.ts` - Industry, Phone, Website (external link), Size, City, Country
- `globcrm-web/src/app/shared/components/entity-preview/deal-preview.component.ts` - Value (currency), Probability (%), Expected Close, Company + mini stage bar
- `globcrm-web/src/app/shared/components/entity-preview/lead-preview.component.ts` - Email, Phone, Company, Temperature (colored badge), Source + mini stage bar
- `globcrm-web/src/app/shared/components/entity-preview/activity-preview.component.ts` - Type, Status, Priority (colored badge), Due Date
- `globcrm-web/src/app/shared/components/entity-preview/product-preview.component.ts` - Unit Price (currency), SKU, Category, Description (truncated)
- `globcrm-web/src/app/shared/components/entity-preview/mini-stage-bar.component.ts` - Horizontal stage segments with past/current/future coloring
- `globcrm-web/src/app/shared/components/entity-preview/mini-timeline.component.ts` - Vertical timeline with dots, activity subject, relative time
- `globcrm-web/src/app/shared/components/entity-preview/association-chips.component.ts` - Material chips with entity icons from EntityTypeRegistry

### Modified
- `globcrm-web/src/app/app.component.ts` - Wrapped in mat-sidenav-container with preview drawer, added escape key handler and content click-to-close

## Decisions Made
- AppComponent layout uses mat-sidenav-container with mode=side for true push-content behavior rather than overlay or custom CSS
- Preview drawer has disableClose and closing is handled manually via store.close() triggered by escape key, content click, or close button
- Entity preview components use standalone pattern with required input signals rather than a shared base class for simplicity
- Association chips switch between individual named chips (count <= 3) and aggregate count chip (count > 3) to avoid chip overflow
- MiniTimelineComponent implements custom relative time display (2h ago, 3d ago) instead of using Angular DatePipe for more concise output

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Angular @else if template syntax with 'as' expression**
- **Found during:** Task 2 (Sidebar shell component)
- **Issue:** Plan template used `@else if (store.error(); as error)` and `@else if (store.currentData(); as data)` but Angular's new control flow syntax does not allow `as` expressions on `@else if` blocks -- only primary `@if` blocks
- **Fix:** Changed to use `store.error()` and `store.currentData()!` directly in the template body instead of aliasing with `as`
- **Files modified:** entity-preview-sidebar.component.html
- **Verification:** Angular build succeeds
- **Committed in:** 1d80bc6 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary template syntax fix for Angular 19 compatibility. No scope creep.

## Issues Encountered
None beyond the template syntax deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Preview sidebar is ready for Plan 22-04's feed integration (calling `previewStore.open({entityType, entityId})` from feed items)
- All 6 entity types have dedicated preview templates matching the backend EntityPreviewDto shape
- Navigation stack enables drill-down through associations (clicking a related Contact chip opens Contact preview)
- Store is root-provided and can be injected from any component in the application

## Self-Check: PASSED

- entity-preview.models.ts: FOUND
- entity-preview.service.ts: FOUND
- preview-sidebar.store.ts: FOUND
- entity-preview-sidebar.component.ts: FOUND
- entity-preview-sidebar.component.html: FOUND
- entity-preview-sidebar.component.scss: FOUND
- preview-skeleton.component.ts: FOUND
- contact-preview.component.ts: FOUND
- company-preview.component.ts: FOUND
- deal-preview.component.ts: FOUND
- lead-preview.component.ts: FOUND
- activity-preview.component.ts: FOUND
- product-preview.component.ts: FOUND
- mini-stage-bar.component.ts: FOUND
- mini-timeline.component.ts: FOUND
- association-chips.component.ts: FOUND
- Commit 2b1d44a (Task 1): FOUND
- Commit 1d80bc6 (Task 2): FOUND

---
*Phase: 22-shared-foundation-entity-preview-sidebar*
*Completed: 2026-02-20*
