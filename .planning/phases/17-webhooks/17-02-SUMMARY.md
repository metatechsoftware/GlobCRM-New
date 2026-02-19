---
phase: 17-webhooks
plan: 02
subsystem: webhooks
tags: [webhooks, hmac-sha256, ssrf, hangfire, domain-events, http-client, retry, backoff]

# Dependency graph
requires:
  - phase: 17-01
    provides: "WebhookSubscription entity, WebhookDeliveryLog entity, IWebhookRepository, DomainEvent with OldPropertyValues"
  - phase: 14-email-templates
    provides: "DomainEventInterceptor, DomainEventDispatcher, IDomainEventHandler interface, Hangfire infrastructure"
provides:
  - "WebhookDomainEventHandler matching domain events to cached subscriptions and enqueuing Hangfire delivery jobs"
  - "WebhookDeliveryService with HMAC-SHA256 signing, exponential backoff retry (7 attempts), auto-disable at 50 failures"
  - "WebhookPayloadBuilder serializing 5 entity types with stable envelope, changes tracking, optional custom fields"
  - "WebhookSsrfValidator blocking RFC1918/loopback/link-local IPs with fresh DNS resolution per delivery"
  - "WebhookServiceExtensions registering all services with named HttpClient (no auto-redirect)"
  - "WebhookAutoDisabled NotificationType for email + in-app auto-disable alerts"
affects: [17-03, 17-04, 18-sequences, 19-workflows]

# Tech tracking
tech-stack:
  added: []
  patterns: [webhook-delivery-pipeline, hmac-payload-signing, ssrf-dns-validation, exponential-backoff-with-jitter, subscription-cache-with-invalidation]

key-files:
  created:
    - src/GlobCRM.Infrastructure/Webhooks/WebhookDomainEventHandler.cs
    - src/GlobCRM.Infrastructure/Webhooks/WebhookDeliveryService.cs
    - src/GlobCRM.Infrastructure/Webhooks/WebhookPayloadBuilder.cs
    - src/GlobCRM.Infrastructure/Webhooks/WebhookSsrfValidator.cs
    - src/GlobCRM.Infrastructure/Webhooks/WebhookServiceExtensions.cs
  modified:
    - src/GlobCRM.Domain/Enums/NotificationType.cs
    - src/GlobCRM.Infrastructure/DependencyInjection.cs

key-decisions:
  - "WebhookDeliveryService created early (in Task 1 commit) due to compilation dependency from WebhookDomainEventHandler Hangfire Enqueue call"
  - "Payload builder uses explicit per-entity property mapping (not DTOs) for stable webhook API contract"
  - "SSRF validator uses System.Net.IPNetwork constructor for CIDR matching (available in .NET 10)"
  - "429 Too Many Requests treated as retryable (alongside 5xx and timeouts) while other 4xx are permanent"
  - "Subscription cache uses IMemoryCache with 60-second TTL keyed by tenant ID, with explicit InvalidateCache method"

patterns-established:
  - "Webhook delivery pipeline: DomainEvent -> cached subscription match -> serialize payload in-memory -> enqueue Hangfire job -> deliver with HMAC signing"
  - "HMAC-SHA256 signing: sha256={hexHash} format in X-Webhook-Signature header"
  - "Exponential backoff with jitter: 0/60/300/1800/7200/28800/86400 seconds + 10% random jitter"
  - "SSRF prevention: fresh DNS resolution + blocked IP range validation on every delivery attempt"
  - "Auto-disable pattern: consecutive failure counter with threshold, email + in-app notification dispatch"

requirements-completed: [WHOOK-02, WHOOK-03, WHOOK-06]

# Metrics
duration: 4min
completed: 2026-02-19
---

# Phase 17 Plan 02: Webhook Delivery Pipeline Summary

**Webhook delivery engine with HMAC-SHA256 signing, SSRF-safe HTTP delivery, exponential backoff retry (7 attempts with jitter), subscription auto-disable at 50 failures, and cached domain event handler matching across 5 entity types**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-19T10:11:40Z
- **Completed:** 2026-02-19T10:15:40Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- WebhookDomainEventHandler implements IDomainEventHandler, matches events to tenant-cached subscriptions, serializes payload while entity is in memory (avoiding DbContext disposal pitfall), and enqueues Hangfire delivery jobs
- WebhookDeliveryService performs HMAC-SHA256 signed HTTP delivery via named HttpClient with SSRF validation on every attempt, creates delivery log entries, schedules retries with exponential backoff + 10% jitter, and auto-disables subscriptions after 50 consecutive failures with email + in-app notification
- WebhookPayloadBuilder serializes Contact, Company, Deal, Lead, and Activity entities into stable JSON envelope with id, timestamp, version, tenantId, event type, entity data, and changes (old/new values for updates), with optional custom fields inclusion
- WebhookSsrfValidator blocks RFC1918, loopback, link-local, and reserved IPs using System.Net.IPNetwork CIDR matching with fresh DNS resolution to prevent DNS rebinding
- All services registered via AddWebhookServices() extension with named HttpClient "WebhookDelivery" (30s timeout, User-Agent header, no auto-redirect)

## Task Commits

Each task was committed atomically:

1. **Task 1: WebhookPayloadBuilder, WebhookSsrfValidator, WebhookDomainEventHandler, and WebhookDeliveryService** - `a0ec7bd` (feat)
2. **Task 2: WebhookServiceExtensions and DI registration** - `42c4c80` (feat)

## Files Created/Modified
- `src/GlobCRM.Infrastructure/Webhooks/WebhookPayloadBuilder.cs` - Serializes 5 entity types into webhook payload envelope with changes tracking and optional custom fields
- `src/GlobCRM.Infrastructure/Webhooks/WebhookSsrfValidator.cs` - Validates webhook URLs against SSRF attacks with DNS re-resolution and IP range blocking
- `src/GlobCRM.Infrastructure/Webhooks/WebhookDomainEventHandler.cs` - IDomainEventHandler matching events to cached subscriptions and enqueuing Hangfire delivery jobs
- `src/GlobCRM.Infrastructure/Webhooks/WebhookDeliveryService.cs` - HTTP delivery with HMAC signing, retry scheduling, failure tracking, auto-disable, delivery logging
- `src/GlobCRM.Infrastructure/Webhooks/WebhookServiceExtensions.cs` - DI registration for all webhook services with named HttpClient
- `src/GlobCRM.Domain/Enums/NotificationType.cs` - Added WebhookAutoDisabled enum value
- `src/GlobCRM.Infrastructure/DependencyInjection.cs` - Added AddWebhookServices() call

## Decisions Made
- WebhookDeliveryService created early (in Task 1 commit) because WebhookDomainEventHandler's Hangfire Enqueue call requires the type to exist at compile time -- this is a Rule 3 deviation (blocking issue)
- Payload builder uses explicit per-entity property mapping rather than existing DTOs for stable webhook API contracts that don't break when internal DTOs change
- SSRF validator uses System.Net.IPNetwork constructor (available .NET 8+) for clean CIDR matching
- 429 Too Many Requests is treated as retryable (alongside 5xx and timeouts) while all other 4xx responses are permanent errors
- Subscription cache uses IMemoryCache with 60-second absolute expiration TTL, keyed by tenant ID, with InvalidateCache method for API controllers to call on subscription CRUD
- Entity enum values (Type, Status, Priority, Temperature) serialized as ToString() strings in payload for readability

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] WebhookDeliveryService created early due to compilation dependency**
- **Found during:** Task 1 (WebhookDomainEventHandler creation)
- **Issue:** WebhookDomainEventHandler uses `_jobClient.Enqueue<WebhookDeliveryService>(...)` which requires WebhookDeliveryService type to exist at compile time. The plan placed WebhookDeliveryService in Task 2, but Task 1 could not build without it.
- **Fix:** Created the complete WebhookDeliveryService in Task 1 instead of Task 2. Task 2 then only needed WebhookServiceExtensions and DependencyInjection.cs changes.
- **Files modified:** src/GlobCRM.Infrastructure/Webhooks/WebhookDeliveryService.cs
- **Verification:** Build succeeded with 0 errors
- **Committed in:** a0ec7bd (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Task ordering shifted but all artifacts delivered. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Webhook delivery pipeline fully operational: domain events trigger subscription matching, payload serialization, and Hangfire job enqueue
- Plan 03 (API controller) can use WebhookDeliveryService.GenerateSecret() for subscription creation
- Plan 03 can call WebhookDomainEventHandler.InvalidateCache() on subscription CRUD
- Plan 04 (frontend) will need the API endpoints from Plan 03

## Self-Check: PASSED

All 5 created files verified present. Both task commits (a0ec7bd, 42c4c80) verified in git log. Build succeeds with 0 errors.

---
*Phase: 17-webhooks*
*Completed: 2026-02-19*
