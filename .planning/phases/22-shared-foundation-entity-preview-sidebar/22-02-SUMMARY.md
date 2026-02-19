---
phase: 22-shared-foundation-entity-preview-sidebar
plan: 02
subsystem: api
tags: [dotnet, entity-framework, rbac, preview, polymorphic-endpoint, custom-fields]

# Dependency graph
requires:
  - phase: 22-01
    provides: "ShowInPreview flag on custom_field_definitions, EntityTypeRegistry"
provides:
  - "GET /api/entities/{type}/{id}/preview polymorphic endpoint for all 6 entity types"
  - "EntityPreviewDto with per-type fields, associations, pipeline stages, pinned custom fields, recent activities"
  - "GetPinnedForPreviewAsync on ICustomFieldRepository/CustomFieldRepository"
affects: [22-03, 22-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Polymorphic preview endpoint: single route dispatches to per-type handlers with RBAC scope checking"
    - "Association chip pattern: Count + Take(3) named items for related entity summaries"
    - "Pipeline stage preview pattern: all stages + current position for mini progress bar rendering"

key-files:
  created:
    - src/GlobCRM.Api/Controllers/EntityPreviewController.cs
  modified:
    - src/GlobCRM.Domain/Interfaces/ICustomFieldRepository.cs
    - src/GlobCRM.Infrastructure/Persistence/Repositories/CustomFieldRepository.cs

key-decisions:
  - "No blanket [Authorize(Policy)] on preview endpoint; per-type RBAC checks done internally so cross-entity access works (e.g., Deal:View user can preview deals without Contact:View)"
  - "Activity scope check uses both OwnerId and AssignedToId matching the ActivitiesController pattern"
  - "Product preview skips RBAC scope (products are shared tenant resources per existing convention)"
  - "Association queries use ActivityLinks for entity-activity relationships (polymorphic join table)"
  - "Lead pipeline uses 'Lead Pipeline' as the pipeline name since leads use flat LeadStages (not Pipeline entity)"

patterns-established:
  - "Preview endpoint pattern: /api/entities/{type}/{id}/preview with per-type switch dispatch"
  - "Association chips: Count + Take(3) with name projection for each related entity type"
  - "Pipeline stage preview: AllStages list with CurrentStageId/CurrentSortOrder for progress bar"

requirements-completed: [PREVIEW-03, PREVIEW-06, PREVIEW-12, PREVIEW-13]

# Metrics
duration: 3min
completed: 2026-02-20
---

# Phase 22 Plan 02: Preview Backend Endpoint Summary

**Polymorphic GET /api/entities/{type}/{id}/preview endpoint with per-type RBAC scope checking, association summaries, pipeline stage info, pinned custom fields, and recent activities for all 6 entity types**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-19T23:18:20Z
- **Completed:** 2026-02-19T23:21:30Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Created single polymorphic preview endpoint serving Contact, Company, Deal, Lead, Activity, and Product types
- Implemented per-type RBAC scope checking (including Activity's dual Owner/AssignedTo pattern and Product's no-scope pattern)
- Built association summaries with Count + first 3 named items for each entity type's relationships
- Added pipeline stage info (all stages + current position) for Deal and Lead previews
- Integrated pinned custom fields (ShowInPreview=true) with JSONB value extraction
- Added last 3 recent activities via ActivityLinks for entities that track activities
- Returns graceful 404 with user-friendly messages and 403 for unauthorized access

## Task Commits

Each task was committed atomically:

1. **Task 1: EntityPreviewController with RBAC, per-type DTOs, associations, and recent activities** - `fe244a6` (feat)

## Files Created/Modified

### Created
- `src/GlobCRM.Api/Controllers/EntityPreviewController.cs` - Single preview endpoint with per-type dispatch, RBAC, association queries, pipeline stage info, pinned custom fields, and co-located DTOs (EntityPreviewDto, AssociationChipDto, PipelineStagePreviewDto, StageInfoDto, RecentActivityDto, CustomFieldPreviewDto)

### Modified
- `src/GlobCRM.Domain/Interfaces/ICustomFieldRepository.cs` - Added GetPinnedForPreviewAsync(string entityType) method
- `src/GlobCRM.Infrastructure/Persistence/Repositories/CustomFieldRepository.cs` - Implemented GetPinnedForPreviewAsync with ShowInPreview filter and SortOrder ordering

## Decisions Made
- No blanket `[Authorize(Policy)]` on the preview endpoint; each per-type handler calls `GetEffectivePermissionAsync` with the correct entity type string, ensuring cross-entity permission isolation (a user with Deal:View but not Contact:View can still preview deals)
- Activity scope check replicates the dual OwnerId/AssignedToId pattern from ActivitiesController
- Product preview skips RBAC scope check entirely since products are shared tenant resources (matching ProductsController convention)
- Association queries use ActivityLinks (polymorphic join table) for entity-to-activity relationships across all entity types
- Lead pipeline stage uses "Lead Pipeline" as the pipeline name since leads use flat LeadStages rather than the Pipeline entity used by deals

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Preview endpoint is ready for the frontend preview sidebar component (22-03)
- All 6 entity types return consistent EntityPreviewDto shape for frontend rendering
- Pipeline stage data includes AllStages array for mini progress bar visualization
- Association chips provide Count + named items for relationship display
- Pinned custom fields are included based on ShowInPreview flag from 22-01

## Self-Check: PASSED

- EntityPreviewController.cs: FOUND
- Commit fe244a6 (Task 1): FOUND

---
*Phase: 22-shared-foundation-entity-preview-sidebar*
*Completed: 2026-02-20*
