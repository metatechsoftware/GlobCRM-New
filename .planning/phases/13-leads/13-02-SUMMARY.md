---
phase: 13-leads
plan: 02
subsystem: api
tags: [rest-api, crud, kanban, timeline, lead-conversion, forward-only-stages, fluent-validation, permission-policies]

# Dependency graph
requires:
  - phase: 13-01
    provides: "Lead, LeadStage, LeadSource, LeadStageHistory, LeadConversion entities and ILeadRepository"
  - phase: 04-deals
    provides: "DealsController pattern, Deal/Pipeline/PipelineStage entities, DealContact join table"
  - phase: 03-contacts
    provides: "Contact entity, ContactsController pattern"
provides:
  - "LeadsController with 11 endpoints: full CRUD + stage transitions + kanban + timeline + conversion + duplicate check"
  - "LeadStagesController with 5 admin endpoints: CRUD + reorder"
  - "LeadSourcesController with 4 admin endpoints: CRUD with SET NULL on delete"
  - "Atomic lead conversion creating Contact + optional Company + optional Deal in single SaveChangesAsync"
  - "Forward-only stage enforcement with explicit reopen action for terminal stages"
  - "Kanban endpoint with DaysInStage computation from stage history"
  - "Duplicate detection for conversion: case-insensitive email + company name matching"
affects: [13-03, 13-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [lead-forward-only-stages, lead-conversion-atomic, lead-kanban-days-in-stage]

key-files:
  created:
    - src/GlobCRM.Api/Controllers/LeadsController.cs
    - src/GlobCRM.Api/Controllers/LeadStagesController.cs
    - src/GlobCRM.Api/Controllers/LeadSourcesController.cs
  modified: []

key-decisions:
  - "Used NotificationType.DealStageChanged for lead stage changes (no lead-specific type exists yet)"
  - "Conversion endpoint uses direct _db operations instead of repository for atomic single-SaveChangesAsync guarantee"
  - "LeadSourcesController deletes set LeadSourceId to null (not block) matching FK SET NULL behavior"
  - "Admin controllers use AdminUpdateLeadStageRequest to avoid naming conflict with LeadsController UpdateLeadStageRequest"

patterns-established:
  - "Lead forward-only stage pattern: PATCH /stage enforces SortOrder > current, POST /reopen for backward moves"
  - "Lead conversion pattern: atomic Contact + Company + Deal creation in single SaveChangesAsync with LeadConversion record"
  - "Lead Kanban pattern: DaysInStage computed from MAX(LeadStageHistory.ChangedAt) per lead"

requirements-completed: [LEAD-01, LEAD-03, LEAD-04, LEAD-06]

# Metrics
duration: 7min
completed: 2026-02-18
---

# Phase 13 Plan 02: Lead API Controllers Summary

**Complete REST API for leads with 20 endpoints across 3 controllers: full CRUD, forward-only stage transitions, atomic conversion to contact/company/deal, Kanban board data, and admin configuration for stages and sources**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-18T20:20:50Z
- **Completed:** 2026-02-18T20:28:16Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- LeadsController with 11 endpoints: GET list, GET detail, POST create, PUT update, DELETE, PATCH stage (forward-only), POST reopen, GET kanban, GET timeline, GET check-duplicates, POST convert
- Atomic lead conversion creating Contact + optional Company + optional Deal in a single SaveChangesAsync transaction with LeadConversion audit record
- Forward-only stage enforcement via SortOrder comparison with explicit reopen endpoint that clears conversion tracking
- Kanban endpoint computing DaysInStage from latest LeadStageHistory entry
- Timeline assembling events from lead creation, stage history, notes, activities (via ActivityLink), attachments, and conversion
- LeadStagesController (5 endpoints) and LeadSourcesController (4 endpoints) for admin configuration with referential integrity checks
- Duplicate detection returning case-insensitive email matches for contacts and name-contains matches for companies

## Task Commits

Each task was committed atomically:

1. **Task 1: Create LeadsController with CRUD, stage transitions, Kanban, and timeline** - `55ab816` (feat)
2. **Task 2: Add conversion endpoint, duplicate detection, and admin controllers** - `67ff39e` (feat)

## Files Created/Modified
- `src/GlobCRM.Api/Controllers/LeadsController.cs` - Full CRUD + stage change + reopen + kanban + timeline + check-duplicates + convert (11 endpoints), DTOs with FromEntity factories, FluentValidation validators
- `src/GlobCRM.Api/Controllers/LeadStagesController.cs` - Admin CRUD + reorder (5 endpoints) with referential integrity on delete
- `src/GlobCRM.Api/Controllers/LeadSourcesController.cs` - Admin CRUD (4 endpoints) with SET NULL on delete for referencing leads

## Decisions Made
- Reused NotificationType.DealStageChanged for lead stage change notifications since no lead-specific notification type exists yet -- avoids adding a migration for an enum change
- Conversion endpoint operates directly on ApplicationDbContext (not through repository) to guarantee a single atomic SaveChangesAsync across Contact, Company, Deal, DealContact, LeadConversion, and Lead updates
- LeadSourcesController DELETE sets referencing leads' LeadSourceId to null (matching the SET NULL FK behavior) rather than blocking deletion
- Renamed admin stage update request to AdminUpdateLeadStageRequest to avoid naming collision with LeadsController's UpdateLeadStageRequest (stage transition request)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Activity entity property references in timeline**
- **Found during:** Task 1 (timeline endpoint)
- **Issue:** Activity entity does not have EntityType/EntityId properties directly -- activities link to entities via the ActivityLink join table
- **Fix:** Changed timeline query to use _db.ActivityLinks with Include for Activity navigation
- **Files modified:** src/GlobCRM.Api/Controllers/LeadsController.cs
- **Verification:** Build succeeds
- **Committed in:** 55ab816 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed Attachment.CreatedAt to Attachment.UploadedAt**
- **Found during:** Task 1 (timeline endpoint)
- **Issue:** Attachment entity uses UploadedAt, not CreatedAt
- **Fix:** Changed attachment timestamp reference to UploadedAt
- **Files modified:** src/GlobCRM.Api/Controllers/LeadsController.cs
- **Verification:** Build succeeds
- **Committed in:** 55ab816 (Task 1 commit)

**3. [Rule 1 - Bug] Fixed DTO naming conflict between controllers**
- **Found during:** Task 2 (LeadStagesController creation)
- **Issue:** UpdateLeadStageRequest defined in both LeadsController (stage transition) and LeadStagesController (admin update), causing CS0101 error
- **Fix:** Renamed admin version to AdminUpdateLeadStageRequest and validator to AdminUpdateLeadStageRequestValidator
- **Files modified:** src/GlobCRM.Api/Controllers/LeadStagesController.cs
- **Verification:** Build succeeds with 0 errors
- **Committed in:** 67ff39e (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All auto-fixes necessary for correct compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Complete backend API for lead management, ready for Plan 03 (Angular frontend: list, detail, form pages)
- All 20 endpoints available for frontend service layer to consume
- Kanban endpoint provides data structure for Plan 04 (Kanban board + conversion UI)
- Conversion endpoint ready for Plan 04's conversion dialog/wizard UI
- Admin stage/source endpoints ready for Plan 03's settings pages

## Self-Check: PASSED

All 3 created files verified. All 2 task commits verified (55ab816, 67ff39e).

---
*Phase: 13-leads*
*Completed: 2026-02-18*
