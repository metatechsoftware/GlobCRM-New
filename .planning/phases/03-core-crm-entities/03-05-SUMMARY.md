---
phase: 03-core-crm-entities
plan: 05
subsystem: api
tags: [rest-api, controllers, crud, permission-enforcement, ownership-scope, custom-fields, timeline, fluent-validation]

# Dependency graph
requires:
  - phase: 03-core-crm-entities
    plan: 01
    provides: "Company, Contact, Product domain entities with EF Core configs and ApplicationDbContext DbSets"
  - phase: 03-core-crm-entities
    plan: 04
    provides: "ICompanyRepository, IContactRepository, IProductRepository with GetPagedAsync, ownership scope, seed data"
  - phase: 02-core-infrastructure
    provides: "IPermissionService, CustomFieldValidator, PermissionPolicyProvider for dynamic policy resolution"
provides:
  - "CompaniesController with 7 REST endpoints (CRUD + timeline + company contacts)"
  - "ContactsController with 6 REST endpoints (CRUD + timeline)"
  - "ProductsController with 5 REST endpoints (CRUD)"
  - "Ownership scope enforcement on Company and Contact list and detail endpoints"
  - "Custom field validation on create and update for all 3 entity types"
  - "Timeline endpoints returning creation, update, and link events for companies and contacts"
  - "DTOs: CompanyListDto, CompanyDetailDto, ContactListDto, ContactDetailDto, ProductListDto, ProductDetailDto, TimelineEntryDto"
affects: [03-06, 03-07, 03-08, 03-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CRM controller pattern: permission policy + ownership scope + custom field validation + DTO mapping"
    - "IsWithinScope helper: switch on PermissionScope for entity-level access control"
    - "GetTeamMemberIds: two-step query (user teams -> team members) for Team scope filtering"
    - "Timeline generation: aggregated events from entity lifecycle + relationship links"

key-files:
  created:
    - src/GlobCRM.Api/Controllers/CompaniesController.cs
    - src/GlobCRM.Api/Controllers/ContactsController.cs
    - src/GlobCRM.Api/Controllers/ProductsController.cs
  modified: []

key-decisions:
  - "Ownership scope checked on both list (via repository) and detail (via IsWithinScope helper) endpoints"
  - "Team member IDs resolved via ApplicationDbContext.TeamMembers (two-step: user teams -> all team members)"
  - "Products have no ownership scope -- shared tenant resources per domain model design"
  - "Timeline uses 1-second threshold for UpdatedAt vs CreatedAt comparison to avoid false update events"
  - "CompanyId validation on Contact create/update ensures referential integrity before save"

patterns-established:
  - "CRM controller pattern: [Authorize(Policy = Permission:Entity:Op)] + scope check + custom field validation"
  - "Ownership scope verification: IsWithinScope(ownerId, scope, userId, teamMemberIds) static helper"
  - "DTO FromEntity pattern: static factory method on record DTOs for entity-to-DTO mapping"
  - "FluentValidation inline validators for request DTOs (following CustomFieldsController pattern)"

# Metrics
duration: 4min
completed: 2026-02-16
---

# Phase 3 Plan 05: API Controllers Summary

**REST API controllers for Company, Contact, and Product with 18 total endpoints, ownership scope enforcement, custom field validation, and timeline generation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-16T20:17:57Z
- **Completed:** 2026-02-16T20:22:17Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created 3 API controllers with 18 total REST endpoints across Company (7), Contact (6), and Product (5)
- Ownership scope enforcement on Company and Contact list and detail endpoints (Own/Team/All via IPermissionService)
- Custom field validation via CustomFieldValidator on create and update for all 3 entity types
- Timeline endpoints for Company (creation, update, linked contacts) and Contact (creation, update, company link)
- FluentValidation for all create/update request DTOs
- Products controller with no ownership scope (shared tenant resources) and default active filtering

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CompaniesController and ContactsController** - `51a63de` (feat)
2. **Task 2: Create ProductsController** - `f08ea88` (feat)

## Files Created/Modified
- `src/GlobCRM.Api/Controllers/CompaniesController.cs` - 7 endpoints: CRUD + timeline + company contacts, ownership scope, DTOs
- `src/GlobCRM.Api/Controllers/ContactsController.cs` - 6 endpoints: CRUD + timeline, ownership scope, company link validation, DTOs
- `src/GlobCRM.Api/Controllers/ProductsController.cs` - 5 endpoints: CRUD, no ownership scope, active filtering, DTOs

## Decisions Made
- Ownership scope verified on both list (via repository GetPagedAsync) AND detail endpoints (via IsWithinScope helper) per plan Pitfall 3
- Team member IDs resolved via ApplicationDbContext.TeamMembers directly (two queries: user's teams, then all members of those teams) since IPermissionService doesn't expose team queries
- Products have no ownership scope per domain model (Product has no OwnerId) -- any user with Product:View permission can see all products
- Timeline uses 1-second threshold when comparing UpdatedAt vs CreatedAt to avoid false update events from near-simultaneous timestamps
- CompanyId validated on Contact create/update by calling GetByIdAsync to ensure the referenced company exists

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 18 REST endpoints ready for Angular frontend service integration (Plan 06)
- DTOs match the Angular model interfaces defined in Plan 02
- Permission enforcement matches the frontend PermissionStore pattern
- Timeline endpoints ready for the timeline UI component from Plan 03
- Company contacts endpoint ready for the company detail contacts tab

## Self-Check: PASSED

- All 3 created files verified on disk
- Both task commits (51a63de, f08ea88) verified in git log
- Solution build: 0 errors, 1 pre-existing analyzer warning

---
*Phase: 03-core-crm-entities*
*Completed: 2026-02-16*
