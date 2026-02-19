---
phase: 13-leads
plan: 01
subsystem: database
tags: [ef-core, postgresql, jsonb, gin-index, full-text-search, rls, multi-tenancy, repository-pattern]

# Dependency graph
requires:
  - phase: 04-deals
    provides: "Deal, Pipeline, PipelineStage entities and DealRepository pattern"
  - phase: 03-contacts
    provides: "Contact entity pattern with person fields, FullName computed property"
provides:
  - "Lead entity with person fields, pipeline stage, source, temperature, conversion tracking"
  - "LeadStage entity with configurable stages and terminal flags (IsConverted, IsLost)"
  - "LeadSource entity for configurable lead source list"
  - "LeadStageHistory entity for stage transition audit trail"
  - "LeadConversion entity linking lead to contact/company/deal"
  - "ILeadRepository/LeadRepository with paged queries, scope enforcement, kanban, stage history"
  - "EF Core configurations with JSONB, GIN indexes, full-text search, FK constraints"
  - "Database migration creating 5 tables with all indexes"
  - "RLS policies for leads, lead_stages, lead_sources"
  - "Seed data: 5 stages, 7 sources, 10 sample leads"
affects: [13-02, 13-03, 13-04, 14-foundation]

# Tech tracking
tech-stack:
  added: []
  patterns: [lead-pipeline-stages, lead-temperature-enum, lead-conversion-one-to-one]

key-files:
  created:
    - src/GlobCRM.Domain/Entities/Lead.cs
    - src/GlobCRM.Domain/Entities/LeadStage.cs
    - src/GlobCRM.Domain/Entities/LeadSource.cs
    - src/GlobCRM.Domain/Entities/LeadStageHistory.cs
    - src/GlobCRM.Domain/Entities/LeadConversion.cs
    - src/GlobCRM.Domain/Enums/LeadTemperature.cs
    - src/GlobCRM.Domain/Interfaces/ILeadRepository.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/LeadConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/LeadStageConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/LeadSourceConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/LeadStageHistoryConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/LeadConversionConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Repositories/LeadRepository.cs
    - src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260218201611_AddLeadEntities.cs
  modified:
    - src/GlobCRM.Domain/Enums/EntityType.cs
    - src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs
    - src/GlobCRM.Infrastructure/CrmEntities/CrmEntityServiceExtensions.cs
    - src/GlobCRM.Infrastructure/MultiTenancy/TenantSeeder.cs
    - scripts/rls-setup.sql

key-decisions:
  - "LeadStage is separate from PipelineStage -- simpler model without probability/required-fields/team-scoping"
  - "Lead.CompanyName is a string (not FK) because leads may reference non-existent companies"
  - "LeadConversion is one-to-one with Lead (unique index on LeadId) for conversion audit trail"
  - "LeadStageHistory.FromStageId is nullable (null for initial stage assignment)"
  - "Child entities (LeadStageHistory, LeadConversion) inherit tenant isolation via Lead FK -- no separate TenantId or RLS"

patterns-established:
  - "Lead pipeline pattern: separate LeadStage entity with IsConverted/IsLost terminal flags"
  - "Lead conversion pattern: one-to-one LeadConversion entity with Contact (required), Company/Deal (optional)"
  - "Lead temperature scoring: Hot/Warm/Cold enum with Warm as default"

requirements-completed: [LEAD-01, LEAD-03, LEAD-05]

# Metrics
duration: 6min
completed: 2026-02-18
---

# Phase 13 Plan 01: Lead Domain Model Summary

**Lead entity with 5 pipeline stages, 7 configurable sources, temperature scoring, conversion tracking, and full LeadRepository with scope-enforced queries**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-18T20:12:08Z
- **Completed:** 2026-02-18T20:17:57Z
- **Tasks:** 3
- **Files modified:** 21

## Accomplishments
- Complete Lead domain model with person fields, pipeline stages, source attribution, temperature scoring, and conversion tracking
- EF Core configurations producing correct PostgreSQL schema with snake_case tables, JSONB + GIN indexes, full-text search vectors, and proper FK relationships
- LeadRepository implementing all query methods (paged list, kanban, detail, stage history, stages, sources) with ownership scope enforcement
- Database migration applied creating 5 tables with 22 indexes
- Triple-layer tenant isolation: entity TenantId + global query filters + RLS policies
- Seed data: 5 default stages (New/Contacted/Qualified/Lost/Converted), 7 sources (Website/Referral/LinkedIn/Cold Call/Trade Show/Email Campaign/Other), 10 sample leads

## Task Commits

Each task was committed atomically:

1. **Task 1: Create domain entities and enums** - `cb34f2c` (feat)
2. **Task 2: Create EF configurations, repository implementation, and DbContext registration** - `a769582` (feat)
3. **Task 3: Create database migration, RLS policies, and seed data** - `03e59db` (feat)

## Files Created/Modified
- `src/GlobCRM.Domain/Entities/Lead.cs` - Lead entity with person, pipeline, source, temperature, conversion, custom fields
- `src/GlobCRM.Domain/Entities/LeadStage.cs` - Configurable pipeline stage with terminal flags
- `src/GlobCRM.Domain/Entities/LeadSource.cs` - Configurable lead source entity
- `src/GlobCRM.Domain/Entities/LeadStageHistory.cs` - Stage transition audit trail
- `src/GlobCRM.Domain/Entities/LeadConversion.cs` - Conversion record linking lead to contact/company/deal
- `src/GlobCRM.Domain/Enums/LeadTemperature.cs` - Hot/Warm/Cold temperature enum
- `src/GlobCRM.Domain/Enums/EntityType.cs` - Added Lead value
- `src/GlobCRM.Domain/Interfaces/ILeadRepository.cs` - Repository interface with full CRUD + query + kanban
- `src/GlobCRM.Infrastructure/Persistence/Configurations/LeadConfiguration.cs` - EF config with JSONB, GIN, FTS
- `src/GlobCRM.Infrastructure/Persistence/Configurations/LeadStageConfiguration.cs` - EF config with tenant+sort composite index
- `src/GlobCRM.Infrastructure/Persistence/Configurations/LeadSourceConfiguration.cs` - EF config with tenant+sort composite index
- `src/GlobCRM.Infrastructure/Persistence/Configurations/LeadStageHistoryConfiguration.cs` - EF config with cascade/restrict FKs
- `src/GlobCRM.Infrastructure/Persistence/Configurations/LeadConversionConfiguration.cs` - EF config with unique LeadId
- `src/GlobCRM.Infrastructure/Persistence/Repositories/LeadRepository.cs` - Full repository with filtering, sorting, scope
- `src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs` - Added 5 DbSets and 3 query filters
- `src/GlobCRM.Infrastructure/CrmEntities/CrmEntityServiceExtensions.cs` - Registered ILeadRepository
- `src/GlobCRM.Infrastructure/MultiTenancy/TenantSeeder.cs` - Added lead stages, sources, and sample leads
- `scripts/rls-setup.sql` - Added RLS policies for leads, lead_stages, lead_sources
- `src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260218201611_AddLeadEntities.cs` - Migration creating 5 tables

## Decisions Made
- LeadStage is separate from PipelineStage -- simpler model without probability, required fields, or team scoping as recommended by research
- Lead.CompanyName is a plain string (not FK) because leads may reference companies not yet in the system
- LeadConversion uses a one-to-one relationship with Lead (unique index on LeadId) to ensure only one conversion per lead
- LeadStageHistory.FromStageId is nullable to support the initial stage assignment (no "from" stage)
- Child entities (LeadStageHistory, LeadConversion) inherit tenant isolation via Lead FK cascade -- no separate TenantId needed, matching DealStageHistory pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Lead domain model and data layer complete, ready for Plan 02 (API controllers and DTOs)
- ILeadRepository provides all query methods needed by the controller layer
- Seed data creates realistic demo environment for frontend development in Plan 03/04
- LeadConversion entity ready for conversion workflow implementation in Plan 04

## Self-Check: PASSED

All 15 created files verified. All 3 task commits verified (cb34f2c, a769582, 03e59db).

---
*Phase: 13-leads*
*Completed: 2026-02-18*
