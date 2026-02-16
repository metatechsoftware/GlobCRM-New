---
phase: 03-core-crm-entities
plan: 04
subsystem: api
tags: [ef-core, repository-pattern, pagination, jsonb, ownership-scope, seed-data, rbac]

# Dependency graph
requires:
  - phase: 03-core-crm-entities
    plan: 01
    provides: "Company, Contact, Product domain entities with EF Core configs and ApplicationDbContext DbSets"
  - phase: 02-core-infrastructure
    provides: "PermissionScope enum, RoleTemplateSeeder, CustomFieldRepository pattern, ApplicationDbContext"
provides:
  - "ICompanyRepository with GetPagedAsync supporting ownership scope (None/Own/Team/All)"
  - "IContactRepository with GetByCompanyIdAsync for company detail contacts tab"
  - "IProductRepository with GetPagedAsync (no ownership scope -- shared resources)"
  - "PagedResult<T> and EntityQueryParams in Domain/Common for cross-layer use"
  - "Server-side search, filter, sort, pagination for all 3 entity types"
  - "JSONB containment filtering via EF.Functions.JsonContains for custom field queries"
  - "TenantSeeder creates 2 companies, 5 contacts, 3 products with IsSeedData=true"
  - "RoleTemplateSeeder.EnsurePermissionsForAllEntityTypesAsync for existing tenants"
  - "CrmEntityServiceExtensions DI registration for 3 repositories"
affects: [03-05, 03-06, 03-07, 03-08, 03-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Repository pattern with server-side filter/sort/page using switch-based field mapping"
    - "Ownership scope filtering pattern: switch on PermissionScope for query restriction"
    - "Expression tree composition (ParameterReplacer) for type-safe string filter predicates"
    - "JSONB containment via EF.Functions.JsonContains for GIN-indexed custom field filtering"

key-files:
  created:
    - src/GlobCRM.Domain/Common/PagedResult.cs
    - src/GlobCRM.Domain/Common/EntityQueryParams.cs
    - src/GlobCRM.Api/Models/EntityQueryParams.cs
    - src/GlobCRM.Domain/Interfaces/ICompanyRepository.cs
    - src/GlobCRM.Domain/Interfaces/IContactRepository.cs
    - src/GlobCRM.Domain/Interfaces/IProductRepository.cs
    - src/GlobCRM.Infrastructure/Persistence/Repositories/CompanyRepository.cs
    - src/GlobCRM.Infrastructure/Persistence/Repositories/ContactRepository.cs
    - src/GlobCRM.Infrastructure/Persistence/Repositories/ProductRepository.cs
    - src/GlobCRM.Infrastructure/CrmEntities/CrmEntityServiceExtensions.cs
  modified:
    - src/GlobCRM.Infrastructure/MultiTenancy/TenantSeeder.cs
    - src/GlobCRM.Infrastructure/Authorization/RoleTemplateSeeder.cs
    - src/GlobCRM.Api/Program.cs

key-decisions:
  - "PagedResult<T> and EntityQueryParams in Domain/Common (not Api) so repository interfaces can reference them"
  - "Switch-based sorting with no dynamic LINQ dependency (per research Open Question 1)"
  - "Custom field sorting not supported (documented limitation -- would need raw SQL OrderBy)"
  - "Expression tree ParameterReplacer for composable string filter predicates that EF Core can translate"
  - "EnsurePermissionsForAllEntityTypesAsync called on every startup (idempotent, handles pre-Phase-3 tenants)"

patterns-established:
  - "CRM repository pattern: ownership scope + search + filters + sort + pagination pipeline"
  - "Custom field filter: FieldId.Length==36 && Guid.TryParse -> JSONB containment query"
  - "Default sort: CreatedAt descending when no sort field specified"
  - "Seed entity creation: iterate manifest, build entities with TenantId + IsSeedData=true, single SaveChangesAsync"

# Metrics
duration: 9min
completed: 2026-02-16
---

# Phase 3 Plan 04: Repository Layer & Seed Data Summary

**Server-side filter/sort/page repositories for Company/Contact/Product with ownership scope, JSONB custom field queries, seed data creation, and RBAC permission backfill**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-16T20:04:47Z
- **Completed:** 2026-02-16T20:13:51Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Created 3 repository interfaces and 3 EF Core implementations with full server-side query pipeline
- Ownership scope filtering (None/Own/Team/All) on Company and Contact repositories
- JSONB containment filtering via EF.Functions.JsonContains for custom field queries on all 3 entities
- TenantSeeder now creates 2 companies, 5 contacts, 3 products as actual database entities
- RoleTemplateSeeder backfills missing permissions for all EntityType values on existing tenants
- All 3 repositories registered via CrmEntityServiceExtensions DI pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared EntityQueryParams and repository interfaces/implementations** - `6795e64` (feat)
2. **Task 2: Update TenantSeeder and RoleTemplateSeeder for CRM entities** - `bc68cb8` (feat)

## Files Created/Modified
- `src/GlobCRM.Domain/Common/PagedResult.cs` - Generic paged result wrapper with TotalPages computation
- `src/GlobCRM.Domain/Common/EntityQueryParams.cs` - Shared query params with FilterParam for all entity list endpoints
- `src/GlobCRM.Api/Models/EntityQueryParams.cs` - Global using re-export for Api layer convenience
- `src/GlobCRM.Domain/Interfaces/ICompanyRepository.cs` - Company repository interface with ownership scope params
- `src/GlobCRM.Domain/Interfaces/IContactRepository.cs` - Contact repository interface with GetByCompanyIdAsync
- `src/GlobCRM.Domain/Interfaces/IProductRepository.cs` - Product repository interface without ownership scope
- `src/GlobCRM.Infrastructure/Persistence/Repositories/CompanyRepository.cs` - Full implementation with filter/sort/page/scope
- `src/GlobCRM.Infrastructure/Persistence/Repositories/ContactRepository.cs` - Full implementation with Company include
- `src/GlobCRM.Infrastructure/Persistence/Repositories/ProductRepository.cs` - Full implementation with isActive filter
- `src/GlobCRM.Infrastructure/CrmEntities/CrmEntityServiceExtensions.cs` - DI registration for 3 repositories
- `src/GlobCRM.Infrastructure/MultiTenancy/TenantSeeder.cs` - Creates Company, Contact, Product entities from manifest
- `src/GlobCRM.Infrastructure/Authorization/RoleTemplateSeeder.cs` - EnsurePermissionsForAllEntityTypesAsync added
- `src/GlobCRM.Api/Program.cs` - AddCrmEntityServices() registration

## Decisions Made
- PagedResult<T> and EntityQueryParams placed in Domain/Common (not Api/Models) so Domain repository interfaces can reference them without cross-project dependency issues
- Switch-based field sorting used instead of System.Linq.Dynamic.Core (no additional dependency, per research recommendation)
- Custom field sorting documented as unsupported (would need raw SQL OrderBy for JSONB key extraction)
- ParameterReplacer expression visitor used to compose selector + predicate expressions for type-safe EF Core translation
- EnsurePermissionsForAllEntityTypesAsync runs on every startup via SeedAllTenantsAsync (idempotent -- only adds missing permissions)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 3 repository interfaces and implementations ready for controller injection (Plan 05)
- PagedResult<T> and EntityQueryParams ready for API endpoint DTOs
- Ownership scope filtering ready for permission service integration in controllers
- Seed data creation ready -- new organizations get 2 companies, 5 contacts, 3 products
- All EntityType permissions seeded for template roles (Admin/Manager/Sales Rep/Viewer)

## Self-Check: PASSED

- All 10 created files verified on disk
- Both task commits (6795e64, bc68cb8) verified in git log
- Solution build: 0 errors, 1 pre-existing analyzer warning

---
*Phase: 03-core-crm-entities*
*Completed: 2026-02-16*
