---
phase: 02-core-infrastructure
plan: 02
subsystem: database
tags: [ef-core, jsonb, npgsql, custom-fields, saved-views, postgresql, rls]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "ApplicationDbContext, Organization entity, EF Core interceptors, RLS script"
provides:
  - "CustomFieldDefinition entity with 9 field types, JSONB validation, soft delete"
  - "CustomFieldSection entity for admin-defined field grouping"
  - "SavedView entity with JSONB column/filter/sort configuration"
  - "CustomFieldType enum (Text, Number, Date, Dropdown, Checkbox, MultiSelect, Currency, File, Relation)"
  - "EnableDynamicJson() on NpgsqlDataSourceBuilder for JSONB serialization"
  - "EF Core migration AddCustomFieldsAndViews"
  - "RLS policies for custom_field_definitions, custom_field_sections, saved_views"
affects: [custom-field-api, saved-view-api, entity-pages, admin-settings, dynamic-tables]

# Tech tracking
tech-stack:
  added: [NpgsqlDataSourceBuilder.EnableDynamicJson]
  patterns: [jsonb-value-types, soft-delete-with-filtered-index, combined-tenant-softdelete-query-filter]

key-files:
  created:
    - src/GlobCRM.Domain/Enums/CustomFieldType.cs
    - src/GlobCRM.Domain/Entities/CustomFieldDefinition.cs
    - src/GlobCRM.Domain/Entities/CustomFieldSection.cs
    - src/GlobCRM.Domain/Entities/CustomFieldValidation.cs
    - src/GlobCRM.Domain/Entities/FieldOption.cs
    - src/GlobCRM.Domain/Entities/SavedView.cs
    - src/GlobCRM.Domain/Entities/ViewColumn.cs
    - src/GlobCRM.Domain/Entities/ViewFilter.cs
    - src/GlobCRM.Domain/Entities/ViewSort.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/CustomFieldDefinitionConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/CustomFieldSectionConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/SavedViewConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260216153400_AddCustomFieldsAndViews.cs
  modified:
    - src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs
    - src/GlobCRM.Infrastructure/DependencyInjection.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/ApplicationUserConfiguration.cs
    - scripts/rls-setup.sql

key-decisions:
  - "JSONB value types (CustomFieldValidation, FieldOption, ViewColumn, ViewFilter, ViewSort) mapped via HasColumnType('jsonb') -- not separate tables"
  - "Soft-delete unique constraint uses HasFilter('NOT is_deleted') to allow reuse of deleted field names"
  - "CustomFieldDefinition query filter combines tenant isolation AND soft-delete in single expression"
  - "NpgsqlDataSourceBuilder with EnableDynamicJson() shared by both TenantDbContext and ApplicationDbContext"

patterns-established:
  - "JSONB value type mapping: use HasColumnType('jsonb') with HasDefaultValueSql for non-null defaults"
  - "Soft-delete filtered index: HasFilter('NOT is_deleted') on unique constraints"
  - "Combined query filter: tenant AND soft-delete in single HasQueryFilter expression"
  - "NpgsqlDataSource shared across DbContexts for consistent JSONB behavior"

# Metrics
duration: 6min
completed: 2026-02-16
---

# Phase 2 Plan 2: Custom Fields & Saved Views Summary

**Custom field definition entities with 9 field types, JSONB validation/options, soft delete, and saved view entities with JSONB column/filter/sort configuration -- powered by EnableDynamicJson() for Npgsql JSONB serialization**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-16T15:29:38Z
- **Completed:** 2026-02-16T15:35:38Z
- **Tasks:** 2
- **Files modified:** 22 (9 domain entities + 3 EF configs + 3 migration files + 4 modified files + 3 JSONB value types)

## Accomplishments

- CustomFieldDefinition entity supporting all 9 field types (Text, Number, Date, Dropdown, Checkbox, MultiSelect, Currency, File, Relation) with JSONB validation rules, dropdown options, soft delete, and section grouping
- SavedView entity with JSONB-backed column layout, filter conditions, sort configuration, personal/team views, and page-based pagination (default 25)
- EnableDynamicJson() configured on NpgsqlDataSourceBuilder for proper JSONB serialization of complex types
- EF Core migration generated with correct table definitions, JSONB columns, filtered indexes, and FK relationships
- RLS policies added for all three new tables (Layer 3 tenant isolation)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create custom field and saved view domain entities and enums** - `34d6992` (feat)
2. **Task 2: Create EF Core configurations, configure EnableDynamicJson, update ApplicationDbContext and RLS, create migration** - `b45fef6` (feat)

## Files Created/Modified

- `src/GlobCRM.Domain/Enums/CustomFieldType.cs` - Enum with 9 custom field types
- `src/GlobCRM.Domain/Entities/CustomFieldDefinition.cs` - Admin-created field metadata with JSONB validation/options
- `src/GlobCRM.Domain/Entities/CustomFieldSection.cs` - Section grouping for custom fields
- `src/GlobCRM.Domain/Entities/CustomFieldValidation.cs` - JSONB value type for validation rules
- `src/GlobCRM.Domain/Entities/FieldOption.cs` - JSONB value type for dropdown/multiselect options
- `src/GlobCRM.Domain/Entities/SavedView.cs` - Saved table view with column/filter/sort JSONB
- `src/GlobCRM.Domain/Entities/ViewColumn.cs` - JSONB value type for column configuration
- `src/GlobCRM.Domain/Entities/ViewFilter.cs` - JSONB value type for filter conditions
- `src/GlobCRM.Domain/Entities/ViewSort.cs` - JSONB value type for sort configuration
- `src/GlobCRM.Infrastructure/Persistence/Configurations/CustomFieldDefinitionConfiguration.cs` - EF Core config with soft-delete filtered unique index
- `src/GlobCRM.Infrastructure/Persistence/Configurations/CustomFieldSectionConfiguration.cs` - EF Core config with tenant-entity constraints
- `src/GlobCRM.Infrastructure/Persistence/Configurations/SavedViewConfiguration.cs` - EF Core config with JSONB defaults and owner FK
- `src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs` - Added DbSets and query filters
- `src/GlobCRM.Infrastructure/DependencyInjection.cs` - Added NpgsqlDataSourceBuilder with EnableDynamicJson()
- `src/GlobCRM.Infrastructure/Persistence/Configurations/ApplicationUserConfiguration.cs` - Added rich profile JSONB mappings (Rule 3 fix)
- `scripts/rls-setup.sql` - Added RLS policies for 3 new tables

## Decisions Made

- JSONB value types (CustomFieldValidation, FieldOption, ViewColumn, ViewFilter, ViewSort) mapped as JSONB columns on parent entities, not as separate database tables -- consistent with plan and optimal for read performance
- Soft-delete unique constraint uses `HasFilter("NOT is_deleted")` allowing deleted field names to be reused
- CustomFieldDefinition combines both tenant isolation AND soft-delete in a single query filter expression
- NpgsqlDataSourceBuilder with EnableDynamicJson() is shared across both TenantDbContext and ApplicationDbContext via the data source object

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing ApplicationUserConfiguration JSONB mappings for parallel Plan 02-03 entities**
- **Found during:** Task 2 (Migration creation)
- **Issue:** Plan 02-03 (User Profile) added SocialLinks, WorkSchedule, Skills, and Preferences properties to ApplicationUser with Dictionary/complex types, but did not update ApplicationUserConfiguration to map them as JSONB. EF Core migration creation failed with: "Unable to determine the relationship represented by navigation 'UserPreferencesData.EmailNotifications' of type 'Dictionary<string, bool>'"
- **Fix:** Added JSONB column mappings for SocialLinks, Skills, WorkSchedule (OwnsOne/ToJson), and Preferences (OwnsOne/ToJson) in ApplicationUserConfiguration. Also added Phone, JobTitle, Department, Timezone, Language, Bio, AvatarUrl, AvatarColor column mappings and ReportingManagerId FK.
- **Files modified:** `src/GlobCRM.Infrastructure/Persistence/Configurations/ApplicationUserConfiguration.cs`
- **Verification:** `dotnet build` succeeds, `dotnet ef migrations add` succeeds
- **Committed in:** `b45fef6` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix necessary to unblock migration creation. No scope creep -- these are column mappings for entities already present from a parallel plan.

## Issues Encountered

- Migration includes RBAC entities (roles, teams, etc.) from parallel Plan 02-01 since EF Core captures all pending model changes in a single migration. This is expected behavior when plans execute in parallel and is not a problem -- the tables will be created correctly regardless of which plan generated the migration.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Custom field and saved view domain model complete, ready for API endpoints and CRUD operations
- EnableDynamicJson() configured for JSONB serialization of complex types
- Migration ready to apply when database is available

## Self-Check: PASSED

- All 14 created files verified present on disk
- Both task commits (34d6992, b45fef6) verified in git log
- Key content verified: CustomFieldType enum values, EnableDynamicJson, DbSets, RLS policies

---
*Phase: 02-core-infrastructure*
*Completed: 2026-02-16*
