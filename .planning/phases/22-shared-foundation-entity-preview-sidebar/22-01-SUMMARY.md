---
phase: 22-shared-foundation-entity-preview-sidebar
plan: 01
subsystem: ui, api, database
tags: [angular, entity-registry, ef-core, migration, feed-items, custom-fields, tabs]

# Dependency graph
requires: []
provides:
  - EntityTypeRegistry constant map with icon/label/color/route for 6 entity types
  - Label-based tab matching in all detail pages (safe for future tab insertion)
  - entity_name denormalized column on feed_items with backfill migration
  - ShowInPreview boolean flag on custom_field_definitions
  - FeedItemDto includes entityName in API responses
affects: [22-02, 22-03, 22-04, phase-23]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "EntityTypeRegistry: centralized constant map for entity type metadata (icon, label, route, color)"
    - "Label-based tab matching: RelatedEntityTabsComponent emits string labels, detail pages match on label text"
    - "Feed item entity_name denormalization: populate EntityName at creation time for hover tooltips"

key-files:
  created:
    - globcrm-web/src/app/shared/services/entity-type-registry.ts
    - src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260219230958_AddEntityNameAndShowInPreview.cs
  modified:
    - globcrm-web/src/app/shared/components/related-entity-tabs/related-entity-tabs.component.ts
    - globcrm-web/src/app/features/contacts/contact-detail/contact-detail.component.ts
    - globcrm-web/src/app/features/companies/company-detail/company-detail.component.ts
    - globcrm-web/src/app/features/deals/deal-detail/deal-detail.component.ts
    - globcrm-web/src/app/features/leads/lead-detail/lead-detail.component.ts
    - globcrm-web/src/app/features/activities/activity-detail/activity-detail.component.ts
    - globcrm-web/src/app/features/feed/feed.models.ts
    - src/GlobCRM.Domain/Entities/FeedItem.cs
    - src/GlobCRM.Domain/Entities/CustomFieldDefinition.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/FeedItemConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/CustomFieldDefinitionConfiguration.cs
    - src/GlobCRM.Api/Controllers/FeedController.cs
    - src/GlobCRM.Api/Controllers/DealsController.cs
    - src/GlobCRM.Api/Controllers/LeadsController.cs
    - src/GlobCRM.Api/Controllers/ActivitiesController.cs
    - src/GlobCRM.Api/Controllers/CustomFieldsController.cs
    - src/GlobCRM.Infrastructure/MultiTenancy/TenantSeeder.cs
    - src/GlobCRM.Infrastructure/Gmail/GmailSyncService.cs
    - src/GlobCRM.Infrastructure/Notifications/DueDateNotificationService.cs

key-decisions:
  - "EntityTypeRegistry as pure constant map (not injectable service) for tree-shaking and simplicity"
  - "Tab refactor emits label strings from RelatedEntityTabsComponent; activity-detail uses local TAB_LABELS array since it uses mat-tab-group directly"
  - "EntityName backfill via raw SQL in migration Up method joining against source entity tables"
  - "ShowInPreview on CreateCustomFieldRequest is non-nullable bool (default false); on UpdateCustomFieldRequest is nullable bool for partial updates"

patterns-established:
  - "EntityTypeRegistry pattern: import ENTITY_TYPE_REGISTRY or getEntityConfig() from shared/services/entity-type-registry.ts"
  - "Tab label matching pattern: all detail pages compare tab labels as strings, never indices"
  - "Feed item EntityName pattern: every new FeedItem with EntityType/EntityId must also set EntityName"

requirements-completed: []

# Metrics
duration: 25min
completed: 2026-02-19
---

# Phase 22 Plan 01: Shared Foundation Summary

**EntityTypeRegistry constant map, label-based tab refactor across 5 detail pages, entity_name denormalization on feed_items with SQL backfill, and ShowInPreview flag on custom field definitions**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-02-19T22:50:00Z
- **Completed:** 2026-02-19T23:15:41Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments
- Created centralized EntityTypeRegistry with icon, label, color, and route for all 6 entity types (Contact, Company, Deal, Lead, Activity, Product)
- Refactored all 5 detail pages from index-based to label-based tab matching, making tab insertion safe for Phase 23
- Added entity_name column to feed_items with EF Core migration including SQL backfill from source entity tables
- Added ShowInPreview boolean to custom_field_definitions, exposed through CustomFieldsController CRUD
- Updated all 13 feed item creation points across the codebase to populate EntityName

## Task Commits

Each task was committed atomically:

1. **Task 1: EntityTypeRegistry + Tab index refactor (frontend)** - `34fbb3a` (feat)
2. **Task 2: Backend entity_name + ShowInPreview migrations and feed item updates** - `a53bf1c` (feat)

## Files Created/Modified

### Created
- `globcrm-web/src/app/shared/services/entity-type-registry.ts` - Centralized entity type metadata map with 6 entity configs and helper functions
- `src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260219230958_AddEntityNameAndShowInPreview.cs` - EF Core migration adding entity_name to feed_items and show_in_preview to custom_field_definitions with SQL backfill

### Modified (Frontend)
- `globcrm-web/src/app/shared/components/related-entity-tabs/related-entity-tabs.component.ts` - Changed tabChanged output from number to string, emits tab.label
- `globcrm-web/src/app/features/contacts/contact-detail/contact-detail.component.ts` - Label-based tab matching (Activities, Quotes, Requests, Emails, Notes)
- `globcrm-web/src/app/features/companies/company-detail/company-detail.component.ts` - Label-based tab matching (Contacts, Activities, Quotes, Requests, Emails, Notes)
- `globcrm-web/src/app/features/deals/deal-detail/deal-detail.component.ts` - Label-based tab matching (Activities, Quotes, Notes)
- `globcrm-web/src/app/features/leads/lead-detail/lead-detail.component.ts` - Label-based tab matching (Activities, Notes)
- `globcrm-web/src/app/features/activities/activity-detail/activity-detail.component.ts` - TAB_LABELS array for label resolution from mat-tab-group indices
- `globcrm-web/src/app/features/feed/feed.models.ts` - Added entityName field to FeedItemDto

### Modified (Backend - Domain/Infrastructure)
- `src/GlobCRM.Domain/Entities/FeedItem.cs` - Added EntityName property
- `src/GlobCRM.Domain/Entities/CustomFieldDefinition.cs` - Added ShowInPreview property
- `src/GlobCRM.Infrastructure/Persistence/Configurations/FeedItemConfiguration.cs` - entity_name column mapping
- `src/GlobCRM.Infrastructure/Persistence/Configurations/CustomFieldDefinitionConfiguration.cs` - show_in_preview column mapping

### Modified (Backend - Controllers/Services)
- `src/GlobCRM.Api/Controllers/FeedController.cs` - EntityName in FeedItemDto and FeedItemDetailDto
- `src/GlobCRM.Api/Controllers/DealsController.cs` - EntityName on 3 feed item creation points
- `src/GlobCRM.Api/Controllers/LeadsController.cs` - EntityName on 4 feed item creation points
- `src/GlobCRM.Api/Controllers/ActivitiesController.cs` - EntityName on 2 feed item creation points
- `src/GlobCRM.Api/Controllers/CustomFieldsController.cs` - ShowInPreview in DTO, create/update requests and handlers
- `src/GlobCRM.Infrastructure/MultiTenancy/TenantSeeder.cs` - EntityName on 2 seed feed items
- `src/GlobCRM.Infrastructure/Gmail/GmailSyncService.cs` - EntityName on email feed item
- `src/GlobCRM.Infrastructure/Notifications/DueDateNotificationService.cs` - EntityName on due date feed item

## Decisions Made
- EntityTypeRegistry implemented as a pure constant map (not an Angular service) for simplicity and tree-shaking - it's just static data
- Tab refactor uses label strings rather than enums since the labels are already defined in tab configurations and enum would add unnecessary indirection
- Activity-detail page uses a local TAB_LABELS array since it uses mat-tab-group directly (not RelatedEntityTabsComponent)
- EntityName backfill uses raw SQL UPDATE with JOINs in the migration Up method rather than application-level backfill, since it's a one-time data migration
- ShowInPreview on CreateCustomFieldRequest is a non-nullable bool (defaults false) while UpdateCustomFieldRequest uses nullable bool for partial update semantics

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- EntityTypeRegistry is ready for use by the preview sidebar (22-02) for entity routing, icons, and labels
- Label-based tab matching is ready for Phase 23 safe tab insertion
- entity_name column is ready for hover tooltips in the feed and preview sidebar
- ShowInPreview flag is ready for preview custom field filtering in 22-03
- Migration needs to be applied to the database: `cd src/GlobCRM.Api && dotnet ef database update --context ApplicationDbContext --project ../GlobCRM.Infrastructure`

## Self-Check: PASSED

- entity-type-registry.ts: FOUND
- migration file: FOUND
- Commit 34fbb3a (Task 1): FOUND
- Commit a53bf1c (Task 2): FOUND

---
*Phase: 22-shared-foundation-entity-preview-sidebar*
*Completed: 2026-02-19*
