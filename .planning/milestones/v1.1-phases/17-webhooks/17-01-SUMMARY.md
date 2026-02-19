---
phase: 17-webhooks
plan: 01
subsystem: database
tags: [webhooks, ef-core, postgresql, jsonb, rls, domain-events, entity-framework]

# Dependency graph
requires:
  - phase: 14-email-templates
    provides: "DomainEventInterceptor and DomainEvent record for entity lifecycle capture"
provides:
  - "WebhookSubscription entity with JSONB event subscriptions, secret, failure tracking"
  - "WebhookDeliveryLog entity with subscription FK, attempt tracking, request/response storage"
  - "IWebhookRepository interface and WebhookRepository EF Core implementation"
  - "DomainEvent enhanced with OldPropertyValues for update change tracking"
  - "DomainEventInterceptor captures OriginalValue for modified properties"
  - "EF migration creating webhook_subscriptions and webhook_delivery_logs tables"
  - "RLS policies for both webhook tables"
affects: [17-02, 17-03, 17-04, 18-sequences, 19-workflows]

# Tech tracking
tech-stack:
  added: []
  patterns: [webhook-subscription-pattern, delivery-log-pattern, domain-event-old-values]

key-files:
  created:
    - src/GlobCRM.Domain/Entities/WebhookSubscription.cs
    - src/GlobCRM.Domain/Entities/WebhookDeliveryLog.cs
    - src/GlobCRM.Domain/Enums/WebhookEventType.cs
    - src/GlobCRM.Domain/Interfaces/IWebhookRepository.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/WebhookSubscriptionConfiguration.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/WebhookDeliveryLogConfiguration.cs
    - src/GlobCRM.Infrastructure/Webhooks/WebhookRepository.cs
  modified:
    - src/GlobCRM.Domain/Interfaces/IDomainEvent.cs
    - src/GlobCRM.Infrastructure/DomainEvents/DomainEventInterceptor.cs
    - src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs
    - scripts/rls-setup.sql

key-decisions:
  - "DomainEvent OldPropertyValues is nullable with default null for backward compatibility"
  - "EventSubscriptions stored as JSONB List<string> with Entity.EventType format"
  - "RequestPayload stored as text (not JSONB) to preserve serialization for HMAC signature fidelity"
  - "In-memory JSONB contains filter for GetSubscriptionsForEventAsync"
  - "Composite index on (tenant_id, is_active, is_disabled) for subscription matching queries"

patterns-established:
  - "Webhook subscription pattern: JSONB string list for flexible event subscriptions"
  - "Delivery log pattern: per-attempt records with request/response for audit trail"
  - "Old property value capture: DomainEventInterceptor stores OriginalValue alongside CurrentValue"

requirements-completed: [WHOOK-01, WHOOK-04]

# Metrics
duration: 4min
completed: 2026-02-19
---

# Phase 17 Plan 01: Webhook Domain Foundation Summary

**WebhookSubscription and WebhookDeliveryLog entities with JSONB event subscriptions, EF Core configurations, applied migration, RLS policies, repository implementation, and DomainEvent enhanced with OldPropertyValues for update change tracking**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-19T10:04:29Z
- **Completed:** 2026-02-19T10:08:29Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- WebhookSubscription entity with URL, HMAC secret (whsec_ prefix), JSONB event subscriptions, active/disabled state, consecutive failure tracking, and IncludeCustomFields opt-in
- WebhookDeliveryLog entity with subscription FK (cascade delete), attempt tracking, HTTP status, request payload (text for signing fidelity), response body (1KB max), and duration
- DomainEvent record enhanced with backward-compatible OldPropertyValues parameter; DomainEventInterceptor captures OriginalValue for all modified properties
- Full EF Core configurations with snake_case naming, JSONB columns, composite indexes, and global query filters
- Migration applied creating webhook_subscriptions and webhook_delivery_logs tables
- RLS policies added for tenant isolation at database level
- WebhookRepository with full CRUD, event matching (in-memory JSONB contains), paginated delivery logs with Include for subscription name

## Task Commits

Each task was committed atomically:

1. **Task 1: Domain entities, enums, repository interface, and DomainEvent enhancement** - `7932074` (feat)
2. **Task 2: EF Core configurations, migration, RLS policies, DbContext registration, and repository implementation** - `c7e5ca8` (feat)

## Files Created/Modified
- `src/GlobCRM.Domain/Entities/WebhookSubscription.cs` - Webhook subscription entity with all properties (URL, secret, JSONB events, failure tracking)
- `src/GlobCRM.Domain/Entities/WebhookDeliveryLog.cs` - Delivery attempt log entity with request/response details
- `src/GlobCRM.Domain/Enums/WebhookEventType.cs` - Reference enum (Created, Updated, Deleted)
- `src/GlobCRM.Domain/Interfaces/IWebhookRepository.cs` - Repository interface with full CRUD + event matching
- `src/GlobCRM.Domain/Interfaces/IDomainEvent.cs` - Enhanced DomainEvent record with OldPropertyValues parameter
- `src/GlobCRM.Infrastructure/DomainEvents/DomainEventInterceptor.cs` - Captures OriginalValue for modified properties
- `src/GlobCRM.Infrastructure/Persistence/Configurations/WebhookSubscriptionConfiguration.cs` - EF config with JSONB, indexes, snake_case
- `src/GlobCRM.Infrastructure/Persistence/Configurations/WebhookDeliveryLogConfiguration.cs` - EF config with cascade FK, descending indexes
- `src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs` - DbSets, configurations, and global query filters registered
- `src/GlobCRM.Infrastructure/Webhooks/WebhookRepository.cs` - Full IWebhookRepository implementation
- `src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260219100736_AddWebhooks.cs` - Migration creating both tables
- `src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260219100736_AddWebhooks.Designer.cs` - Migration designer
- `src/GlobCRM.Infrastructure/Persistence/Migrations/App/ApplicationDbContextModelSnapshot.cs` - Updated model snapshot
- `scripts/rls-setup.sql` - RLS policies for webhook_subscriptions and webhook_delivery_logs

## Decisions Made
- DomainEvent OldPropertyValues uses nullable Dictionary with default null -- backward compatible so existing Created/Deleted event consumers are unaffected
- EventSubscriptions stored as JSONB List of string with "Entity.EventType" format (e.g., "Contact.Created") -- flexible, easy to filter in-memory
- RequestPayload stored as text (not JSONB) to preserve exact JSON serialization for HMAC signature verification
- GetSubscriptionsForEventAsync loads active subscriptions then filters in-memory for JSONB list contains -- more reliable than EF JSONB translation
- Composite index on (tenant_id, is_active, is_disabled) optimizes the most frequent query pattern: finding deliverable subscriptions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Domain entities, repository, and migration ready for Plan 02 (webhook dispatcher service, HMAC signing, Hangfire retry)
- DomainEvent OldPropertyValues ready for webhook payload builder to include old/new value pairs
- WebhookRepository GetSubscriptionsForEventAsync ready for dispatcher to find matching subscriptions per domain event

## Self-Check: PASSED

All 12 key files verified present. Both task commits (7932074, c7e5ca8) verified in git log.

---
*Phase: 17-webhooks*
*Completed: 2026-02-19*
