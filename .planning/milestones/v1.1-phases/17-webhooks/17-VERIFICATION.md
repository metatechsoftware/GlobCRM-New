---
phase: 17-webhooks
verified: 2026-02-19T11:00:00Z
status: passed
score: 5/5 success criteria verified
re_verification: false
gaps: []
human_verification:
  - test: "Create a webhook subscription via the UI and confirm secret appears once in dialog with copy button"
    expected: "Secret dialog appears with monospace code box, copy button, and 'I've copied the secret' close button; subsequent GET shows masked secret"
    why_human: "One-time secret display flow requires UI interaction; clipboard API behavior cannot be verified programmatically"
  - test: "Save a contact, observe Hangfire dashboard for a webhook delivery job appearing in the 'webhooks' queue"
    expected: "Job appears within seconds of save, payload JSON contains envelope with id/timestamp/version/tenantId/event/data fields"
    why_human: "End-to-end domain event -> Hangfire enqueue flow requires a running backend with a real domain event fired"
  - test: "Point a subscription at a controlled endpoint, trigger a CRM entity update, verify HMAC-SHA256 signature validates"
    expected: "X-Webhook-Signature header value matches sha256=HMAC-SHA256(secret, payload_body)"
    why_human: "Actual HMAC signature verification requires live HTTP delivery to an external endpoint"
  - test: "Navigate to /settings/webhooks in the browser as an Admin user"
    expected: "Subscription list renders with status chips, action buttons, and 'Add Webhook' button visible; non-admin users cannot access"
    why_human: "UI rendering quality and RBAC enforcement require a running frontend with real authentication"
---

# Phase 17: Webhooks Verification Report

**Phase Goal:** Admins can subscribe external systems to CRM entity events via secure, reliable webhook delivery with full observability
**Verified:** 2026-02-19T11:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can create webhook subscriptions, selecting entity event types (create, update, delete) for delivery to a specified URL | VERIFIED | `WebhooksController.Create` (POST /api/webhooks) accepts `CreateWebhookRequest` with `EventSubscriptions: List<string>`. `CreateWebhookRequestValidator` enforces `{Entity}.{Event}` format. Frontend `webhook-edit.component.ts` (514 lines) renders a 5x3 checkbox matrix using `WEBHOOK_ENTITIES` and `WEBHOOK_EVENTS` constants. `settings.routes.ts` exposes `/settings/webhooks/new` with `adminGuard`. |
| 2 | Webhook payloads are signed with HMAC-SHA256, enabling external systems to verify authenticity and prevent tampering | VERIFIED | `WebhookDeliveryService.SignPayload` computes `HMACSHA256(keyBytes, payloadBytes)` and returns `sha256={hex}`. Header `X-Webhook-Signature` added to every delivery request. `WebhookPayloadBuilder` serializes stable envelope (id, timestamp, version, tenantId, event, data, changes). `[AutomaticRetry(Attempts = 0)]` ensures no re-serialization that would break HMAC. |
| 3 | Failed webhook deliveries are automatically retried with exponential backoff (up to 7 attempts), and subscriptions auto-disable after 50 consecutive failures | VERIFIED | `RetryDelaysSeconds = [0, 60, 300, 1800, 7200, 28800, 86400]` with 10% jitter. `_jobClient.Schedule<WebhookDeliveryService>` called for retryable failures (5xx, 429, timeout). `AutoDisableThreshold = 50`; when exceeded, `IsDisabled = true`, `DisabledReason` set, and `NotificationDispatcher` dispatches `WebhookAutoDisabled` notification to `CreatedByUserId`. 4xx (except 429) not retried — permanent. |
| 4 | Admin can view a delivery log showing each attempt's status, HTTP response code, and timing, and can test a subscription with a sample payload | VERIFIED | `GET /api/webhooks/delivery-logs` and `GET /api/webhooks/{id}/delivery-logs` return `PagedDeliveryLogResponse` with `Success`, `HttpStatusCode`, `DurationMs`, `AttemptNumber`. `POST /api/webhooks/{id}/test` supports `preview=true` (returns `WebhookTestPreviewResponse`) and `preview=false` (enqueues real delivery). Frontend `webhook-delivery-log.component.ts` (417 lines) with expandable rows; `webhook-test-dialog.component.ts` (186 lines) with two-step preview/send. |
| 5 | Webhook URLs are validated against SSRF attacks (HTTPS-only, RFC1918 rejection, DNS re-resolution on each delivery) | VERIFIED | `WebhookSsrfValidator.ValidateUrlAsync` enforces HTTPS-only. Resolves DNS via `Dns.GetHostAddressesAsync` fresh per call. Blocks 9 networks: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16, 0.0.0.0/8, ::1/128, fc00::/7, fe80::/10. Called by `WebhookDeliveryService.DeliverAsync` and `WebhooksController` (on create and URL update). HttpClient configured with `AllowAutoRedirect = false`. |

**Score:** 5/5 truths verified

---

## Required Artifacts

### Plan 01 — Domain Foundation

| Artifact | Status | Details |
|----------|--------|---------|
| `src/GlobCRM.Domain/Entities/WebhookSubscription.cs` | VERIFIED | 90 lines. Contains: `TenantId`, `Name`, `Url`, `Secret` (whsec_ prefix), `EventSubscriptions (List<string>)`, `IncludeCustomFields`, `IsActive`, `IsDisabled`, `ConsecutiveFailureCount`, `LastDeliveryAt`, `DisabledAt`, `DisabledReason`, `CreatedByUserId`, audit timestamps. |
| `src/GlobCRM.Domain/Entities/WebhookDeliveryLog.cs` | VERIFIED | Exists with subscription FK, `AttemptNumber`, `Success`, `HttpStatusCode`, `RequestPayload`, `ResponseBody`, `DurationMs`, `ErrorMessage`. |
| `src/GlobCRM.Domain/Interfaces/IDomainEvent.cs` | VERIFIED | `DomainEvent` record has 6 parameters including `Dictionary<string, object?>? OldPropertyValues = null` (backward compatible). |
| `src/GlobCRM.Infrastructure/Webhooks/WebhookRepository.cs` | VERIFIED | 143 lines. Implements `IWebhookRepository`. Contains `GetActiveSubscriptionsAsync`, `GetSubscriptionsForEventAsync`, `GetAllSubscriptionsAsync`, `GetDeliveryLogByIdAsync`, `GetDeliveryLogsAsync`, CRUD methods, `RegenerateSecretAsync`. |
| `src/GlobCRM.Infrastructure/DomainEvents/DomainEventInterceptor.cs` | VERIFIED | Captures `prop.OriginalValue` into `oldPropertyValues` dictionary for `Modified` entities. Both `oldPropertyValues` and `changedProperties` passed to `DomainEvent` constructor. |
| `src/GlobCRM.Infrastructure/Persistence/ApplicationDbContext.cs` | VERIFIED | `DbSet<WebhookSubscription>` and `DbSet<WebhookDeliveryLog>` registered at lines 134-135. |
| `scripts/rls-setup.sql` | VERIFIED | `CREATE POLICY tenant_isolation_webhook_subscriptions` and `CREATE POLICY tenant_isolation_webhook_delivery_logs` both present with `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`. |
| `Migrations/App/20260219100736_AddWebhooks.cs` | VERIFIED | Migration file exists with designer and snapshot updated. |

### Plan 02 — Delivery Pipeline

| Artifact | Status | Details |
|----------|--------|---------|
| `src/GlobCRM.Infrastructure/Webhooks/WebhookDomainEventHandler.cs` | VERIFIED | 127 lines. Implements `IDomainEventHandler`. `EligibleEntities` set with 5 entities. Uses `IMemoryCache` with 60s TTL keyed `webhook_subs_{tenantId}`. Enqueues `WebhookDeliveryService.DeliverAsync` via `_jobClient.Enqueue`. `InvalidateCache` method present. |
| `src/GlobCRM.Infrastructure/Webhooks/WebhookDeliveryService.cs` | VERIFIED | 398 lines. `[Queue("webhooks")]`, `[AutomaticRetry(Attempts = 0)]`. `SignPayload` uses `HMACSHA256`. `RetryDelaysSeconds` array with 7 entries. `AutoDisableThreshold = 50`. SSRF validation on every delivery. Delivery log creation on every attempt. Auto-disable notification via `NotificationDispatcher`. |
| `src/GlobCRM.Infrastructure/Webhooks/WebhookPayloadBuilder.cs` | VERIFIED | 253 lines. Builds envelope `{id, timestamp, version, tenantId, event, data, changes}`. Per-entity serializers for Contact, Company, Deal, Lead, Activity. `changes` object has `{old, new}` from `OldPropertyValues`. Custom fields opt-in. |
| `src/GlobCRM.Infrastructure/Webhooks/WebhookSsrfValidator.cs` | VERIFIED | 103 lines. 9 blocked IP networks. DNS resolved fresh via `Dns.GetHostAddressesAsync`. HTTPS-only enforcement. `IsPrivateIp` static method. |
| `src/GlobCRM.Infrastructure/Webhooks/WebhookServiceExtensions.cs` | VERIFIED | Registers `IDomainEventHandler -> WebhookDomainEventHandler`, `WebhookDeliveryService`, `WebhookSsrfValidator`, `WebhookPayloadBuilder`, `IWebhookRepository -> WebhookRepository`. Named HttpClient "WebhookDelivery" with `AllowAutoRedirect = false`, 30s timeout. |
| `src/GlobCRM.Infrastructure/DependencyInjection.cs` | VERIFIED | `services.AddWebhookServices()` called at line 186. `using GlobCRM.Infrastructure.Webhooks` imported. |
| `src/GlobCRM.Domain/Enums/NotificationType.cs` | VERIFIED | `WebhookAutoDisabled` value present at line 14. |

### Plan 03 — API Controller

| Artifact | Status | Details |
|----------|--------|---------|
| `src/GlobCRM.Api/Controllers/WebhooksController.cs` | VERIFIED | 835 lines. `[Authorize(Roles = "Admin")]`. 11 endpoints: GET list, GET by id, POST create, PUT update, DELETE, POST regenerate-secret, POST toggle, GET delivery-logs (global), GET {id}/delivery-logs, POST {id}/test (preview + send), POST delivery-logs/{logId}/retry. 7 co-located DTOs/records. 2 FluentValidation validators. Secret masked in `WebhookSubscriptionDto.FromEntity` as `whsec_****...{last4}`. Full secret in `WebhookSubscriptionCreateDto`. SSRF validation on create and URL update. `_domainEventHandler.InvalidateCache` called on all 5 mutation endpoints. |

### Plan 04 — Frontend

| Artifact | Status | Details |
|----------|--------|---------|
| `globcrm-web/src/app/features/settings/webhooks/webhook.models.ts` | VERIFIED | 96 lines. `WebhookSubscription`, `WebhookSubscriptionCreate`, `CreateWebhookRequest`, `UpdateWebhookRequest`, `WebhookDeliveryLog`, `PagedDeliveryLogs`, `WebhookTestPreview`, `WebhookTestRequest`. Constants `WEBHOOK_ENTITIES` (5 entities) and `WEBHOOK_EVENTS` (3 events). |
| `globcrm-web/src/app/features/settings/webhooks/webhook.service.ts` | VERIFIED | 121 lines. 11 methods: `getSubscriptions`, `getSubscription`, `createSubscription`, `updateSubscription`, `deleteSubscription`, `regenerateSecret`, `toggleSubscription`, `getDeliveryLogs`, `getSubscriptionDeliveryLogs`, `testWebhook`, `retryDelivery`. All call `/api/webhooks` via `ApiService`. |
| `globcrm-web/src/app/features/settings/webhooks/webhook.store.ts` | VERIFIED | 242 lines. NgRx Signal Store (component-provided). State includes subscriptions, selectedSubscription, deliveryLogs, loading, error. |
| `globcrm-web/src/app/features/settings/webhooks/webhook-list.component.ts` | VERIFIED | 319 lines. Substantive component, not a stub. |
| `globcrm-web/src/app/features/settings/webhooks/webhook-edit.component.ts` | VERIFIED | 514 lines. 5x3 entity-event checkbox matrix. `WebhookSecretDialogComponent` co-located for one-time secret display. |
| `globcrm-web/src/app/features/settings/webhooks/webhook-detail.component.ts` | VERIFIED | 638 lines. Subscription info card, auto-disabled banner, filtered delivery log, test/toggle/regenerate actions. |
| `globcrm-web/src/app/features/settings/webhooks/webhook-delivery-log.component.ts` | VERIFIED | 417 lines. Expandable rows, status badges, retry buttons, subscription filter dropdown, pagination. |
| `globcrm-web/src/app/features/settings/webhooks/webhook-test-dialog.component.ts` | VERIFIED | 186 lines. Two-step preview/send flow: preview=true fetches sample payload, then optionally sends real delivery. |
| `globcrm-web/src/app/features/settings/settings.routes.ts` | VERIFIED | 5 webhook routes present: `webhooks` (list), `webhooks/new`, `webhooks/delivery-logs`, `webhooks/:id`, `webhooks/:id/edit`. All with `adminGuard`. Ordering correct (static routes before `:id` param). |
| `globcrm-web/src/app/features/settings/settings-hub.component.ts` | VERIFIED | "Webhooks" card present at line 198-200: label "Webhooks", description "Manage webhook subscriptions for external integrations", route `/settings/webhooks`. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `DomainEventInterceptor.cs` | `IDomainEvent.cs` | Captures `OriginalValue` into `OldPropertyValues` | WIRED | `oldPropertyValues[prop.Metadata.Name] = prop.OriginalValue` at line 123. Passed to `DomainEvent` constructor at line 134. |
| `ApplicationDbContext.cs` | `WebhookSubscription.cs` | `DbSet<WebhookSubscription>` | WIRED | Line 134: `public DbSet<WebhookSubscription> WebhookSubscriptions => Set<WebhookSubscription>();` |
| `WebhookDomainEventHandler.cs` | `WebhookDeliveryService.cs` | `_jobClient.Enqueue<WebhookDeliveryService>(svc => svc.DeliverAsync(..., 0))` | WIRED | Line 99 of handler: `_jobClient.Enqueue<WebhookDeliveryService>(WebhookDeliveryService.QueueName, svc => svc.DeliverAsync(...))` |
| `WebhookDeliveryService.cs` | `WebhookSsrfValidator.cs` | `ValidateUrlAsync` before every HTTP delivery | WIRED | Line 102: `await _ssrfValidator.ValidateUrlAsync(subscription.Url)` |
| `WebhookDeliveryService.cs` | `BackgroundJob.Schedule` | Retry scheduling with exponential backoff | WIRED | Line 215: `_jobClient.Schedule<WebhookDeliveryService>(QueueName, svc => svc.DeliverAsync(..., nextAttempt), delay)` |
| `WebhooksController.cs` | `WebhookDeliveryService.cs` | Test send + manual retry enqueue Hangfire jobs | WIRED | Lines 381 and 424: `_jobClient.Enqueue<WebhookDeliveryService>(...)` |
| `WebhooksController.cs` | `WebhookDomainEventHandler.cs` | `InvalidateCache` called on all subscription mutations | WIRED | `_domainEventHandler.InvalidateCache(tenantId)` at lines 125, 188, 213, 240, 277 — covers Create, Update, Delete, RegenerateSecret, Toggle. |
| `webhook.service.ts` | `/api/webhooks` | `ApiService` HTTP calls | WIRED | `basePath = '/api/webhooks'` with 11 methods making GET/POST/PUT/DELETE calls. |
| `settings.routes.ts` | `webhooks/` | Lazy-loaded routes under `/settings/webhooks` | WIRED | 5 routes with `adminGuard` and `loadComponent` imports matching component class names. |
| `DependencyInjection.cs` | `WebhookServiceExtensions.cs` | `services.AddWebhookServices()` | WIRED | Line 186 in `DependencyInjection.cs`. `WebhookDomainEventHandler` registered as `IDomainEventHandler` — `DomainEventDispatcher` resolves all handlers via `GetServices<IDomainEventHandler>()`. |

---

## Requirements Coverage

| Requirement | Plans | Description | Status | Evidence |
|-------------|-------|-------------|--------|---------|
| WHOOK-01 | 01, 03, 04 | Admin can create webhook subscriptions with event type selection | SATISFIED | `WebhookSubscription` entity with `EventSubscriptions (List<string>)`, controller `POST /api/webhooks`, frontend `webhook-edit.component.ts` 5x3 matrix |
| WHOOK-02 | 02 | Webhook payloads are signed with HMAC-SHA256 for verification | SATISFIED | `WebhookDeliveryService.SignPayload` with `HMACSHA256`, `X-Webhook-Signature: sha256={hex}` header on every delivery |
| WHOOK-03 | 02 | Failed deliveries retried with exponential backoff (up to 7 attempts) | SATISFIED | `RetryDelaysSeconds = [0,60,300,1800,7200,28800,86400]` with 10% jitter, `MaxRetryAttempts = 7`, `_jobClient.Schedule` for retryable failures |
| WHOOK-04 | 01, 03, 04 | Admin can view webhook delivery logs with success/failure status | SATISFIED | `WebhookDeliveryLog` entity, 2 paginated log endpoints (global + per-subscription), `webhook-delivery-log.component.ts` with status badges and expandable rows |
| WHOOK-05 | 03, 04 | Admin can test a webhook subscription with a sample payload | SATISFIED | `POST /api/webhooks/{id}/test` with `preview=true/false` two-step flow, `webhook-test-dialog.component.ts` |
| WHOOK-06 | 02 | Subscriptions auto-disable after 50 consecutive failures | SATISFIED | `AutoDisableThreshold = 50`, `subscription.IsDisabled = true` on threshold, `WebhookAutoDisabled` notification dispatched to `CreatedByUserId` |

**All 6 requirements: SATISFIED.** No orphaned requirements detected — REQUIREMENTS.md maps all WHOOK-* IDs to Phase 17 and all are implemented.

---

## Anti-Patterns Scan

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `webhook-edit.component.ts` lines 203, 211 | `placeholder="..."` | Info | HTML input placeholders (form field hints) — expected pattern, not a stub. |

No blocker or warning anti-patterns found. All webhook files contain substantive, production-quality implementations. No `TODO`, `FIXME`, `return null`, `return {}`, or empty handler patterns detected in any of the 17 created/modified files.

---

## Human Verification Required

### 1. One-Time Secret Display Dialog

**Test:** Create a new webhook subscription via `/settings/webhooks/new`. Fill in name, URL, and select at least one event checkbox. Submit.
**Expected:** A modal dialog appears showing the full `whsec_...` secret in a monospace code block with a copy-to-clipboard button and a "I've copied the secret" confirmation button. After closing the dialog and re-opening the subscription detail, the secret field shows the masked format `whsec_****...{last4}`.
**Why human:** Clipboard API interaction and one-time display guarantee require UI flow verification.

### 2. Domain Event to Hangfire Queue Flow

**Test:** With backend running, create or update a contact that has at least one active webhook subscription matching `Contact.Created` or `Contact.Updated`. Check the Hangfire dashboard at `/hangfire`.
**Expected:** A job appears in the `webhooks` queue within seconds. The job payload contains the subscription ID, serialized JSON payload, and attempt number 0.
**Why human:** End-to-end domain event propagation requires a running backend with real database state.

### 3. HMAC Signature Verification

**Test:** Point a subscription at a controlled endpoint (e.g., RequestBin or a local ngrok tunnel). Trigger a CRM entity event. On receiving the POST request, compute `HMAC-SHA256(subscription_secret, raw_request_body)` and compare with the `X-Webhook-Signature` header value (stripping `sha256=` prefix).
**Expected:** Computed HMAC matches header value exactly. Re-serializing the JSON produces a different HMAC, confirming signature is tied to the raw payload.
**Why human:** Live HMAC verification requires a real external endpoint and network delivery.

### 4. Admin UI Access and Non-Admin Restriction

**Test:** Log in as an Admin user, navigate to `/settings/webhooks`. Then log in as a Member user and attempt the same URL.
**Expected:** Admin sees the subscription list page. Member is redirected or sees a 403/access denied page (enforced by `adminGuard`).
**Why human:** RBAC enforcement at the UI level requires authentication state and guard behavior verification.

---

## Summary

Phase 17 goal is fully achieved. All 5 ROADMAP success criteria are verified against the actual codebase:

1. **Subscription management** — Complete CRUD with event selection, secret masking, and cache invalidation wired end-to-end from Angular form through API controller to EF Core/PostgreSQL with RLS.

2. **HMAC-SHA256 signing** — Stable payload envelope built before enqueueing (no re-serialization drift), signed with `HMACSHA256`, delivered via named HttpClient with `AllowAutoRedirect = false`.

3. **Retry and auto-disable** — 7-attempt exponential backoff schedule with 10% jitter, threshold-based auto-disable at 50 consecutive failures, email + in-app notification to subscription creator on auto-disable.

4. **Delivery log observability** — Per-attempt log entries with HTTP status, duration, request payload, and response body; paginated global and per-subscription views in the frontend with expandable row detail and manual retry capability.

5. **SSRF protection** — Fresh DNS resolution per delivery, 9 blocked IP networks (IPv4 + IPv6 private/loopback/link-local), HTTPS-only enforcement, redirect blocking at HttpClient level.

The 4 human verification items are behavior confirmations (UI interaction, live delivery, HMAC verification, RBAC enforcement) — all automated structural checks have passed.

---

*Verified: 2026-02-19T11:00:00Z*
*Verifier: Claude (gsd-verifier)*
