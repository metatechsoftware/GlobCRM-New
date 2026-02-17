---
phase: 05-activities-and-workflow
plan: 04
subsystem: api
tags: [rest-api, controller, sub-resources, comments, attachments, file-upload, time-tracking, entity-linking, followers, authorization]

# Dependency graph
requires:
  - phase: 05-activities-and-workflow
    plan: 03
    provides: "ActivitiesController with 9 endpoints, DTOs, request models, and ownership scope helpers"
  - phase: 02-core-infrastructure
    plan: 03
    provides: "IFileStorageService with SaveFileAsync/GetFileAsync/DeleteFileAsync for tenant-partitioned storage"
provides:
  - "12 new sub-resource endpoints on ActivitiesController: 3 comments, 3 attachments, 2 time entries, 2 entity links, 2 followers"
  - "Total ActivitiesController endpoints: 21 (9 CRUD/workflow + 12 sub-resources)"
  - "Attachment upload with 25MB limit, dangerous extension rejection, IFileStorageService integration"
  - "Entity link polymorphic linking to Contact/Company/Deal with automatic name denormalization via repository lookup"
  - "Request DTOs: AddCommentRequest, AddTimeEntryRequest, AddActivityLinkRequest"
affects: [05-05, 05-06, 05-07, 05-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sub-resource endpoint pattern: nested routes under parent with parent existence + scope validation"
    - "Author-only edit/delete with admin override using User.IsInRole('Admin')"
    - "Idempotent follow: 200 if already following, 201 on new follow"
    - "Entity name denormalization via repository lookup fallback when client does not provide name"

key-files:
  created: []
  modified:
    - src/GlobCRM.Api/Controllers/ActivitiesController.cs

key-decisions:
  - "IFileStorageService injected for attachment upload/download/delete with tenant-partitioned paths"
  - "Dangerous extensions (.exe, .bat, .cmd, .ps1, .sh) blocked at upload time for security"
  - "Entity link accepts Quote and Request types for forward compatibility (Phase 6+) alongside Contact/Company/Deal"
  - "Author-only edit/delete on comments and time entries with admin override via User.IsInRole"
  - "Follow/unfollow uses Activity:View permission (not Update) so any viewer can follow"

patterns-established:
  - "Sub-resource endpoint pattern: load parent, verify exists (404), check scope (403), then operate on child"
  - "Author-only guard pattern: compare child.AuthorId == currentUserId with admin bypass for delete"

# Metrics
duration: 4min
completed: 2026-02-17
---

# Phase 5 Plan 4: Activity Sub-Resource Endpoints Summary

**12 sub-resource endpoints for comments, attachments (25MB file upload via IFileStorageService), time entries, entity links (polymorphic Contact/Company/Deal with name denormalization), and followers (idempotent follow/unfollow)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-17T12:00:00Z
- **Completed:** 2026-02-17T12:04:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added 12 new endpoints to ActivitiesController, bringing total to 21 REST endpoints
- Comments support add (POST), edit (PUT, author-only), delete (DELETE, author/admin) with 1-5000 char validation
- Attachments use IFileStorageService for tenant-partitioned file upload/download/delete with 25MB limit and dangerous extension blocking
- Time entries validate duration range (1-1440 minutes = max 24 hours) with creator-only delete
- Entity links support polymorphic linking to Contact, Company, Deal (plus Quote/Request for forward compatibility) with duplicate prevention and automatic name denormalization
- Followers use Activity:View permission with idempotent follow (200 if already following, 201 on new)
- Injected IFileStorageService, ICompanyRepository, IContactRepository, IDealRepository into controller

## Task Commits

Each task was committed atomically:

1. **Task 1: Add comment, time entry, and follower endpoints** - `d4aa605` (feat)
2. **Task 2: Add attachment upload/download/delete and entity link endpoints** - `75de928` (feat)

## Files Created/Modified
- `src/GlobCRM.Api/Controllers/ActivitiesController.cs` - 12 new sub-resource endpoints, 3 request DTOs, ResolveEntityNameAsync helper, 4 new DI dependencies

## Decisions Made
- IFileStorageService injected for attachment storage using tenant-partitioned paths ({tenantId}/activities/{activityId}/{guid}_{filename})
- Dangerous extensions (.exe, .bat, .cmd, .ps1, .sh) rejected at upload time for security
- Entity link entityType validation accepts "Quote" and "Request" for forward compatibility with Phase 6+
- Author-only edit/delete on comments and time entries; admin can bypass delete restriction via User.IsInRole("Admin")
- Follow/unfollow use Activity:View permission (not Update) so any viewer can follow activities they have access to
- ResolveEntityNameAsync helper looks up entity name from Company/Contact/Deal repositories when client does not provide entityName

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 21 ActivitiesController endpoints complete, ready for Angular frontend consumption in Plan 05-05/05-06
- Sub-resource endpoints follow consistent pattern: parent existence check, scope validation, child operation
- Attachment storage integrated with existing LocalFileStorageService from Phase 2

## Self-Check: PASSED

- `src/GlobCRM.Api/Controllers/ActivitiesController.cs` verified present on disk
- Task 1 commit `d4aa605` verified in git log
- Task 2 commit `75de928` verified in git log
- `dotnet build` passes with 0 errors
- 21 endpoints verified: 9 original + 12 new sub-resource endpoints

---
*Phase: 05-activities-and-workflow*
*Completed: 2026-02-17*
