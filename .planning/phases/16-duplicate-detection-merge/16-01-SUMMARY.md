---
phase: 16-duplicate-detection-merge
plan: 01
subsystem: database, api
tags: [pg_trgm, fuzzysharp, duplicate-detection, merge, ef-core, postgresql]

# Dependency graph
requires:
  - phase: 13-leads
    provides: LeadConversion entity, Lead.ConvertedContactId/ConvertedCompanyId for FK transfer
  - phase: 14-email-templates
    provides: DomainEventInterceptor chain ordering for interceptor compatibility
provides:
  - DuplicateMatchingConfig entity (tenant-scoped matching rules)
  - MergeAuditLog entity (merge operation audit trail)
  - MergedIntoId/MergedAt/MergedByUserId on Contact and Company entities
  - Global query filters excluding merged records from list queries
  - pg_trgm extension with GIN trigram indexes on contacts (name, email) and companies (name, website)
  - IDuplicateDetectionService with two-tier pg_trgm + FuzzySharp detection
  - ContactMergeService with 12 FK/polymorphic reference transfer
  - CompanyMergeService with 13 FK/polymorphic reference transfer
  - RLS policies for duplicate_matching_configs and merge_audit_logs
affects: [16-02-api-endpoints, 16-03-frontend, 16-04-settings]

# Tech tracking
tech-stack:
  added: [FuzzySharp 2.0.2, pg_trgm extension]
  patterns: [two-tier-detection, single-transaction-merge, merged-record-soft-delete]

key-files:
  created:
    - src/GlobCRM.Domain/Entities/DuplicateMatchingConfig.cs
    - src/GlobCRM.Domain/Entities/MergeAuditLog.cs
    - src/GlobCRM.Domain/Interfaces/IDuplicateDetectionService.cs
    - src/GlobCRM.Infrastructure/Duplicates/DuplicateDetectionService.cs
    - src/GlobCRM.Infrastructure/Duplicates/ContactMergeService.cs
    - src/GlobCRM.Infrastructure/Duplicates/CompanyMergeService.cs
    - src/GlobCRM.Infrastructure/Duplicates/DuplicateServiceExtensions.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/DuplicateMatchingConfigConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/MergeAuditLogConfiguration.cs
  modified:
    - src/GlobCRM.Domain/Entities/Contact.cs
    - src/GlobCRM.Domain/Entities/Company.cs
    - src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/ContactConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/CompanyConfiguration.cs
    - src/GlobCRM.Infrastructure/DependencyInjection.cs
    - src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj
    - scripts/rls-setup.sql

key-decisions:
  - "Two-tier detection: pg_trgm GIN-indexed pre-filter at 50% of configured threshold, FuzzySharp weighted scoring in-memory"
  - "Contact scoring: name 50% + email 50% (redistributed when field missing)"
  - "Company scoring: name 60% + domain 40% with URL domain extraction"
  - "Merge via explicit BeginTransactionAsync/CommitAsync for full rollback on failure"
  - "Merged records excluded via global query filter (MergedIntoId == null) -- use IgnoreQueryFilters for redirect"
  - "ExecuteUpdateAsync for bulk FK transfers, entity-tracked updates for deduplication scenarios (DealContacts, ActivityLinks)"

patterns-established:
  - "Two-tier detection: pg_trgm database pre-filter -> FuzzySharp in-memory scoring"
  - "Single-transaction merge: BeginTransactionAsync -> SaveChangesAsync -> CommitAsync with RollbackAsync on catch"
  - "Soft-delete via MergedIntoId + global query filter exclusion (not IsDeleted flag)"
  - "Composite PK deduplication: query existing survivor links, remove conflicting loser links, update rest"

requirements-completed: [DUP-04, DUP-06, DUP-07]

# Metrics
duration: 6min
completed: 2026-02-19
---

# Phase 16 Plan 01: Backend Foundation Summary

**Two-tier pg_trgm + FuzzySharp duplicate detection with full FK-transfer merge services for contacts (12 references) and companies (13 references)**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-19T08:44:26Z
- **Completed:** 2026-02-19T08:51:13Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments
- DuplicateMatchingConfig and MergeAuditLog domain entities with EF configurations, JSONB columns, and RLS policies
- pg_trgm extension enabled with 4 GIN trigram indexes (contacts name/email, companies name/website)
- Two-tier DuplicateDetectionService: pg_trgm database pre-filter for fast candidate retrieval + FuzzySharp weighted composite scoring
- ContactMergeService transfers all 12 FK/polymorphic references (DealContacts, Quotes, Requests, EmailMessages, EmailThreads, Leads, LeadConversions, Notes, Attachments, ActivityLinks, FeedItems, Notifications) in a single transaction
- CompanyMergeService transfers all 13 FK/polymorphic references with the same single-transaction pattern
- Contact and Company global query filters updated to exclude merged records (MergedIntoId == null)

## Task Commits

Each task was committed atomically:

1. **Task 1: Domain entities, EF configs, pg_trgm extension, and migration** - `9577c10` (feat)
2. **Task 2: DuplicateDetectionService, ContactMergeService, CompanyMergeService, and DI registration** - `8f975f7` (feat)

## Files Created/Modified
- `src/GlobCRM.Domain/Entities/DuplicateMatchingConfig.cs` - Tenant-scoped matching rules entity
- `src/GlobCRM.Domain/Entities/MergeAuditLog.cs` - Merge operation audit trail entity
- `src/GlobCRM.Domain/Entities/Contact.cs` - Added MergedIntoId, MergedAt, MergedByUserId
- `src/GlobCRM.Domain/Entities/Company.cs` - Added MergedIntoId, MergedAt, MergedByUserId
- `src/GlobCRM.Domain/Interfaces/IDuplicateDetectionService.cs` - Interface with DuplicateMatch/DuplicatePair records
- `src/GlobCRM.Infrastructure/Duplicates/DuplicateDetectionService.cs` - Two-tier pg_trgm + FuzzySharp detection
- `src/GlobCRM.Infrastructure/Duplicates/ContactMergeService.cs` - Contact merge with 12 FK transfers
- `src/GlobCRM.Infrastructure/Duplicates/CompanyMergeService.cs` - Company merge with 13 FK transfers
- `src/GlobCRM.Infrastructure/Duplicates/DuplicateServiceExtensions.cs` - DI registration
- `src/GlobCRM.Infrastructure/Persistence/Configurations/DuplicateMatchingConfigConfiguration.cs` - EF config
- `src/GlobCRM.Infrastructure/Persistence/Configurations/MergeAuditLogConfiguration.cs` - EF config
- `src/GlobCRM.Infrastructure/Persistence/Configurations/ContactConfiguration.cs` - Merge field mappings + index
- `src/GlobCRM.Infrastructure/Persistence/Configurations/CompanyConfiguration.cs` - Merge field mappings + index
- `src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs` - DbSets, pg_trgm extension, configs, query filters
- `src/GlobCRM.Infrastructure/DependencyInjection.cs` - AddDuplicateServices() registration
- `src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj` - FuzzySharp 2.0.2 package reference
- `scripts/rls-setup.sql` - RLS policies for new tables

## Decisions Made
- Two-tier detection uses 50% of configured threshold for pg_trgm pre-filter to be inclusive, then FuzzySharp applies the actual threshold
- Contact scoring weights: name 50% (TokenSortRatio) + email 50% (Ratio); redistributed to 100% name when email missing
- Company scoring weights: name 60% (TokenSortRatio) + domain 40% (Ratio with URL domain extraction); redistributed when field missing
- Explicit transaction (BeginTransactionAsync/CommitAsync) chosen over single SaveChangesAsync because merge operations use ExecuteUpdateAsync for bulk FK transfers which bypass change tracker
- ExecuteUpdateAsync for simple FK re-pointing (Quotes, Requests, etc.); entity-tracked approach for DealContacts and ActivityLinks where composite PK deduplication requires per-record conflict checking
- MergedIntoId added to global query filter (not separate IsMerged flag) to keep entity model simple; IgnoreQueryFilters used in merge service and will be used for redirect in Plan 02

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All backend services ready for Plan 02 (API endpoints: DuplicatesController, DuplicateSettingsController)
- DuplicateDetectionService, ContactMergeService, CompanyMergeService registered in DI and injectable
- Database has pg_trgm extension, trigram indexes, new tables, and merge columns on contacts/companies
- Global query filters exclude merged records; IgnoreQueryFilters available for redirect handling

## Self-Check: PASSED

All 9 created files verified on disk. Both task commits (9577c10, 8f975f7) verified in git log.

---
*Phase: 16-duplicate-detection-merge*
*Completed: 2026-02-19*
