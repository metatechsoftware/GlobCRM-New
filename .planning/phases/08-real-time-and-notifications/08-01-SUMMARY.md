---
phase: 08-real-time-and-notifications
plan: 01
subsystem: database
tags: [ef-core, postgresql, notifications, activity-feed, rls, multi-tenancy]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "ApplicationDbContext, RLS setup, multi-tenant infrastructure"
  - phase: 02-core-infrastructure
    provides: "ApplicationUser entity, RBAC model, query filter patterns"
provides:
  - "Notification, NotificationPreference, FeedItem, FeedComment domain entities"
  - "NotificationType, NotificationChannel, FeedItemType enums"
  - "INotificationRepository, IFeedRepository interfaces"
  - "EF Core configurations with snake_case naming and indexes"
  - "Database tables: notifications, notification_preferences, feed_items, feed_comments"
  - "RLS policies for notifications, notification_preferences, feed_items"
  - "Global query filters for Notification, NotificationPreference, FeedItem"
affects: [08-02, 08-03, 08-04, 08-05, 08-06, 08-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Notification entity with entity-type/entity-id polymorphic linking for deep links"
    - "FeedComment child entity without TenantId (inherits isolation via FeedItem FK)"
    - "NotificationPreference with unique constraint on (TenantId, UserId, NotificationType)"

key-files:
  created:
    - src/GlobCRM.Domain/Entities/Notification.cs
    - src/GlobCRM.Domain/Entities/NotificationPreference.cs
    - src/GlobCRM.Domain/Entities/FeedItem.cs
    - src/GlobCRM.Domain/Entities/FeedComment.cs
    - src/GlobCRM.Domain/Enums/NotificationType.cs
    - src/GlobCRM.Domain/Enums/NotificationChannel.cs
    - src/GlobCRM.Domain/Enums/FeedItemType.cs
    - src/GlobCRM.Domain/Interfaces/INotificationRepository.cs
    - src/GlobCRM.Domain/Interfaces/IFeedRepository.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/NotificationConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/NotificationPreferenceConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/FeedItemConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/FeedCommentConfiguration.cs
  modified:
    - src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs
    - scripts/rls-setup.sql

key-decisions:
  - "Notification.UserId is nullable Guid? to support SetNull FK delete behavior"
  - "FeedComment has no TenantId -- inherits tenant isolation via FeedItem FK (matching child entity pattern)"
  - "NotificationPreference uses Cascade delete on UserId (prefs removed with user)"

patterns-established:
  - "Notification polymorphic entity linking: EntityType string + EntityId Guid for deep-link navigation"
  - "Per-type notification preferences: unique (TenantId, UserId, NotificationType) with in-app and email toggles"

# Metrics
duration: 4min
completed: 2026-02-17
---

# Phase 8 Plan 1: Notification & Feed Domain Model Summary

**Four domain entities (Notification, NotificationPreference, FeedItem, FeedComment), three enums, two repository interfaces, EF Core configurations with migration, and RLS policies for tenant-isolated notification and feed subsystems**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-17T16:25:34Z
- **Completed:** 2026-02-17T16:29:38Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments
- Four domain entities with correct properties, FK relationships, and audit timestamps
- Three enums covering notification types, delivery channels, and feed item categories
- Two repository interfaces with full CRUD signatures for notifications and feed
- Four EF Core configurations with snake_case naming, string-mapped enums, and composite indexes
- Migration applied cleanly creating all four database tables with correct columns and indexes
- RLS policies for notifications, notification_preferences, and feed_items (feed_comments inherits via FK)
- Global query filters on Notification, NotificationPreference, and FeedItem for tenant isolation

## Task Commits

Each task was committed atomically:

1. **Task 1: Domain entities and enums for notifications and feed** - `764f56a` (feat)
2. **Task 2: EF Core configurations, DbContext update, migration, and RLS** - `96dbe1e` (feat)

## Files Created/Modified
- `src/GlobCRM.Domain/Enums/NotificationType.cs` - ActivityAssigned, DealStageChanged, Mention, DueDateApproaching, EmailReceived
- `src/GlobCRM.Domain/Enums/NotificationChannel.cs` - InApp, Email delivery channels
- `src/GlobCRM.Domain/Enums/FeedItemType.cs` - SystemEvent, SocialPost feed categories
- `src/GlobCRM.Domain/Entities/Notification.cs` - In-app notification with user targeting and entity linking
- `src/GlobCRM.Domain/Entities/NotificationPreference.cs` - Per-type delivery preferences with in-app/email toggles
- `src/GlobCRM.Domain/Entities/FeedItem.cs` - Activity feed entry for system events and social posts
- `src/GlobCRM.Domain/Entities/FeedComment.cs` - Comment on feed item (child entity, no TenantId)
- `src/GlobCRM.Domain/Interfaces/INotificationRepository.cs` - Notification CRUD with paged listing and mark-as-read
- `src/GlobCRM.Domain/Interfaces/IFeedRepository.cs` - Feed CRUD with paged listing and comment management
- `src/GlobCRM.Infrastructure/Persistence/Configurations/NotificationConfiguration.cs` - snake_case, composite indexes for unread/paged queries
- `src/GlobCRM.Infrastructure/Persistence/Configurations/NotificationPreferenceConfiguration.cs` - Unique index on (tenant, user, type)
- `src/GlobCRM.Infrastructure/Persistence/Configurations/FeedItemConfiguration.cs` - Indexes for paged feed and entity-scoped queries
- `src/GlobCRM.Infrastructure/Persistence/Configurations/FeedCommentConfiguration.cs` - Cascade delete from FeedItem
- `src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs` - 4 new DbSets, 4 configurations, 3 query filters
- `scripts/rls-setup.sql` - RLS policies for notifications, notification_preferences, feed_items

## Decisions Made
- Notification.UserId made nullable (Guid?) to support SetNull FK delete behavior -- plan specified both non-nullable Guid and SetNull delete which are incompatible; nullable is correct for SetNull pattern
- FeedComment has no TenantId -- inherits tenant isolation via FeedItem FK (consistent with DealProduct, QuoteLineItem, ActivityComment patterns)
- NotificationPreference uses Cascade delete on UserId (preferences removed when user is deleted, unlike Notification which uses SetNull to preserve notification history)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Notification.UserId type for SetNull FK compatibility**
- **Found during:** Task 2 (EF Core configuration)
- **Issue:** Plan specified UserId as non-nullable Guid with SetNull delete behavior, which are incompatible in EF Core (SetNull requires nullable FK)
- **Fix:** Changed UserId from `Guid` to `Guid?` and removed IsRequired() from configuration
- **Files modified:** src/GlobCRM.Domain/Entities/Notification.cs, src/GlobCRM.Infrastructure/Persistence/Configurations/NotificationConfiguration.cs
- **Verification:** Migration generated and applied cleanly, build passes
- **Committed in:** 96dbe1e (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential for EF Core correctness. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Domain model foundation complete for all notification and feed features
- Repository interfaces ready for implementation in 08-02 (repositories and services)
- Database tables created with proper indexes for query performance
- RLS policies in place for tenant isolation

## Self-Check: PASSED

All 13 created files verified on disk. Both task commits (764f56a, 96dbe1e) confirmed in git log.

---
*Phase: 08-real-time-and-notifications*
*Completed: 2026-02-17*
