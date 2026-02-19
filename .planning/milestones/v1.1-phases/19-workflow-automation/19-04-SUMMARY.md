---
phase: 19-workflow-automation
plan: 04
subsystem: ui
tags: [angular, workflow, card-grid, svg-thumbnail, signal-store, lazy-routes]

# Dependency graph
requires:
  - phase: 19-workflow-automation
    plan: 03
    provides: "WorkflowsController with 12 CRUD endpoints, WorkflowTemplatesController with 5 template endpoints"
provides:
  - "TypeScript interfaces for all workflow entities (definition, nodes, connections, triggers, conditions, actions, logs, templates)"
  - "WorkflowService with 17 API methods mapping to WorkflowsController and WorkflowTemplatesController"
  - "WorkflowStore (NgRx Signal Store) with optimistic status toggle and full state management"
  - "Lazy-loaded workflow routes with placeholder components for builder/detail/logs pages"
  - "WorkflowListComponent with card grid layout and entity type/status filters"
  - "WorkflowCardComponent with miniaturized SVG flow diagram thumbnails"
  - "Sidebar navigation link with account_tree icon in Connect group"
affects: [19-05, 19-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SVG schematic thumbnail: trigger/condition/action nodes with bezier curves within 280x100 viewBox"
    - "Optimistic toggle: patchState immediately on status toggle, revert on API error"
    - "Placeholder components for future plan routes to enable lazy-load compilation"

key-files:
  created:
    - globcrm-web/src/app/features/workflows/workflow.models.ts
    - globcrm-web/src/app/features/workflows/workflow.service.ts
    - globcrm-web/src/app/features/workflows/workflow.store.ts
    - globcrm-web/src/app/features/workflows/workflows.routes.ts
    - globcrm-web/src/app/features/workflows/workflow-list/workflow-list.component.ts
    - globcrm-web/src/app/features/workflows/workflow-list/workflow-list.component.html
    - globcrm-web/src/app/features/workflows/workflow-list/workflow-list.component.scss
    - globcrm-web/src/app/features/workflows/workflow-list/workflow-card.component.ts
    - globcrm-web/src/app/features/workflows/workflow-builder/workflow-builder.component.ts
    - globcrm-web/src/app/features/workflows/workflow-detail/workflow-detail.component.ts
    - globcrm-web/src/app/features/workflows/workflow-logs/workflow-logs.component.ts
    - globcrm-web/src/app/features/workflows/workflow-log-detail/workflow-log-detail.component.ts
  modified:
    - globcrm-web/src/app/app.routes.ts
    - globcrm-web/src/app/shared/components/navbar/navbar.component.ts

key-decisions:
  - "SVG thumbnail approach 2 (schematic) used -- no backend change needed, renders from triggerSummary.length and nodeCount"
  - "Placeholder components created for builder/detail/logs pages to enable compile-time lazy-load resolution"
  - "Optimistic status toggle with revert-on-error pattern for responsive UX"
  - "WorkflowStore component-provided (not root) following WebhookStore and SequenceStore patterns"

patterns-established:
  - "Card grid with SVG flow diagrams: repeatable pattern for visual workflow/flow list pages"
  - "Schematic SVG node layout: left triggers, center conditions, right actions with bezier connections"

requirements-completed: [WFLOW-12]

# Metrics
duration: 6min
completed: 2026-02-19
---

# Phase 19 Plan 04: Workflow Frontend Service Layer & List Page Summary

**Workflow card grid list page with SVG flow diagram thumbnails, enable/disable toggle, entity type/status filters, NgRx Signal Store with 17-method API service, and lazy-loaded routes**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-19T14:49:20Z
- **Completed:** 2026-02-19T14:55:36Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- TypeScript models for all workflow entities (WorkflowDefinition, nodes, connections, triggers, conditions, actions, execution logs, templates, request types, paginated response)
- WorkflowService with 17 API methods covering workflow CRUD, status toggle, activate/deactivate, duplicate, execution logs, entity fields, and template management
- WorkflowStore with optimistic status toggle (immediate UI update, revert on API error) and full state management for workflows, logs, and templates
- WorkflowListComponent with CSS Grid responsive card layout (1 column mobile, 2 medium, 3 large) with entity type and status filter dropdowns
- WorkflowCardComponent with miniaturized SVG flow diagram thumbnails using schematic approach (trigger nodes left/blue, condition center/amber, action right/green, connected by bezier curves)
- Enable/disable toggle per card via mat-slide-toggle per WFLOW-12 requirement
- Skeleton loading state with pulsing placeholder cards, empty state with create CTA
- Sidebar navigation: Workflows link with account_tree icon added to Connect group after Sequences

## Task Commits

Each task was committed atomically:

1. **Task 1: TypeScript models, API service, signal store, and routes** - `83e1476` (feat)
2. **Task 2: Workflow list page with card grid layout and flow diagram thumbnails** - `e6f3c78` (feat)

## Files Created/Modified
- `globcrm-web/src/app/features/workflows/workflow.models.ts` - TypeScript interfaces for all workflow entities
- `globcrm-web/src/app/features/workflows/workflow.service.ts` - API service with 17 methods for workflows and templates
- `globcrm-web/src/app/features/workflows/workflow.store.ts` - NgRx Signal Store with optimistic status toggle
- `globcrm-web/src/app/features/workflows/workflows.routes.ts` - Lazy-loaded routes for all workflow pages
- `globcrm-web/src/app/features/workflows/workflow-list/workflow-list.component.ts` - Card grid list page with filters
- `globcrm-web/src/app/features/workflows/workflow-list/workflow-list.component.html` - List page template
- `globcrm-web/src/app/features/workflows/workflow-list/workflow-list.component.scss` - Responsive grid and skeleton styles
- `globcrm-web/src/app/features/workflows/workflow-list/workflow-card.component.ts` - Individual card with SVG thumbnail
- `globcrm-web/src/app/features/workflows/workflow-builder/workflow-builder.component.ts` - Placeholder for 19-05
- `globcrm-web/src/app/features/workflows/workflow-detail/workflow-detail.component.ts` - Placeholder for 19-06
- `globcrm-web/src/app/features/workflows/workflow-logs/workflow-logs.component.ts` - Placeholder for 19-06
- `globcrm-web/src/app/features/workflows/workflow-log-detail/workflow-log-detail.component.ts` - Placeholder for 19-06
- `globcrm-web/src/app/app.routes.ts` - Added workflows route with Workflow:View permission guard
- `globcrm-web/src/app/shared/components/navbar/navbar.component.ts` - Added Workflows link to Connect group

## Decisions Made
- **SVG thumbnail approach 2 (schematic):** Renders flow diagram from triggerSummary.length and nodeCount without needing the full definition. Trigger nodes positioned left (blue), optional condition node center (amber), action nodes right (green), connected by bezier curves within a 280x100 viewBox. No backend changes required.
- **Placeholder components:** Angular's compiler resolves lazy-loaded component paths at compile time, requiring placeholder files for builder/detail/logs pages not yet created. Plans 19-05 and 19-06 will replace these with full implementations.
- **Optimistic status toggle:** The store immediately patches workflow isActive/status in local state, then sends the PATCH request. On API error, it reverts to the previous state. This provides responsive UX without waiting for the API round-trip.
- **WorkflowStore component-provided:** Following the established pattern from WebhookStore (17-04) and SequenceStore (18-04), the WorkflowStore is not providedIn: 'root'. Each page gets its own fresh instance via component providers array.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created placeholder components for not-yet-created route targets**
- **Found during:** Task 1 (build verification)
- **Issue:** Angular compiler requires lazy-loaded component files to exist at build time. Routes for workflow-builder (19-05), workflow-detail (19-06), workflow-logs (19-06), and workflow-log-detail (19-06) referenced files that don't exist yet.
- **Fix:** Created minimal placeholder components for all four route targets (workflow-builder, workflow-detail, workflow-logs, workflow-log-detail) with basic template stubs
- **Files created:** workflow-builder/workflow-builder.component.ts, workflow-detail/workflow-detail.component.ts, workflow-logs/workflow-logs.component.ts, workflow-log-detail/workflow-log-detail.component.ts
- **Verification:** Build passes with 0 errors
- **Committed in:** 83e1476 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to unblock build compilation. Placeholder files will be replaced by 19-05 and 19-06 with full implementations. No scope creep.

## Issues Encountered
None beyond the placeholder component deviation described above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Workflow list page fully functional with card grid, filters, and SVG thumbnails
- WorkflowService and WorkflowStore ready for consumption by builder (19-05) and detail/logs (19-06) components
- Placeholder route targets in place for seamless replacement by subsequent plans
- Navigation integrated -- users can access /workflows from the sidebar

## Self-Check: PASSED

All created files verified present. Both task commits (83e1476, e6f3c78) verified in git log.

---
*Phase: 19-workflow-automation*
*Completed: 2026-02-19*
