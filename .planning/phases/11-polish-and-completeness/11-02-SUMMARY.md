---
phase: 11-polish-and-completeness
plan: 02
subsystem: api
tags: [asp-net-core, crud, rest-api, file-storage, calendar, polymorphic-linking, rbac]

# Dependency graph
requires:
  - phase: 11-polish-and-completeness
    plan: 01
    provides: Note and Attachment domain entities, EF Core configurations, IFileStorageService
  - phase: 02-core-infrastructure
    provides: Permission system, RBAC, IFileStorageService, ApplicationDbContext
  - phase: 05-activities
    provides: Activity entity, ActivitiesController patterns, dual-ownership scope
provides:
  - NotesController with full CRUD (list, get, create, update, delete, entity-scoped)
  - AttachmentsController with generic entity file operations (upload, list, download, delete)
  - CalendarController with date-range activity query for calendar rendering
  - NoteRepository with paged queries, entity-scoped filtering, ownership scope, timeline entries
  - Note timeline integration in Company, Contact, Deal, Quote, Request timeline endpoints
  - Note entity type in EntityType enum for RBAC permission seeding
affects: [11-03 notes-frontend, 11-04 attachments-frontend, 11-05 calendar-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns: [generic polymorphic attachment controller with entity-type routing, calendar date-range query without pagination]

key-files:
  created:
    - src/GlobCRM.Domain/Common/INoteRepository.cs
    - src/GlobCRM.Infrastructure/Persistence/Repositories/NoteRepository.cs
    - src/GlobCRM.Api/Controllers/NotesController.cs
    - src/GlobCRM.Api/Controllers/AttachmentsController.cs
    - src/GlobCRM.Api/Controllers/CalendarController.cs
  modified:
    - src/GlobCRM.Domain/Enums/EntityType.cs
    - src/GlobCRM.Infrastructure/CrmEntities/CrmEntityServiceExtensions.cs
    - src/GlobCRM.Api/Controllers/CompaniesController.cs
    - src/GlobCRM.Api/Controllers/ContactsController.cs
    - src/GlobCRM.Api/Controllers/DealsController.cs
    - src/GlobCRM.Api/Controllers/QuotesController.cs
    - src/GlobCRM.Api/Controllers/RequestsController.cs

key-decisions:
  - "INoteRepository in Domain/Common with NoteTimelineEntry record for cross-controller timeline integration"
  - "AttachmentsController uses polymorphic route /api/{entityType}/{entityId}/attachments for any entity type"
  - "CalendarController queries ApplicationDbContext.Activities directly (no separate repository) for lightweight date-range query"
  - "Note entity type added to EntityType enum enabling automatic RBAC permission seeding on startup"

patterns-established:
  - "Generic entity attachment routes: /api/{entityType}/{entityId}/attachments with allowed entity type validation"
  - "Calendar date-range query: no pagination, just date-bounded with priority-based color coding"
  - "Note timeline integration: INoteRepository.GetEntityNotesForTimelineAsync reused across 5 entity controllers"

# Metrics
duration: 6min
completed: 2026-02-18
---

# Phase 11 Plan 02: Notes, Attachments, Calendar API Summary

**NotesController with full CRUD and entity-scoped queries, generic AttachmentsController for any entity type, CalendarController with date-range activity aggregation, and note timeline integration across 5 entity types**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-18T07:03:00Z
- **Completed:** 2026-02-18T07:09:25Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- NotesController with 6 endpoints: paged list, get by ID (full HTML body), create (with HTML-to-plaintext stripping), update (author-only/admin), delete (author-only/admin), entity-scoped notes
- AttachmentsController with generic polymorphic CRUD: upload (25MB max, dangerous extension blocking), list, download, delete (author-only/admin) for any entity type
- CalendarController with date-range bounded activity query, optional filters (type, owner, entity), priority-based color coding, RBAC dual-ownership scope
- NoteRepository with paged queries, ownership scope (AuthorId), search, sorting, entity-scoped filtering, and timeline entry generation
- Note timeline entries integrated into Company, Contact, Deal, Quote, and Request timeline endpoints
- Note added to EntityType enum for automatic RBAC permission seeding

## Task Commits

Each task was committed atomically:

1. **Task 1: NoteRepository + NotesController with CRUD and entity-scoped queries** - `0c56b0c` (feat)
2. **Task 2: AttachmentsController + CalendarController** - `7df7b99` (feat)

## Files Created/Modified
- `src/GlobCRM.Domain/Common/INoteRepository.cs` - Repository interface with paged queries, entity-scoped filtering, timeline entries
- `src/GlobCRM.Infrastructure/Persistence/Repositories/NoteRepository.cs` - EF Core implementation with ownership scope, search, sorting, pagination
- `src/GlobCRM.Api/Controllers/NotesController.cs` - Full CRUD with 6 endpoints, HTML stripping, permission enforcement
- `src/GlobCRM.Api/Controllers/AttachmentsController.cs` - Generic entity attachment upload/list/download/delete with file validation
- `src/GlobCRM.Api/Controllers/CalendarController.cs` - Date-range activity query with optional filters and priority-based colors
- `src/GlobCRM.Domain/Enums/EntityType.cs` - Added Note to EntityType enum
- `src/GlobCRM.Infrastructure/CrmEntities/CrmEntityServiceExtensions.cs` - Registered INoteRepository DI
- `src/GlobCRM.Api/Controllers/CompaniesController.cs` - Added note entries to company timeline
- `src/GlobCRM.Api/Controllers/ContactsController.cs` - Added note entries to contact timeline
- `src/GlobCRM.Api/Controllers/DealsController.cs` - Added note entries to deal timeline
- `src/GlobCRM.Api/Controllers/QuotesController.cs` - Added note entries to quote timeline
- `src/GlobCRM.Api/Controllers/RequestsController.cs` - Added note entries to request timeline

## Decisions Made
- INoteRepository defined in Domain/Common (not Domain/Interfaces) with NoteTimelineEntry record for cross-controller reuse without DTO dependency
- AttachmentsController uses polymorphic route pattern /api/{entityType}/{entityId}/attachments with PascalCase normalization for DB storage
- CalendarController queries ApplicationDbContext.Activities directly rather than using IActivityRepository (no suitable date-range method, and calendar is read-only with different shape)
- Note entity type added to EntityType enum so RoleTemplateSeeder automatically creates Note:View/Create/Edit/Delete permissions on startup

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Notes API complete, ready for frontend Notes UI (Plan 03/04)
- Attachments API complete, ready for frontend Attachments UI (Plan 04/05)
- Calendar API complete, ready for frontend Calendar view (Plan 05)
- No blockers for subsequent plans

## Self-Check: PASSED

All files verified present. Both commit hashes (0c56b0c, 7df7b99) confirmed in git log.

---
*Phase: 11-polish-and-completeness*
*Completed: 2026-02-18*
