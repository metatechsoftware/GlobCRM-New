---
phase: 10-data-operations
plan: 01
subsystem: database
tags: [ef-core, postgresql, tsvector, gin-index, csv-import, full-text-search, npgsql]

# Dependency graph
requires:
  - phase: 03-core-crm-entities
    provides: Company, Contact, Deal entities and configurations
  - phase: 09-dashboards-and-reporting
    provides: Dashboard entity pattern for new tenant-scoped entity reference
provides:
  - ImportJob and ImportJobError domain entities for CSV import tracking
  - ImportStatus and ImportEntityType enums for import workflow
  - IImportRepository interface for import job CRUD
  - ISearchService interface with GlobalSearchResult/SearchGroup/SearchHit DTOs
  - NpgsqlTsVector SearchVector on Company, Contact, Deal with GIN indexes
  - Database migration with import tables and tsvector columns
affects: [10-02-csv-import-service, 10-03-search-service, 10-04-import-api, 10-05-search-api, 10-06-frontend]

# Tech tracking
tech-stack:
  added: [Npgsql 10.0.0 in Domain project]
  patterns: [HasGeneratedTsVectorColumn for auto-maintained tsvector, JSONB List<T> with System.Text.Json HasConversion]

key-files:
  created:
    - src/GlobCRM.Domain/Entities/ImportJob.cs
    - src/GlobCRM.Domain/Entities/ImportJobError.cs
    - src/GlobCRM.Domain/Enums/ImportStatus.cs
    - src/GlobCRM.Domain/Enums/ImportEntityType.cs
    - src/GlobCRM.Domain/Interfaces/IImportRepository.cs
    - src/GlobCRM.Domain/Interfaces/ISearchService.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/ImportJobConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/ImportJobErrorConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260217190819_AddImportAndSearchVector.cs
  modified:
    - src/GlobCRM.Domain/Entities/Company.cs
    - src/GlobCRM.Domain/Entities/Contact.cs
    - src/GlobCRM.Domain/Entities/Deal.cs
    - src/GlobCRM.Domain/GlobCRM.Domain.csproj
    - src/GlobCRM.Infrastructure/Persistence/Configurations/CompanyConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/ContactConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/DealConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs

key-decisions:
  - "Npgsql package added to Domain project for NpgsqlTsVector type reference"
  - "HasGeneratedTsVectorColumn returns EntityTypeBuilder -- HasColumnName must be set separately via Property()"
  - "ImportFieldMapping as value object in ImportJob.cs file with JSONB List<T> storage"
  - "ImportJob.UserId nullable with SetNull FK -- import survives user deletion"

patterns-established:
  - "tsvector search pattern: HasGeneratedTsVectorColumn + separate Property().HasColumnName() + GIN index"
  - "JSONB List<T> conversion: System.Text.Json HasConversion matching Dictionary<> pattern from DashboardWidget"

# Metrics
duration: 4min
completed: 2026-02-17
---

# Phase 10 Plan 01: Domain Foundation Summary

**ImportJob/ImportJobError entities with JSONB field mappings, tsvector SearchVector on Company/Contact/Deal with GIN indexes, and EF Core migration**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-17T19:04:58Z
- **Completed:** 2026-02-17T19:09:10Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments
- ImportJob entity with full CSV import tracking (status, progress, field mappings as JSONB, duplicate strategy)
- ImportJobError entity for per-row error recording with cascade delete from parent job
- NpgsqlTsVector SearchVector property on Company (Name, Industry, Email, City), Contact (FirstName, LastName, Email, JobTitle), Deal (Title, Description)
- GIN indexes on all three search vector columns for fast full-text search queries
- IImportRepository and ISearchService interfaces with GlobalSearchResult/SearchGroup/SearchHit DTOs

## Task Commits

Each task was committed atomically:

1. **Task 1: Create import domain entities, enums, interfaces + add SearchVector** - `01b0127` (feat)
2. **Task 2: Create EF Core configurations, register DbSets, and run migration** - `77607e8` (feat)

## Files Created/Modified
- `src/GlobCRM.Domain/Entities/ImportJob.cs` - Import job entity with ImportFieldMapping value object
- `src/GlobCRM.Domain/Entities/ImportJobError.cs` - Per-row import error entity
- `src/GlobCRM.Domain/Enums/ImportStatus.cs` - Pending/Mapping/Previewing/Processing/Completed/Failed enum
- `src/GlobCRM.Domain/Enums/ImportEntityType.cs` - Contact/Company/Deal enum
- `src/GlobCRM.Domain/Interfaces/IImportRepository.cs` - Import job CRUD interface
- `src/GlobCRM.Domain/Interfaces/ISearchService.cs` - Cross-entity search interface with DTOs
- `src/GlobCRM.Domain/Entities/Company.cs` - Added NpgsqlTsVector SearchVector property
- `src/GlobCRM.Domain/Entities/Contact.cs` - Added NpgsqlTsVector SearchVector property
- `src/GlobCRM.Domain/Entities/Deal.cs` - Added NpgsqlTsVector SearchVector property
- `src/GlobCRM.Domain/GlobCRM.Domain.csproj` - Added Npgsql 10.0.0 package reference
- `src/GlobCRM.Infrastructure/Persistence/Configurations/ImportJobConfiguration.cs` - Import job EF config with JSONB mappings
- `src/GlobCRM.Infrastructure/Persistence/Configurations/ImportJobErrorConfiguration.cs` - Import error EF config
- `src/GlobCRM.Infrastructure/Persistence/Configurations/CompanyConfiguration.cs` - Added search vector + GIN index
- `src/GlobCRM.Infrastructure/Persistence/Configurations/ContactConfiguration.cs` - Added search vector + GIN index
- `src/GlobCRM.Infrastructure/Persistence/Configurations/DealConfiguration.cs` - Added search vector + GIN index
- `src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs` - Added ImportJob/ImportJobError DbSets, configs, query filter
- `src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260217190819_AddImportAndSearchVector.cs` - Migration

## Decisions Made
- **Npgsql in Domain:** Added Npgsql 10.0.0 package to Domain project so entities can reference NpgsqlTsVector type directly
- **HasGeneratedTsVectorColumn API:** Returns EntityTypeBuilder not PropertyBuilder, so HasColumnName must be set separately via builder.Property()
- **ImportFieldMapping value object:** Defined in ImportJob.cs file (not separate file) since it is a simple value object for JSONB serialization
- **Import job user FK:** Nullable with SetNull delete behavior so import records survive user deletion

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed HasGeneratedTsVectorColumn fluent API chaining**
- **Found during:** Task 2 (EF Core configurations)
- **Issue:** Plan showed `.HasColumnName("search_vector")` chained on `HasGeneratedTsVectorColumn()`, but this method returns `EntityTypeBuilder<T>` not `PropertyBuilder`, causing CS1929 compile error
- **Fix:** Separated into two calls: `HasGeneratedTsVectorColumn()` then `builder.Property(x => x.SearchVector).HasColumnName("search_vector")`
- **Files modified:** CompanyConfiguration.cs, ContactConfiguration.cs, DealConfiguration.cs
- **Verification:** `dotnet build` succeeds with 0 errors
- **Committed in:** 77607e8 (Task 2 commit)

**2. [Rule 3 - Blocking] Added Npgsql package to Domain project**
- **Found during:** Task 1 (adding SearchVector property to entities)
- **Issue:** Domain project had no Npgsql package reference, NpgsqlTsVector type unavailable
- **Fix:** `dotnet add src/GlobCRM.Domain package Npgsql --version 10.0.0`
- **Files modified:** src/GlobCRM.Domain/GlobCRM.Domain.csproj
- **Verification:** Domain project builds successfully with NpgsqlTsVector usage
- **Committed in:** 01b0127 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for compilation. No scope creep.

## Issues Encountered
None -- migration applied cleanly, all tables and indexes created as expected.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Import domain foundation complete, ready for backend services (10-02: CSV import service, 10-03: search service)
- All interfaces defined for service implementation
- Database schema includes import tables and tsvector columns with GIN indexes

---
*Phase: 10-data-operations*
*Completed: 2026-02-17*
