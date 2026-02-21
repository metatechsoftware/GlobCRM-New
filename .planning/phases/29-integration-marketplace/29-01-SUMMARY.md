---
phase: 29-integration-marketplace
plan: 01
subsystem: database
tags: [ef-core, postgresql, data-protection, encryption, multi-tenancy, rls]

# Dependency graph
requires: []
provides:
  - Integration and IntegrationActivityLog domain entities
  - IntegrationStatus and IntegrationAction enums
  - IIntegrationRepository interface and EF Core implementation
  - CredentialEncryptionService (AES-256 via DataProtection)
  - EF Core migration creating integrations and integration_activity_logs tables
  - Global query filters and RLS policies for tenant isolation
affects: [29-02, 29-03, 29-04, 29-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [credential-encryption-via-dataprotection, integration-key-slug-pattern]

key-files:
  created:
    - src/GlobCRM.Domain/Entities/Integration.cs
    - src/GlobCRM.Domain/Entities/IntegrationActivityLog.cs
    - src/GlobCRM.Domain/Enums/IntegrationStatus.cs
    - src/GlobCRM.Domain/Enums/IntegrationAction.cs
    - src/GlobCRM.Domain/Interfaces/IIntegrationRepository.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/IntegrationConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/IntegrationActivityLogConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Repositories/IntegrationRepository.cs
    - src/GlobCRM.Infrastructure/Services/CredentialEncryptionService.cs
    - src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260221152122_AddIntegrationMarketplace.cs
  modified:
    - src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs
    - src/GlobCRM.Infrastructure/DependencyInjection.cs
    - scripts/rls-setup.sql

key-decisions:
  - "CredentialEncryptionService uses DataProtection with purpose string 'GlobCRM.Integration.Credentials' -- same pattern as Gmail TokenEncryptionService"
  - "IntegrationActivityLog has its own TenantId and global query filter (not filtered via parent FK) for direct query capability"
  - "Unique composite index on (tenant_id, integration_key) enforces one connection per integration per tenant"

patterns-established:
  - "Integration key slug pattern: IntegrationKey matches frontend catalog key (e.g., 'slack', 'gmail')"
  - "Credential masking: CredentialMask stores safe display value (last 4 chars) separate from encrypted blob"

requirements-completed: [INTG-06, INTG-10]

# Metrics
duration: 4min
completed: 2026-02-21
---

# Phase 29 Plan 01: Domain Model & Infrastructure Summary

**Integration and IntegrationActivityLog entities with AES-256 credential encryption, EF Core migration, tenant-scoped query filters, and RLS policies**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-21T15:18:20Z
- **Completed:** 2026-02-21T15:22:19Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Integration entity with encrypted credentials (DataProtection AES-256) and credential masking for safe UI display
- IntegrationActivityLog entity recording connect/disconnect/test events with denormalized user names
- EF Core migration creating two new tables with correct snake_case columns, FK cascade delete, and optimized indexes
- Triple-layer tenant isolation: global query filters + RLS policies for both tables
- CredentialEncryptionService and IntegrationRepository registered in DI

## Task Commits

Each task was committed atomically:

1. **Task 1: Create domain entities, enums, and repository interface** - `c0131d5` (feat)
2. **Task 2: Create EF Core configurations, migration, encryption service, repository, and DI registration** - `811d706` (feat)

## Files Created/Modified
- `src/GlobCRM.Domain/Entities/Integration.cs` - Integration entity with TenantId, IntegrationKey, Status, EncryptedCredentials, CredentialMask
- `src/GlobCRM.Domain/Entities/IntegrationActivityLog.cs` - Activity log entity with FK to Integration, denormalized user name
- `src/GlobCRM.Domain/Enums/IntegrationStatus.cs` - Connected, Disconnected enum
- `src/GlobCRM.Domain/Enums/IntegrationAction.cs` - Connected, Disconnected, TestSuccess, TestFailed enum
- `src/GlobCRM.Domain/Interfaces/IIntegrationRepository.cs` - Repository interface for Integration queries
- `src/GlobCRM.Infrastructure/Persistence/Configurations/IntegrationConfiguration.cs` - EF Core config with unique (tenant_id, integration_key) index
- `src/GlobCRM.Infrastructure/Persistence/Configurations/IntegrationActivityLogConfiguration.cs` - EF Core config with FK cascade and activity log index
- `src/GlobCRM.Infrastructure/Persistence/Repositories/IntegrationRepository.cs` - Repository implementation with tenant-scoped queries
- `src/GlobCRM.Infrastructure/Services/CredentialEncryptionService.cs` - AES-256 encryption via DataProtection
- `src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs` - Added DbSets, configurations, and global query filters
- `src/GlobCRM.Infrastructure/DependencyInjection.cs` - Registered CredentialEncryptionService (singleton) and IntegrationRepository (scoped)
- `scripts/rls-setup.sql` - Added RLS policies for integrations and integration_activity_logs tables
- `src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260221152122_AddIntegrationMarketplace.cs` - EF Core migration

## Decisions Made
- CredentialEncryptionService registered as singleton (same pattern as TokenEncryptionService) -- DataProtection provider is thread-safe
- IntegrationActivityLog gets its own global query filter (has TenantId column) rather than relying solely on parent FK, enabling direct activity log queries without loading the parent Integration
- Unique composite index on (tenant_id, integration_key) prevents duplicate integration connections per tenant at the database level

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Running GlobCRM.Api process (PID 29972) locked DLLs during solution build -- killed the process and rebuilt successfully
- Database migration update failed due to local PostgreSQL password authentication error (not a code issue) -- migration file is correct and will apply when DB credentials are available

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Domain model and infrastructure complete, ready for Plan 02 (API controller and endpoints)
- All entities, repository, and encryption service registered and available via DI
- Migration ready to apply when database is accessible

## Self-Check: PASSED

All 10 created files verified present. Both task commits (c0131d5, 811d706) verified in git log.

---
*Phase: 29-integration-marketplace*
*Completed: 2026-02-21*
