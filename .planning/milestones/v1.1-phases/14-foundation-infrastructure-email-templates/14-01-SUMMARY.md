---
phase: 14-foundation-infrastructure-email-templates
plan: 01
subsystem: infra, database, api
tags: [hangfire, postgresql, domain-events, fluid, liquid-templates, ef-core, rls, rbac]

# Dependency graph
requires:
  - phase: 13-leads
    provides: "Lead entities, EntityType enum, RBAC role template seeder"
provides:
  - "Hangfire background job infrastructure with PostgreSQL storage and tenant context propagation"
  - "DomainEventInterceptor for entity lifecycle event dispatching (Created/Updated/Deleted)"
  - "TenantScope AsyncLocal fallback for background job tenant resolution"
  - "EmailTemplate and EmailTemplateCategory domain entities with EF configurations and migration"
  - "RLS policies for email_templates and email_template_categories"
  - "TemplateRenderService for Fluid/Liquid merge field rendering"
  - "MergeFieldService for entity merge field definitions and resolution"
  - "EmailTemplateRepository with CRUD and Clone operations"
  - "EmailTemplate RBAC permissions auto-created via EntityType enum"
affects: [14-02, 14-03, 14-04, 15-webhooks, 16-duplicate-detection, 18-sequences, 19-workflows]

# Tech tracking
tech-stack:
  added: [Hangfire.AspNetCore 1.8.18, Hangfire.PostgreSql 1.21.1, Fluid.Core 2.12.0]
  patterns: [domain-event-interceptor, async-local-tenant-scope, fire-and-forget-dispatch, liquid-template-rendering]

key-files:
  created:
    - src/GlobCRM.Infrastructure/BackgroundJobs/HangfireServiceExtensions.cs
    - src/GlobCRM.Infrastructure/BackgroundJobs/TenantJobFilter.cs
    - src/GlobCRM.Infrastructure/BackgroundJobs/TenantScope.cs
    - src/GlobCRM.Infrastructure/DomainEvents/DomainEventInterceptor.cs
    - src/GlobCRM.Infrastructure/DomainEvents/DomainEventDispatcher.cs
    - src/GlobCRM.Infrastructure/DomainEvents/DomainEventServiceExtensions.cs
    - src/GlobCRM.Domain/Interfaces/IDomainEvent.cs
    - src/GlobCRM.Domain/Interfaces/IDomainEventDispatcher.cs
    - src/GlobCRM.Domain/Entities/EmailTemplate.cs
    - src/GlobCRM.Domain/Entities/EmailTemplateCategory.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/EmailTemplateConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/EmailTemplateCategoryConfiguration.cs
    - src/GlobCRM.Infrastructure/EmailTemplates/EmailTemplateRepository.cs
    - src/GlobCRM.Infrastructure/EmailTemplates/TemplateRenderService.cs
    - src/GlobCRM.Infrastructure/EmailTemplates/MergeFieldService.cs
    - src/GlobCRM.Infrastructure/EmailTemplates/EmailTemplateServiceExtensions.cs
  modified:
    - src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj
    - src/GlobCRM.Infrastructure/MultiTenancy/TenantProvider.cs
    - src/GlobCRM.Infrastructure/DependencyInjection.cs
    - src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs
    - src/GlobCRM.Domain/Enums/EntityType.cs
    - scripts/rls-setup.sql

key-decisions:
  - "DomainEventInterceptor uses AsyncLocal for pending events and dispatches after SaveChanges with fire-and-forget error handling"
  - "Interceptor chain order: TenantDbConnectionInterceptor -> AuditableEntityInterceptor -> DomainEventInterceptor"
  - "TenantProvider fallback order: Finbuckle -> JWT claim -> TenantScope AsyncLocal -> null"
  - "TemplateRenderService registered as singleton (FluidParser is thread-safe)"
  - "EmailTemplate.DesignJson stored as JSONB, HtmlBody as text column"

patterns-established:
  - "DomainEvent capture pattern: SavingChangesAsync captures entity states, SavedChangesAsync dispatches"
  - "TenantScope AsyncLocal pattern: background jobs set tenant via TenantJobFilter, resolved by TenantProvider"
  - "Hangfire queue naming: default, emails, webhooks, workflows"
  - "Service extension pattern: AddXxxServices() methods in feature directories for DI registration"

requirements-completed: [ETMPL-02, ETMPL-03]

# Metrics
duration: 9min
completed: 2026-02-19
---

# Phase 14 Plan 01: Foundation Infrastructure Summary

**Hangfire background jobs with PostgreSQL storage and tenant propagation, DomainEventInterceptor for entity lifecycle events, and EmailTemplate data layer with Fluid rendering and merge field resolution**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-19T01:56:44Z
- **Completed:** 2026-02-19T02:06:04Z
- **Tasks:** 2
- **Files modified:** 27

## Accomplishments
- Hangfire infrastructure with PostgreSQL storage, 4 named queues, and automatic tenant context propagation via TenantJobFilter/TenantScope
- DomainEventInterceptor capturing entity lifecycle events (Created/Updated/Deleted) with changed property tracking, dispatching via IDomainEventDispatcher after successful save
- EmailTemplate and EmailTemplateCategory entities with full EF configurations, migration applied, global query filters, and RLS policies
- TemplateRenderService using Fluid library for Liquid merge field rendering with fallback value support
- MergeFieldService providing merge field definitions for Contact, Company, Deal, Lead entities including custom fields from JSONB
- RBAC permissions auto-created for EmailTemplate entity type across all 4 role templates (Admin, Manager, Sales Rep, Viewer)

## Task Commits

Each task was committed atomically:

1. **Task 1: Hangfire infrastructure + DomainEventInterceptor + TenantProvider fallback** - `40f1986` (feat)
2. **Task 2: EmailTemplate entities, EF config, migration, RLS, RBAC, Fluid services** - `55bfdb1` (feat)

## Files Created/Modified

- `src/GlobCRM.Infrastructure/BackgroundJobs/HangfireServiceExtensions.cs` - Hangfire DI registration with PostgreSQL storage and 4 queues
- `src/GlobCRM.Infrastructure/BackgroundJobs/TenantJobFilter.cs` - IClientFilter/IServerFilter for tenant context propagation
- `src/GlobCRM.Infrastructure/BackgroundJobs/TenantScope.cs` - AsyncLocal for background job tenant context
- `src/GlobCRM.Infrastructure/DomainEvents/DomainEventInterceptor.cs` - SaveChangesInterceptor capturing entity lifecycle events
- `src/GlobCRM.Infrastructure/DomainEvents/DomainEventDispatcher.cs` - Dispatches events to IDomainEventHandler instances
- `src/GlobCRM.Infrastructure/DomainEvents/DomainEventServiceExtensions.cs` - DI registration for domain event services
- `src/GlobCRM.Domain/Interfaces/IDomainEvent.cs` - DomainEvent record and IDomainEventHandler interface
- `src/GlobCRM.Domain/Interfaces/IDomainEventDispatcher.cs` - IDomainEventDispatcher interface
- `src/GlobCRM.Domain/Entities/EmailTemplate.cs` - Email template entity with DesignJson, HtmlBody, Subject
- `src/GlobCRM.Domain/Entities/EmailTemplateCategory.cs` - Template category entity with SortOrder and IsSystem
- `src/GlobCRM.Infrastructure/Persistence/Configurations/EmailTemplateConfiguration.cs` - EF config with JSONB, FKs, indexes
- `src/GlobCRM.Infrastructure/Persistence/Configurations/EmailTemplateCategoryConfiguration.cs` - EF config with unique (tenant_id, name) index
- `src/GlobCRM.Infrastructure/EmailTemplates/EmailTemplateRepository.cs` - CRUD + Clone operations
- `src/GlobCRM.Infrastructure/EmailTemplates/TemplateRenderService.cs` - Fluid-based Liquid template rendering
- `src/GlobCRM.Infrastructure/EmailTemplates/MergeFieldService.cs` - Merge field definitions and entity data resolution
- `src/GlobCRM.Infrastructure/EmailTemplates/EmailTemplateServiceExtensions.cs` - DI registration
- `src/GlobCRM.Infrastructure/MultiTenancy/TenantProvider.cs` - Added TenantScope AsyncLocal fallback
- `src/GlobCRM.Infrastructure/DependencyInjection.cs` - Registered domain events, email templates, interceptor chain
- `src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs` - Added DbSets and query filters
- `src/GlobCRM.Domain/Enums/EntityType.cs` - Added EmailTemplate enum value
- `scripts/rls-setup.sql` - Added RLS policies for email_templates and email_template_categories

## Decisions Made

- DomainEventInterceptor uses `AsyncLocal<List<DomainEvent>?>` for thread-safe pending event storage across SavingChanges/SavedChanges boundary
- Interceptor chain order: TenantDbConnectionInterceptor (RLS) -> AuditableEntityInterceptor (timestamps) -> DomainEventInterceptor (final state capture)
- TenantProvider now has 3 fallback levels: Finbuckle -> JWT claim -> TenantScope AsyncLocal
- TemplateRenderService registered as singleton because FluidParser is thread-safe and reusable
- EmailTemplate.DesignJson stored as JSONB column type for efficient storage and potential querying
- MergeFieldService uses `CustomFieldDefinition.Name` (not FieldName) matching actual entity property names

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed MergeFieldService property name mismatches**
- **Found during:** Task 2 (MergeFieldService implementation)
- **Issue:** Plan referenced `FieldName` on CustomFieldDefinition (actual property is `Name`) and `Probability` on PipelineStage (actual property is `DefaultProbability`)
- **Fix:** Changed to correct property names matching the actual domain entities
- **Files modified:** src/GlobCRM.Infrastructure/EmailTemplates/MergeFieldService.cs
- **Verification:** Build succeeds with 0 errors
- **Committed in:** 55bfdb1 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed nullable warning in DomainEventInterceptor**
- **Found during:** Task 1 (DomainEventInterceptor implementation)
- **Issue:** CS8625 warning: assigning null to `AsyncLocal<List<DomainEvent>>` required nullable type annotation
- **Fix:** Changed type to `AsyncLocal<List<DomainEvent>?>` to correctly express nullability
- **Files modified:** src/GlobCRM.Infrastructure/DomainEvents/DomainEventInterceptor.cs
- **Verification:** Build succeeds with 0 warnings from our code
- **Committed in:** 40f1986 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bug fixes)
**Impact on plan:** Both fixes were necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Hangfire infrastructure ready for background job enqueuing in email sending (Plan 14-02)
- DomainEventInterceptor ready for webhook/workflow event dispatching (Phase 15, 19)
- EmailTemplate data layer complete, ready for API controllers and UI (Plans 14-02, 14-03, 14-04)
- TemplateRenderService and MergeFieldService ready for email send flow
- RBAC permissions auto-created, ready for controller authorization

## Self-Check: PASSED

All 16 created files verified present on disk. Both task commits (40f1986, 55bfdb1) verified in git log.

---
*Phase: 14-foundation-infrastructure-email-templates*
*Completed: 2026-02-19*
