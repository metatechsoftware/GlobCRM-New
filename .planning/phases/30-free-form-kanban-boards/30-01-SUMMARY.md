---
phase: 30-free-form-kanban-boards
plan: 01
subsystem: database
tags: [ef-core, postgresql, kanban, domain-entities, migration, multi-tenancy]

# Dependency graph
requires: []
provides:
  - "7 Kanban domain entities (Board, Column, Card, Label, CardLabel, ChecklistItem, CardComment)"
  - "BoardVisibility enum (Private, Team, Public)"
  - "EF Core configurations with snake_case mapping, indexes, and FK constraints"
  - "Database migration creating 7 kanban_* tables"
  - "Global query filter on KanbanBoard for tenant isolation"
affects: [30-02, 30-03, 30-04, 30-05, 30-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Float-based SortOrder (double) for drag-and-drop insertion between items"
    - "Board-scoped child entities inheriting tenant isolation via FK chain"
    - "Polymorphic entity linking on KanbanCard (LinkedEntityType/Id/Name)"
    - "Self-referencing FK with Restrict delete for threaded comments"

key-files:
  created:
    - src/GlobCRM.Domain/Entities/KanbanBoard.cs
    - src/GlobCRM.Domain/Entities/KanbanColumn.cs
    - src/GlobCRM.Domain/Entities/KanbanCard.cs
    - src/GlobCRM.Domain/Entities/KanbanLabel.cs
    - src/GlobCRM.Domain/Entities/KanbanCardLabel.cs
    - src/GlobCRM.Domain/Entities/KanbanChecklistItem.cs
    - src/GlobCRM.Domain/Entities/KanbanCardComment.cs
    - src/GlobCRM.Domain/Enums/BoardVisibility.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/KanbanBoardConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/KanbanColumnConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/KanbanCardConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/KanbanLabelConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/KanbanCardLabelConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/KanbanChecklistItemConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/KanbanCardCommentConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260221181235_AddKanbanBoardEntities.cs
  modified:
    - src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs

key-decisions:
  - "CreatorId made nullable (Guid?) to support SetNull FK delete behavior when user is deleted"

patterns-established:
  - "Kanban entities use double SortOrder for float-based insertion between items"
  - "Child entities (Column, Card, Label, etc.) inherit tenant isolation via Board FK chain — no TenantId needed"
  - "KanbanCardComment uses self-referencing ParentCommentId with Restrict delete to prevent cascade cycles"

requirements-completed: [KANB-01, KANB-02, KANB-03, KANB-05, KANB-06, KANB-07, KANB-10, KANB-13, KANB-15, KANB-16]

# Metrics
duration: 4min
completed: 2026-02-21
---

# Phase 30 Plan 01: Domain Entities & Migration Summary

**7 Kanban domain entities with EF Core configurations, BoardVisibility enum, tenant-scoped query filter, and PostgreSQL migration creating kanban_boards/columns/cards/labels/card_labels/checklist_items/card_comments tables**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-21T18:09:12Z
- **Completed:** 2026-02-21T18:13:32Z
- **Tasks:** 2
- **Files modified:** 20 (8 entities + 1 enum + 7 configs + 1 DbContext + 2 migration files + 1 snapshot)

## Accomplishments

- Created 7 domain entities (KanbanBoard, KanbanColumn, KanbanCard, KanbanLabel, KanbanCardLabel, KanbanChecklistItem, KanbanCardComment) and BoardVisibility enum following established project patterns
- Created 7 EF Core fluent API configurations with snake_case table/column names, proper FK relationships (cascade/SetNull/Restrict), composite indexes, and string-stored enums
- Registered 7 DbSets in ApplicationDbContext with global query filter on KanbanBoard for tenant isolation
- Migration AddKanbanBoardEntities created and applied successfully, creating all 7 tables with proper constraints and indexes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create domain entities and BoardVisibility enum** - `8717729` (feat)
2. **Task 2: Create EF Core configurations, DbSet registrations, global query filter, and migration** - `1101d9b` (feat)

## Files Created/Modified

- `src/GlobCRM.Domain/Enums/BoardVisibility.cs` - Enum with Private, Team, Public values
- `src/GlobCRM.Domain/Entities/KanbanBoard.cs` - Board entity with TenantId, visibility, creator/team ownership, IsSeedData
- `src/GlobCRM.Domain/Entities/KanbanColumn.cs` - Column with double SortOrder, WipLimit, IsCollapsed
- `src/GlobCRM.Domain/Entities/KanbanCard.cs` - Card with entity linking, assignee, archive support
- `src/GlobCRM.Domain/Entities/KanbanLabel.cs` - Board-scoped label with default orange color
- `src/GlobCRM.Domain/Entities/KanbanCardLabel.cs` - Join table with composite PK (CardId, LabelId)
- `src/GlobCRM.Domain/Entities/KanbanChecklistItem.cs` - Checklist item with double SortOrder, IsChecked
- `src/GlobCRM.Domain/Entities/KanbanCardComment.cs` - Comment with threaded replies via ParentCommentId
- `src/GlobCRM.Infrastructure/Persistence/Configurations/KanbanBoardConfiguration.cs` - Board config with 3 indexes, SetNull FKs
- `src/GlobCRM.Infrastructure/Persistence/Configurations/KanbanColumnConfiguration.cs` - Column config with board_sort index
- `src/GlobCRM.Infrastructure/Persistence/Configurations/KanbanCardConfiguration.cs` - Card config with 3 indexes, entity link index
- `src/GlobCRM.Infrastructure/Persistence/Configurations/KanbanLabelConfiguration.cs` - Label config with board index
- `src/GlobCRM.Infrastructure/Persistence/Configurations/KanbanCardLabelConfiguration.cs` - Join table config with dual cascade
- `src/GlobCRM.Infrastructure/Persistence/Configurations/KanbanChecklistItemConfiguration.cs` - Checklist config with card_sort index
- `src/GlobCRM.Infrastructure/Persistence/Configurations/KanbanCardCommentConfiguration.cs` - Comment config with Restrict self-ref FK
- `src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs` - Added 7 DbSets + KanbanBoard query filter
- `src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260221181235_AddKanbanBoardEntities.cs` - Migration file

## Decisions Made

- CreatorId made nullable (Guid?) to support SetNull FK delete behavior when the creator user is deleted — a non-nullable Guid with SetNull would fail at database level

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed non-nullable CreatorId with SetNull delete behavior**
- **Found during:** Task 2 (EF Core configuration)
- **Issue:** Plan specified CreatorId as `Guid` (non-nullable) but also specified SetNull on delete. A non-nullable FK column cannot be set to null when the referenced user is deleted, causing a database constraint violation.
- **Fix:** Changed CreatorId from `Guid` to `Guid?` in KanbanBoard entity and removed `.IsRequired()` from the configuration property mapping.
- **Files modified:** `src/GlobCRM.Domain/Entities/KanbanBoard.cs`, `src/GlobCRM.Infrastructure/Persistence/Configurations/KanbanBoardConfiguration.cs`
- **Verification:** Solution builds cleanly, migration creates nullable `creator_id` column with SET NULL FK
- **Committed in:** `1101d9b` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential fix for database integrity. No scope creep.

## Issues Encountered

- Running GlobCRM.Api process (PID 16592) was locking DLL files, preventing initial build. Killed the process and build succeeded on retry.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 7 Kanban domain entities and database tables are ready for API controller development (Plan 02)
- DbSets are registered and queryable through ApplicationDbContext
- Global query filter ensures KanbanBoard queries are automatically tenant-scoped
- Entity relationships are established: Board -> Columns -> Cards -> Labels/Checklist/Comments

## Self-Check: PASSED

- All 17 key files verified present on disk
- Commit `8717729` (Task 1) verified in git log
- Commit `1101d9b` (Task 2) verified in git log

---
*Phase: 30-free-form-kanban-boards*
*Completed: 2026-02-21*
