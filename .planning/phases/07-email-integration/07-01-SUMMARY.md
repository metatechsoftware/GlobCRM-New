---
phase: 07-email-integration
plan: 01
subsystem: database
tags: [ef-core, postgresql, email, gmail, oauth, rls, migration]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "ApplicationDbContext, tenant isolation triple-layer pattern, RLS setup script"
  - phase: 03-core-crm-entities
    provides: "Contact and Company entities for email auto-linking FKs"
provides:
  - "EmailAccount entity with encrypted OAuth token storage and sync state"
  - "EmailMessage entity with Gmail IDs, metadata, and contact/company auto-linking"
  - "EmailThread entity for thread grouping by Gmail thread ID"
  - "EmailSyncStatus enum (Active, Paused, Error, Disconnected)"
  - "IEmailAccountRepository and IEmailMessageRepository interfaces"
  - "EF Core configurations with snake_case naming and proper indexes"
  - "AddEmailIntegration migration creating email_accounts, email_messages, email_threads tables"
  - "RLS policies for all three email tables"
affects: [07-02, 07-03, 07-04, 07-05, 07-06, 07-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Email entity pattern: tenant-scoped with Gmail ID unique composite indexes for deduplication"
    - "Encrypted token storage: EncryptedAccessToken/EncryptedRefreshToken fields (encryption at service layer)"
    - "JSONB address arrays: ToAddresses, CcAddresses, BccAddresses as jsonb columns"

key-files:
  created:
    - src/GlobCRM.Domain/Entities/EmailAccount.cs
    - src/GlobCRM.Domain/Entities/EmailMessage.cs
    - src/GlobCRM.Domain/Entities/EmailThread.cs
    - src/GlobCRM.Domain/Enums/EmailSyncStatus.cs
    - src/GlobCRM.Domain/Interfaces/IEmailAccountRepository.cs
    - src/GlobCRM.Domain/Interfaces/IEmailMessageRepository.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/EmailAccountConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/EmailMessageConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/EmailThreadConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260217151310_AddEmailIntegration.cs
  modified:
    - src/GlobCRM.Domain/Entities/Contact.cs
    - src/GlobCRM.Domain/Entities/Company.cs
    - src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs
    - scripts/rls-setup.sql

key-decisions:
  - "ulong LastHistoryId maps to bigint in PostgreSQL for Gmail incremental sync history tracking"
  - "Email address arrays (To/Cc/Bcc) stored as jsonb columns, not separate tables"
  - "One EmailAccount per user per tenant enforced by unique composite index"

patterns-established:
  - "Email deduplication: unique (tenant_id, gmail_message_id) prevents duplicate synced messages"
  - "Thread grouping: EmailThread entity with unique (tenant_id, gmail_thread_id) for conversation view"

# Metrics
duration: 3min
completed: 2026-02-17
---

# Phase 7 Plan 1: Email Domain Model Summary

**Email domain entities (EmailAccount, EmailMessage, EmailThread) with EF Core configs, AddEmailIntegration migration, and RLS policies for tenant-isolated email storage**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-17T15:10:23Z
- **Completed:** 2026-02-17T15:14:06Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments
- Complete domain model for email integration: EmailAccount (OAuth connection), EmailMessage (synced emails), EmailThread (conversation grouping)
- EF Core configurations with unique composite indexes preventing duplicate Gmail messages and enforcing one account per user per tenant
- AddEmailIntegration migration creating all three tables with proper FK constraints and indexes
- RLS policies for email_accounts, email_messages, and email_threads enforcing tenant isolation at database level
- Contact and Company entities updated with EmailMessages navigation collection for bidirectional linking

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Email domain entities, enum, and repository interfaces** - `76d2d09` (feat)
2. **Task 2: Create EF Core configurations, update DbContext, add RLS policies, and generate migration** - `b5ca808` (feat)

## Files Created/Modified
- `src/GlobCRM.Domain/Entities/EmailAccount.cs` - Per-user Gmail OAuth connection with encrypted token storage and sync state
- `src/GlobCRM.Domain/Entities/EmailMessage.cs` - Synced email message with Gmail IDs, metadata, body, and contact/company auto-linking
- `src/GlobCRM.Domain/Entities/EmailThread.cs` - Thread grouping by Gmail thread ID with message count and last message timestamp
- `src/GlobCRM.Domain/Enums/EmailSyncStatus.cs` - Enum: Active, Paused, Error, Disconnected
- `src/GlobCRM.Domain/Interfaces/IEmailAccountRepository.cs` - Repository for per-user account lookup and active accounts for sync
- `src/GlobCRM.Domain/Interfaces/IEmailMessageRepository.cs` - Repository for paged listing, thread view, entity-scoped queries, and upsert sync
- `src/GlobCRM.Domain/Entities/Contact.cs` - Added EmailMessages navigation collection
- `src/GlobCRM.Domain/Entities/Company.cs` - Added EmailMessages navigation collection
- `src/GlobCRM.Infrastructure/Persistence/Configurations/EmailAccountConfiguration.cs` - Table config with unique (tenant_id, user_id) index
- `src/GlobCRM.Infrastructure/Persistence/Configurations/EmailMessageConfiguration.cs` - Table config with unique (tenant_id, gmail_message_id) dedup index
- `src/GlobCRM.Infrastructure/Persistence/Configurations/EmailThreadConfiguration.cs` - Table config with unique (tenant_id, gmail_thread_id) index
- `src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs` - 3 new DbSets, 3 configurations, 3 query filters
- `scripts/rls-setup.sql` - RLS policies for email_accounts, email_messages, email_threads
- `src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260217151310_AddEmailIntegration.cs` - Migration creating all email tables

## Decisions Made
- ulong LastHistoryId maps to bigint in PostgreSQL -- ulong is the C# type for Gmail's history ID, bigint is the appropriate PG column type
- Email address arrays (To/Cc/Bcc) stored as jsonb columns rather than separate tables -- simpler schema, Gmail provides them as arrays
- One EmailAccount per user per tenant enforced by unique composite index on (tenant_id, user_id) -- prevents duplicate OAuth connections

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Domain model complete, ready for Plan 2 (Gmail OAuth service and token encryption)
- All entities, configurations, and migration ready for use by subsequent email integration plans
- Repository interfaces defined for Plan 3 (repository implementations)

## Self-Check: PASSED

All 10 created files verified on disk. Both task commits (76d2d09, b5ca808) verified in git log. Build succeeds with 0 errors.

---
*Phase: 07-email-integration*
*Completed: 2026-02-17*
