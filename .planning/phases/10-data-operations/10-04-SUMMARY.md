---
phase: 10-data-operations
plan: 04
subsystem: ui
tags: [angular, import-wizard, mat-stepper, signalr, csv-import, signal-store, drag-drop]

# Dependency graph
requires:
  - phase: 10-data-operations
    provides: ImportsController backend with upload/mapping/preview/execute/status endpoints, SignalR ImportProgress events
  - phase: 02-core-infrastructure
    provides: CustomFieldService for loading custom field definitions, SignalRService for real-time events
  - phase: 09-dashboards-and-reporting
    provides: DashboardStore pattern for component-provided signal stores
provides:
  - Import TypeScript models (ImportJob, UploadResponse, PreviewResponse, ImportProgress, entity field defs)
  - ImportService with 6 API methods for import wizard
  - ImportStore signal store with wizard state management
  - 4-step import wizard (Upload, Mapping, Preview, Progress) with SignalR real-time progress
affects: [10-05-global-search-frontend, 10-06-import-history]

# Tech tracking
tech-stack:
  added: []
  patterns: [MatStepper linear wizard flow, SignalR event filtering by job ID, auto-match CSV headers to entity fields]

key-files:
  created:
    - globcrm-web/src/app/features/import/import.models.ts
    - globcrm-web/src/app/features/import/import.service.ts
    - globcrm-web/src/app/features/import/stores/import.store.ts
    - globcrm-web/src/app/features/import/import-wizard/import-wizard.component.ts
    - globcrm-web/src/app/features/import/import-wizard/step-upload.component.ts
    - globcrm-web/src/app/features/import/import-wizard/step-mapping.component.ts
    - globcrm-web/src/app/features/import/import-wizard/step-preview.component.ts
    - globcrm-web/src/app/features/import/import-wizard/step-progress.component.ts
    - globcrm-web/src/app/features/import/import.routes.ts
  modified:
    - globcrm-web/src/app/core/signalr/signalr.service.ts
    - globcrm-web/src/app/app.routes.ts

key-decisions:
  - "ImportStore tracks entityType in state for mapping step context (not just upload response)"
  - "SignalR ImportProgress event added to SignalRService with Subject/Observable pattern matching existing events"
  - "StepMapping auto-match normalizes header names (lowercase, strip underscores/spaces) for case-insensitive comparison"
  - "Custom fields prefixed with 'custom:' in mapping dropdown to distinguish from core fields"

patterns-established:
  - "Import wizard pattern: MatStepper linear flow with component-provided SignalStore and SignalR event subscription"
  - "CSV column auto-match: case-insensitive, space/underscore-normalized name comparison against field keys and labels"

# Metrics
duration: 6min
completed: 2026-02-17
---

# Phase 10 Plan 04: Frontend Import Wizard Summary

**4-step MatStepper import wizard with CSV upload, column-to-field auto-mapping, validation preview, and real-time SignalR progress tracking**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-17T19:22:15Z
- **Completed:** 2026-02-17T19:28:55Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- TypeScript models for all import DTOs: ImportJob, UploadResponse, PreviewResponse, ImportProgress, entity field definitions (Company/Contact/Deal core fields)
- ImportService with 6 API methods: upload (FormData), saveMapping, preview, execute, getJob, getJobs
- ImportStore signal store with wizard state management: entityType tracking, step navigation, upload/mapping/preview/execute/progress/reset
- 4-step import wizard using MatStepper linear mode with component-provided store
- Step 1 (Upload): entity type selection + drag-and-drop CSV upload with file info display
- Step 2 (Mapping): CSV column-to-field mapping with auto-match, core + custom field support, duplicate strategy selection (skip/overwrite/merge), sample data preview
- Step 3 (Preview): validation summary cards (valid/invalid/duplicate) with expandable error and duplicate detail tables
- Step 4 (Progress): real-time progress bar via SignalR with completion banner and error list
- SignalR ImportProgress event handler added to SignalRService
- Import route added to app routes at /import

## Task Commits

Each task was committed atomically:

1. **Task 1: Create import models, API service, and signal store** - `fa96993` (feat)
2. **Task 2: Create import wizard component with 4-step stepper** - `a8f6ff5` (feat)

## Files Created/Modified
- `globcrm-web/src/app/features/import/import.models.ts` - TypeScript interfaces for all import DTOs and entity field definitions
- `globcrm-web/src/app/features/import/import.service.ts` - API service with FormData upload and JSON endpoints
- `globcrm-web/src/app/features/import/stores/import.store.ts` - Signal store with wizard state, entityType, step tracking
- `globcrm-web/src/app/features/import/import-wizard/import-wizard.component.ts` - MatStepper orchestrator with SignalR subscription
- `globcrm-web/src/app/features/import/import-wizard/step-upload.component.ts` - Entity type + CSV drag-and-drop upload
- `globcrm-web/src/app/features/import/import-wizard/step-mapping.component.ts` - Column mapping with auto-match and custom fields
- `globcrm-web/src/app/features/import/import-wizard/step-preview.component.ts` - Validation summary with expandable details
- `globcrm-web/src/app/features/import/import-wizard/step-progress.component.ts` - Real-time progress bar with completion summary
- `globcrm-web/src/app/features/import/import.routes.ts` - Lazy-loaded import route
- `globcrm-web/src/app/core/signalr/signalr.service.ts` - Added ImportProgress event handler
- `globcrm-web/src/app/app.routes.ts` - Added /import route

## Decisions Made
- **entityType in store state:** Added entityType to ImportStore state (not just UploadResponse) so the mapping step can load correct core fields and custom fields for the selected entity type
- **SignalR event pattern:** Added ImportProgress handler to SignalRService following existing Subject/Observable pattern (FeedUpdate, FeedCommentAdded, ReceiveNotification)
- **Auto-match normalization:** CSV header matching normalizes by lowercasing and stripping underscores/spaces, comparing against both field key and label for maximum match rate
- **Custom field prefix:** Custom fields use `custom:` prefix in mapping dropdown value to cleanly distinguish from core fields; stripped before sending to API

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added ImportProgress event to SignalRService**
- **Found during:** Task 2 (StepProgressComponent needs SignalR subscription)
- **Issue:** SignalRService had no ImportProgress event handler; StepProgressComponent requires it for real-time progress
- **Fix:** Added importProgressSubject, importProgress$ observable, and ImportProgress hub event handler
- **Files modified:** globcrm-web/src/app/core/signalr/signalr.service.ts
- **Verification:** `ng build --configuration development` succeeds
- **Committed in:** a8f6ff5 (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added entityType to ImportStore state**
- **Found during:** Task 2 (StepMappingComponent needs entity type for correct field definitions)
- **Issue:** Store had no entityType field; mapping step couldn't determine which core fields to display
- **Fix:** Added entityType to ImportState, set during upload, read by mapping step
- **Files modified:** globcrm-web/src/app/features/import/stores/import.store.ts
- **Verification:** `ng build --configuration development` succeeds
- **Committed in:** a8f6ff5 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both auto-fixes necessary for correct wizard functionality. No scope creep.

## Issues Encountered
None -- both tasks executed cleanly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Frontend import wizard complete, connects to backend import API (10-02)
- Ready for global search frontend (10-05) and import history page (10-06) as needed
- All 4 wizard steps functional: upload CSV -> map columns -> preview validation -> execute with real-time progress

## Self-Check: PASSED

- All 10 created files verified on disk
- Both task commits (fa96993, a8f6ff5) verified in git log
- `ng build --configuration development` passes with no TypeScript errors

---
*Phase: 10-data-operations*
*Completed: 2026-02-17*
