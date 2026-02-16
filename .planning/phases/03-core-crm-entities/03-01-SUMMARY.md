---
phase: 03-core-crm-entities
plan: 01
subsystem: database
tags: [ef-core, postgresql, jsonb, rls, domain-entities, multi-tenancy]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "ApplicationDbContext, RLS script, triple-layer tenant isolation pattern"
  - phase: 02-core-infrastructure
    provides: "CustomFieldDefinition JSONB pattern, global query filter pattern, ApplicationUser entity"
provides:
  - "Company domain entity with TenantId, JSONB custom fields, OwnerId, Contacts navigation"
  - "Contact domain entity with nullable CompanyId FK, FullName computed property"
  - "Product domain entity with UnitPrice decimal(18,4), SKU unique per tenant, IsActive"
  - "EF Core configurations with snake_case columns, GIN indexes, JSONB defaults"
  - "ApplicationDbContext DbSets (Companies, Contacts, Products) with global query filters"
  - "RLS policies for companies, contacts, products tables"
  - "AddCrmEntities migration creating all 3 tables with indexes"
affects: [03-02, 03-03, 03-04, 03-05, 03-06, 03-07, 03-08, 03-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CRM entity pattern: Guid Id, TenantId, CustomFields JSONB, IsSeedData, CreatedAt/UpdatedAt"
    - "Nullable FK pattern: Contact.CompanyId -> Company.Id with SetNull delete behavior"
    - "Filtered unique index: SKU unique per tenant with NULL filter"

key-files:
  created:
    - src/GlobCRM.Domain/Entities/Company.cs
    - src/GlobCRM.Domain/Entities/Contact.cs
    - src/GlobCRM.Domain/Entities/Product.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/CompanyConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/ContactConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/ProductConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260216194320_AddCrmEntities.cs
  modified:
    - src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs
    - scripts/rls-setup.sql

key-decisions:
  - "No Organization navigation on CRM entities -- TenantId is raw Guid with query filter only (per Pitfall 2)"
  - "Contact-Company is nullable FK (not join table) per CONT-03 and Pitfall 5"
  - "Product has no OwnerId -- products are shared tenant resources"

patterns-established:
  - "CRM entity domain pattern: Id, TenantId, core fields, CustomFields JSONB, IsSeedData, audit timestamps"
  - "CRM EF config pattern: snake_case table/columns, JSONB with GIN index, tenant index, owner index"
  - "Triple-layer isolation for CRM entities: TenantId + query filter + RLS policy"

# Metrics
duration: 3min
completed: 2026-02-16
---

# Phase 3 Plan 01: Domain Entities & Data Foundation Summary

**Company, Contact, Product domain entities with EF Core JSONB configs, GIN indexes, triple-layer tenant isolation, and AddCrmEntities migration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-16T19:40:58Z
- **Completed:** 2026-02-16T19:44:12Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Created Company, Contact, Product domain entities with full property sets matching research specification
- Built 3 EF Core configurations with snake_case columns, JSONB custom_fields with GIN indexes, and proper FK relationships
- Updated ApplicationDbContext with 3 new DbSets and 3 global query filters for tenant isolation
- Added RLS policies for companies, contacts, products tables (Layer 3 of triple-layer defense)
- Generated AddCrmEntities migration with all CreateTable operations, FK constraints, and indexes
- Product configured with decimal(18,4) precision for UnitPrice and filtered unique SKU index per tenant

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Company, Contact, Product domain entities** - `d783c66` (feat)
2. **Task 2: Create EF Core configurations, update ApplicationDbContext, update RLS, create migration** - `6e6e4c9` (feat)

## Files Created/Modified
- `src/GlobCRM.Domain/Entities/Company.cs` - Company entity with TenantId, OwnerId, CustomFields JSONB, Contacts navigation
- `src/GlobCRM.Domain/Entities/Contact.cs` - Contact entity with nullable CompanyId FK, FullName computed property
- `src/GlobCRM.Domain/Entities/Product.cs` - Product entity with UnitPrice, SKU, Category, IsActive
- `src/GlobCRM.Infrastructure/Persistence/Configurations/CompanyConfiguration.cs` - snake_case, JSONB, GIN, owner FK
- `src/GlobCRM.Infrastructure/Persistence/Configurations/ContactConfiguration.cs` - snake_case, CompanyId FK, FullName ignored
- `src/GlobCRM.Infrastructure/Persistence/Configurations/ProductConfiguration.cs` - decimal precision, filtered unique SKU
- `src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs` - 3 new DbSets + 3 query filters + 3 configs
- `scripts/rls-setup.sql` - RLS policies for companies, contacts, products tables
- `src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260216194320_AddCrmEntities.cs` - Migration
- `src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260216194320_AddCrmEntities.Designer.cs` - Migration snapshot

## Decisions Made
- No Organization navigation property on CRM entities -- TenantId is raw Guid with query filter only (per research Pitfall 2, avoids ExcludeFromMigrations cross-context issues)
- Contact-Company relationship is a simple nullable FK (not a join table) per CONT-03 and Pitfall 5
- Product has no OwnerId -- products are shared tenant resources, not individually owned
- FullName on Contact is a computed property (ignored in EF config, not stored in database)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 3 domain entities ready for repository, controller, and frontend CRUD implementation
- Triple-layer tenant isolation configured for all entities
- JSONB custom fields with GIN indexes ready for custom field integration
- Contact-Company FK relationship ready for relational navigation
- Product fields (UnitPrice, SKU, IsActive) ready for Phase 6 quote line items

## Self-Check: PASSED

- All 7 created files verified on disk
- Both task commits (d783c66, 6e6e4c9) verified in git log
- Solution build: 0 errors, 0 warnings (1 pre-existing analyzer warning)

---
*Phase: 03-core-crm-entities*
*Completed: 2026-02-16*
