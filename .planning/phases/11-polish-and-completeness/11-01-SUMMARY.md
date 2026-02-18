---
phase: 11-polish-and-completeness
plan: 01
subsystem: database, infra
tags: [ef-core, postgresql, azure-blob, multi-tenancy, rls, polymorphic-linking]

# Dependency graph
requires:
  - phase: 02-core-infrastructure
    provides: IFileStorageService abstraction, LocalFileStorageService, ApplicationDbContext patterns
  - phase: 05-activities
    provides: ActivityAttachment and ActivityLink entity patterns for polymorphic linking
provides:
  - Note entity with rich text body, polymorphic entity linking, author FK
  - Attachment entity with polymorphic entity linking, file metadata, uploader FK
  - EF Core configurations with tenant query filters and RLS policies
  - AzureBlobStorageService implementing IFileStorageService for cloud storage
  - Conditional DI registration (Local vs Azure) based on configuration
affects: [11-02 notes-api, 11-03 attachments-api, 11-04 notes-ui, 11-05 attachments-ui]

# Tech tracking
tech-stack:
  added: [Azure.Storage.Blobs 12.27.0]
  patterns: [polymorphic entity linking with EntityType+EntityId, conditional storage provider DI]

key-files:
  created:
    - src/GlobCRM.Domain/Entities/Note.cs
    - src/GlobCRM.Domain/Entities/Attachment.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/NoteConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/AttachmentConfiguration.cs
    - src/GlobCRM.Infrastructure/Storage/AzureBlobStorageService.cs
    - src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260218065653_AddNotesAndAttachments.cs
  modified:
    - src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs
    - src/GlobCRM.Infrastructure/DependencyInjection.cs
    - src/GlobCRM.Infrastructure/Images/ImageServiceExtensions.cs
    - src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj
    - src/GlobCRM.Api/appsettings.Development.json

key-decisions:
  - "Note and Attachment are tenant-scoped entities (not child entities) with their own TenantId, query filters, and RLS policies"
  - "Polymorphic entity linking via EntityType string + EntityId Guid (matching ActivityLink pattern, no FK constraints)"
  - "ImageServiceExtensions updated to accept IConfiguration for conditional provider selection (not a new extension method)"
  - "AzureBlobStorageService registered as Scoped (not Singleton) since BlobServiceClient is connection-string-scoped"

patterns-established:
  - "Conditional IFileStorageService DI: FileStorage:Provider config switches between Local (default) and Azure"
  - "Generic polymorphic attachment entity pattern for any CRM entity (distinct from activity-specific ActivityAttachment)"

# Metrics
duration: 4min
completed: 2026-02-18
---

# Phase 11 Plan 01: Notes & Attachments Domain Summary

**Note and Attachment domain entities with polymorphic entity linking, EF Core tenant isolation, RLS policies, and AzureBlobStorageService for cloud file storage**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-18T06:55:41Z
- **Completed:** 2026-02-18T06:59:54Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Note entity with rich text body (HTML), plain text body for search, polymorphic entity linking, and author tracking
- Attachment entity with file metadata, polymorphic entity linking, and uploader tracking
- EF Core configurations with snake_case tables, composite indexes on (TenantId, EntityType, EntityId), and SetNull FK behaviors
- Migration with RLS policies for tenant isolation at the database level
- AzureBlobStorageService with tenant-partitioned virtual directories in single "attachments" container
- Conditional DI registration switching between Local (development) and Azure (production) storage

## Task Commits

Each task was committed atomically:

1. **Task 1: Note and Attachment domain entities + EF Core configurations** - `700c767` (feat)
2. **Task 2: AzureBlobStorageService + conditional DI registration** - `8745728` (feat)

## Files Created/Modified
- `src/GlobCRM.Domain/Entities/Note.cs` - Note entity with rich text body, polymorphic linking, author FK, IsSeedData
- `src/GlobCRM.Domain/Entities/Attachment.cs` - Generic attachment entity with polymorphic linking, file metadata
- `src/GlobCRM.Infrastructure/Persistence/Configurations/NoteConfiguration.cs` - EF Core config with tenant/entity/author indexes, text column types
- `src/GlobCRM.Infrastructure/Persistence/Configurations/AttachmentConfiguration.cs` - EF Core config with tenant/entity index, StoragePath max length 500
- `src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs` - Added DbSet<Note>, DbSet<Attachment>, configurations, and global query filters
- `src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260218065653_AddNotesAndAttachments.cs` - Migration creating notes/attachments tables with RLS policies
- `src/GlobCRM.Infrastructure/Storage/AzureBlobStorageService.cs` - Azure Blob implementation of IFileStorageService with tenant-partitioned paths
- `src/GlobCRM.Infrastructure/Images/ImageServiceExtensions.cs` - Updated to accept IConfiguration for conditional provider registration
- `src/GlobCRM.Infrastructure/DependencyInjection.cs` - Passes configuration to AddImageServices
- `src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj` - Added Azure.Storage.Blobs 12.27.0 package reference
- `src/GlobCRM.Api/appsettings.Development.json` - Added FileStorage:Provider = "Local" config

## Decisions Made
- Note and Attachment are tenant-scoped entities with their own TenantId, query filters, and RLS policies (unlike ActivityAttachment which is a child entity inheriting via FK)
- Polymorphic entity linking via EntityType string + EntityId Guid (matching ActivityLink pattern, no FK constraints to target entities)
- Updated existing ImageServiceExtensions.AddImageServices to accept IConfiguration rather than creating a separate registration method
- AzureBlobStorageService registered as Scoped (not Singleton like LocalFileStorageService) since it manages a connection-string-scoped BlobServiceClient

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Corrupted nested bin/Debug directory caused path-too-long build error; resolved by cleaning build output with `dotnet clean`

## User Setup Required
None - no external service configuration required. Development defaults to LocalFileStorageService.

## Next Phase Readiness
- Note and Attachment domain layer complete, ready for API endpoints (Plan 02+)
- AzureBlobStorageService code-complete, ready for production use when FileStorage:Provider is set to "Azure"
- No blockers for subsequent plans

## Self-Check: PASSED

All 7 files verified present. Both commit hashes (700c767, 8745728) confirmed in git log.

---
*Phase: 11-polish-and-completeness*
*Completed: 2026-02-18*
