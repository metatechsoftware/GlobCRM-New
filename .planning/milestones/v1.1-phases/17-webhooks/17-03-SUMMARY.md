---
phase: 17-webhooks
plan: 03
subsystem: api
tags: [webhooks, rest-api, fluent-validation, admin-endpoints, delivery-logs, hmac, ssrf]

# Dependency graph
requires:
  - phase: 17-01
    provides: "WebhookSubscription and WebhookDeliveryLog entities, IWebhookRepository, EF Core configurations"
  - phase: 17-02
    provides: "WebhookDeliveryService (GenerateSecret, DeliverAsync), WebhookPayloadBuilder, WebhookSsrfValidator, WebhookDomainEventHandler (InvalidateCache)"
provides:
  - "WebhooksController with 11 admin endpoints for subscription CRUD, delivery log viewing, test webhook, secret regeneration, and manual retry"
  - "Co-located DTOs: WebhookSubscriptionDto (masked secret), WebhookSubscriptionCreateDto (full secret on create), WebhookDeliveryLogDto, PagedDeliveryLogResponse, WebhookTestPreviewResponse"
  - "FluentValidation validators for create/update requests with Entity.EventType format validation"
  - "GetAllSubscriptionsAsync and GetDeliveryLogByIdAsync repository methods"
affects: [17-04, 18-sequences, 19-workflows]

# Tech tracking
tech-stack:
  added: []
  patterns: [webhook-admin-api, secret-mask-pattern, sample-payload-builder, two-step-test-webhook]

key-files:
  created:
    - src/GlobCRM.Api/Controllers/WebhooksController.cs
  modified:
    - src/GlobCRM.Domain/Interfaces/IWebhookRepository.cs
    - src/GlobCRM.Infrastructure/Webhooks/WebhookRepository.cs

key-decisions:
  - "GetAllSubscriptionsAsync added to repository for admin listing (GetActiveSubscriptionsAsync only returns active+non-disabled)"
  - "GetDeliveryLogByIdAsync added to repository for manual retry log lookup with subscription Include"
  - "Secret masked as whsec_****...{last4} in all GET responses, full secret only on POST create and POST regenerate-secret"
  - "Test webhook uses two-step flow: preview=true returns sample payload for inspection, preview=false enqueues real delivery"
  - "Manual retry validates failed status, subscription existence, active state, and non-disabled state before re-enqueuing"
  - "Page size capped at 100 for delivery log endpoints to prevent excessive queries"

patterns-established:
  - "Webhook admin API: 11 endpoints under /api/webhooks with Admin role authorization"
  - "Secret masking: whsec_****...{last4} format, shown once on create and regenerate only"
  - "Two-step test webhook: preview mode for payload inspection, send mode for real delivery"
  - "Sample payload builder: realistic fake data per entity type in standard webhook envelope format"

requirements-completed: [WHOOK-01, WHOOK-04, WHOOK-05]

# Metrics
duration: 3min
completed: 2026-02-19
---

# Phase 17 Plan 03: Webhook API Controller Summary

**WebhooksController with 11 admin endpoints: full subscription CRUD, HMAC secret regeneration, enable/disable toggle, paginated delivery logs, two-step test webhook (preview then send), and manual retry from failed delivery logs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-19T10:19:28Z
- **Completed:** 2026-02-19T10:23:17Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- WebhooksController with 11 Admin-only endpoints covering the complete webhook management API surface
- Subscription CRUD (list, get, create, update, delete) with SSRF validation on create and URL update, secret shown once on create
- Secret regeneration with immediate old-secret invalidation, enable/disable toggle that clears auto-disabled state on re-enable
- Delivery log viewing with global and per-subscription pagination (total count for UI)
- Test webhook with two-step flow: preview returns sample payload for inspection, send enqueues real Hangfire delivery
- Manual retry from failed delivery logs with subscription existence/active/disabled validation
- FluentValidation validators enforcing Entity.EventType format (Contact/Company/Deal/Lead/Activity x Created/Updated/Deleted)
- Co-located DTOs with static FromEntity factories per codebase convention

## Task Commits

Each task was committed atomically:

1. **Task 1: WebhooksController subscription CRUD endpoints with DTOs and validators** - `d883488` (feat)
2. **Task 2: Delivery log endpoints, test webhook, and manual retry** - `b86d34d` (feat)

## Files Created/Modified
- `src/GlobCRM.Api/Controllers/WebhooksController.cs` - Full controller with 11 endpoints, 7 DTOs/records, 2 FluentValidation validators, and sample payload builder
- `src/GlobCRM.Domain/Interfaces/IWebhookRepository.cs` - Added GetAllSubscriptionsAsync (admin listing) and GetDeliveryLogByIdAsync (retry lookup)
- `src/GlobCRM.Infrastructure/Webhooks/WebhookRepository.cs` - EF Core implementations of the two new repository methods

## Decisions Made
- Added GetAllSubscriptionsAsync to repository because GetActiveSubscriptionsAsync only returns active+non-disabled subscriptions, but admin UI needs to see all subscriptions including disabled ones
- Added GetDeliveryLogByIdAsync to repository because manual retry needs to load a single log entry with subscription navigation for validation
- Secret masked as "whsec_****...{last4}" in WebhookSubscriptionDto.FromEntity, full secret exposed only in WebhookSubscriptionCreateDto (POST create) and regenerate-secret response
- Test webhook uses preview/send flow: preview=true returns formatted JSON sample for admin inspection before actually firing the webhook
- Manual retry validates: (1) log entry exists, (2) delivery was failed (not successful), (3) subscription still exists, (4) subscription is active, (5) subscription is not auto-disabled
- Page size capped at 100 on delivery log queries for safety; defaults to 25

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added GetAllSubscriptionsAsync and GetDeliveryLogByIdAsync to repository**
- **Found during:** Task 1 (Controller creation)
- **Issue:** IWebhookRepository only had GetActiveSubscriptionsAsync (filters active+non-disabled) but admin list endpoint needs all subscriptions. Also, GetDeliveryLogByIdAsync was missing for manual retry log lookup.
- **Fix:** Added both methods to IWebhookRepository interface and WebhookRepository implementation
- **Files modified:** src/GlobCRM.Domain/Interfaces/IWebhookRepository.cs, src/GlobCRM.Infrastructure/Webhooks/WebhookRepository.cs
- **Verification:** Build succeeded with 0 errors
- **Committed in:** d883488 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Repository methods were required for correct admin API behavior. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 11 API endpoints ready for Plan 04 (Angular frontend) to consume
- Full CRUD, test, delivery logs, retry, regenerate-secret, toggle endpoints available
- Frontend can build subscription management UI, delivery log viewer, test webhook preview dialog
- WebhookSubscriptionDto/WebhookDeliveryLogDto shapes define the Angular model interfaces

## Self-Check: PASSED
