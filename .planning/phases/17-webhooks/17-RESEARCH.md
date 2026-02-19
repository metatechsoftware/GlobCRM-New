# Phase 17: Webhooks - Research

**Researched:** 2026-02-19
**Domain:** Webhook subscription management, HMAC-signed delivery, SSRF prevention, retry/backoff, delivery observability
**Confidence:** HIGH

## Summary

Phase 17 implements a webhook subsystem that delivers CRM entity events (create/update/delete) to external URLs configured by tenant admins. The architecture has three clear layers: (1) a `WebhookDomainEventHandler` that implements the existing `IDomainEventHandler` interface to intercept domain events and enqueue Hangfire jobs, (2) a `WebhookDeliveryService` that performs HMAC-SHA256-signed HTTP delivery with SSRF prevention, and (3) delivery logging with auto-disable after 50 consecutive failures.

The existing codebase provides strong foundations. The `DomainEventInterceptor` already captures `Created`/`Updated`/`Deleted` events for all entities with changed property tracking. Hangfire is configured with a dedicated `webhooks` queue and tenant context propagation via `TenantJobFilter`. The only enhancement needed to existing code is capturing `OriginalValue` (not just `CurrentValue`) in the `DomainEventInterceptor` to support the old/new values "changes" object in webhook payloads.

**Primary recommendation:** Implement the webhook handler as an `IDomainEventHandler` that filters events against active subscriptions and enqueues Hangfire jobs to the `webhooks` queue. Use `IHttpClientFactory` with a named client for delivery, `System.Security.Cryptography.HMACSHA256` for signing, and `Dns.GetHostAddressesAsync` with IP range validation for SSRF prevention. Frontend: admin settings pages under `/settings/webhooks` with subscription CRUD and a custom delivery log.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Subscription Management
- Per entity + event type granularity -- admin picks specific entity types AND event types (create, update, delete) individually
- One subscription supports multiple entity+event combinations -- a single webhook URL can listen to Contact Created + Deal Updated + Company Deleted, etc.
- Start with core 5 entities (Contact, Company, Deal, Lead, Activity), designed so adding more entities is trivial
- Webhook secrets are auto-generated on creation, shown to admin once only (Stripe-style) -- can regenerate but old secret is immediately invalidated
- Admin can manually enable/disable subscriptions and re-enable auto-disabled ones (preserves config and delivery history)

#### Payload Shape
- Full entity snapshot + changed fields -- payload includes complete entity data at time of event PLUS a "changes" object showing old/new values for update events
- Custom fields inclusion is opt-in per subscription -- admin toggles whether custom fields are part of entity payloads
- Delete events and envelope metadata design at Claude's discretion

#### Delivery Log UX
- Both global delivery log page (all webhooks across tenant) AND per-subscription filtered view
- Custom log layout with status badges and expandable rows -- purpose-built for webhook logs, NOT DynamicTable
- Payload inspection detail level and log retention period at Claude's discretion

#### Test & Retry Experience
- Test webhook: preview payload first, then option to send it to the real URL -- inspect before firing
- Auto-disable notification: both email alert AND in-app notification when a subscription hits 50 consecutive failures
- Re-enable existing subscriptions after fixing issues -- preserves config and history, no need to recreate
- Manual retry from delivery log at Claude's discretion

### Claude's Discretion
- Payload envelope structure (delivery ID, timestamp, event type, tenant ID, version)
- Delete event payload content (full entity before delete vs ID only)
- Delivery log payload inspection depth (full request/response vs summary)
- Log retention period
- Manual retry of failed deliveries from log

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WHOOK-01 | Admin can create webhook subscriptions with event type selection | Subscription entity with JSONB `EventSubscriptions` storing entity+event pairs; CRUD controller following `DuplicateSettingsController` pattern; frontend settings pages under `/settings/webhooks` |
| WHOOK-02 | Webhook payloads are signed with HMAC-SHA256 for verification | `System.Security.Cryptography.HMACSHA256` for signing; hex-encoded signature in `X-Webhook-Signature` header; constant-time comparison documented for consumers |
| WHOOK-03 | Failed webhook deliveries are retried with exponential backoff (up to 7 attempts) | Hangfire `[AutomaticRetry(Attempts = 7, DelaysInSeconds = ...)]` with custom intervals; `webhooks` queue already configured |
| WHOOK-04 | Admin can view webhook delivery logs with success/failure status | `WebhookDeliveryLog` entity storing request/response details; custom Angular component with status badges and expandable rows |
| WHOOK-05 | Admin can test a webhook subscription with a sample payload | Test endpoint that generates sample entity data, returns preview, then optionally sends to URL; reuses delivery service |
| WHOOK-06 | Subscriptions auto-disable after 50 consecutive failures | `ConsecutiveFailureCount` on subscription entity; incremented on failure, reset on success; auto-disable triggers email + in-app notification via `NotificationDispatcher` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Hangfire.AspNetCore | 1.8.18 (already installed) | Background job scheduling for webhook delivery | Already configured with `webhooks` queue and tenant context propagation |
| System.Security.Cryptography | Built-in (.NET 10) | HMAC-SHA256 signing | Standard library, no external dependency needed |
| System.Net.Http (IHttpClientFactory) | Built-in (.NET 10) | HTTP delivery to webhook URLs | Standard pattern for resilient outbound HTTP in .NET |
| FluentValidation | 11.3.1 (already installed) | Request validation for subscription CRUD | Already used across all controllers |
| @angular/material | 19.2.19 (already installed) | UI components for admin settings pages | Already used across entire frontend |
| @ngrx/signals | 19.2.1 (already installed) | Signal store for webhook management state | Already used for all feature stores |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| System.Net.Dns | Built-in | DNS resolution for SSRF prevention | Resolve webhook URL hostname to IP before delivery |
| System.Net.IPAddress | Built-in | IP range validation | Check resolved IPs against RFC1918/loopback/link-local ranges |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled delivery | Svix webhook service | External dependency, cost, but more features (dashboard, retries). Overkill for this use case -- Hangfire + custom delivery is simpler and keeps everything in-process |
| Hangfire retry | Polly retry policies | Polly is great for transient HTTP faults, but Hangfire already provides durable retry with persistence and visibility via dashboard. Using both adds complexity |
| Custom SSRF checks | Microsoft.Security.Utilities | Library exists but SSRF URL validation is simple enough (~30 lines) that a custom implementation is clearer and has no dependency risk |

**Installation:**
No new packages needed. All required functionality is available through already-installed packages and .NET built-in libraries.

## Architecture Patterns

### Recommended Project Structure

**Backend:**
```
src/GlobCRM.Domain/
├── Entities/
│   ├── WebhookSubscription.cs     # Subscription config entity
│   └── WebhookDeliveryLog.cs      # Delivery attempt log entity
├── Enums/
│   └── WebhookEventType.cs        # Created, Updated, Deleted enum
├── Interfaces/
│   └── IWebhookRepository.cs      # Repository interface

src/GlobCRM.Infrastructure/
├── Webhooks/
│   ├── WebhookDomainEventHandler.cs     # IDomainEventHandler implementation
│   ├── WebhookDeliveryService.cs        # HTTP delivery + HMAC signing
│   ├── WebhookPayloadBuilder.cs         # Entity serialization + changes
│   ├── WebhookSsrfValidator.cs          # URL and IP validation
│   ├── WebhookRepository.cs             # EF Core repository
│   └── WebhookServiceExtensions.cs      # DI registration
├── Persistence/Configurations/
│   ├── WebhookSubscriptionConfiguration.cs
│   └── WebhookDeliveryLogConfiguration.cs

src/GlobCRM.Api/Controllers/
└── WebhooksController.cs           # CRUD + test + delivery logs (DTOs co-located)
```

**Frontend:**
```
globcrm-web/src/app/features/settings/webhooks/
├── webhook.service.ts              # API service
├── webhook.models.ts               # TypeScript interfaces
├── webhook.store.ts                # Signal store
├── webhook-list.component.ts       # Subscription list (admin)
├── webhook-edit.component.ts       # Create/edit subscription
├── webhook-detail.component.ts     # Subscription detail + delivery log
├── webhook-delivery-log.component.ts  # Global delivery log page
└── webhook-test-dialog.component.ts   # Test payload preview + send dialog
```

### Pattern 1: Domain Event Handler for Webhook Dispatch

**What:** The webhook system hooks into the existing `DomainEventInterceptor` -> `DomainEventDispatcher` -> `IDomainEventHandler` pipeline. When any entity is saved, the handler checks if active webhook subscriptions match the entity+event type and enqueues a Hangfire job.

**When to use:** This is the only entry point for webhook events -- all entity CRUD goes through `SaveChangesAsync`, which triggers the interceptor.

**Example:**
```csharp
// Registered as IDomainEventHandler in DI
public class WebhookDomainEventHandler : IDomainEventHandler
{
    private readonly IBackgroundJobClient _jobClient;
    private readonly ApplicationDbContext _db;
    private readonly ITenantProvider _tenantProvider;

    public async Task HandleAsync(DomainEvent domainEvent, CancellationToken ct)
    {
        // Only process webhook-eligible entities
        var eligibleEntities = new HashSet<string>
            { "Contact", "Company", "Deal", "Lead", "Activity" };

        if (!eligibleEntities.Contains(domainEvent.EntityName))
            return;

        var tenantId = _tenantProvider.GetTenantId();
        if (!tenantId.HasValue) return;

        // Find active subscriptions matching this entity+event
        var subscriptions = await _db.WebhookSubscriptions
            .Where(s => s.IsActive && !s.IsDisabled)
            .ToListAsync(ct);

        var eventKey = $"{domainEvent.EntityName}.{domainEvent.EventType}";

        foreach (var sub in subscriptions)
        {
            if (!sub.EventSubscriptions.Contains(eventKey))
                continue;

            // Serialize entity snapshot now (while entity is still in memory)
            var payload = BuildPayload(domainEvent, sub);

            // Enqueue delivery job to webhooks queue
            _jobClient.Enqueue<WebhookDeliveryService>(
                WebhookDeliveryService.QueueName,
                svc => svc.DeliverAsync(sub.Id, payload, tenantId.Value));
        }
    }
}
```

### Pattern 2: HMAC-SHA256 Payload Signing

**What:** Each webhook delivery is signed with the subscription's secret key using HMAC-SHA256. The signature is sent in a header so the receiver can verify authenticity.

**When to use:** Every webhook HTTP delivery.

**Example:**
```csharp
public static class WebhookSigner
{
    public static string Sign(string payload, string secret)
    {
        var keyBytes = Encoding.UTF8.GetBytes(secret);
        var payloadBytes = Encoding.UTF8.GetBytes(payload);

        using var hmac = new HMACSHA256(keyBytes);
        var hash = hmac.ComputeHash(payloadBytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}

// Usage in delivery:
var signature = WebhookSigner.Sign(jsonPayload, subscription.Secret);
request.Headers.Add("X-Webhook-Signature", $"sha256={signature}");
request.Headers.Add("X-Webhook-Id", deliveryId.ToString());
request.Headers.Add("X-Webhook-Timestamp", DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString());
```

### Pattern 3: SSRF Prevention with DNS Resolution

**What:** Before making an HTTP request to a webhook URL, resolve the hostname to IP addresses and validate none are private/internal ranges.

**When to use:** Every webhook delivery attempt AND on subscription creation/update.

**Example:**
```csharp
public class WebhookSsrfValidator
{
    private static readonly IPNetwork[] BlockedNetworks = new[]
    {
        IPNetwork.Parse("10.0.0.0/8"),        // RFC1918
        IPNetwork.Parse("172.16.0.0/12"),      // RFC1918
        IPNetwork.Parse("192.168.0.0/16"),     // RFC1918
        IPNetwork.Parse("127.0.0.0/8"),        // Loopback
        IPNetwork.Parse("169.254.0.0/16"),     // Link-local
        IPNetwork.Parse("0.0.0.0/8"),          // "This" network
        IPNetwork.Parse("::1/128"),            // IPv6 loopback
        IPNetwork.Parse("fc00::/7"),           // IPv6 ULA
        IPNetwork.Parse("fe80::/10"),          // IPv6 link-local
    };

    public async Task<(bool IsValid, string? Error)> ValidateUrlAsync(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
            return (false, "Invalid URL format.");

        if (uri.Scheme != "https")
            return (false, "Only HTTPS URLs are allowed.");

        // Resolve DNS fresh every time (prevents DNS rebinding)
        var addresses = await Dns.GetHostAddressesAsync(uri.Host);

        foreach (var addr in addresses)
        {
            foreach (var blocked in BlockedNetworks)
            {
                if (blocked.Contains(addr))
                    return (false, $"URL resolves to blocked IP range: {addr}");
            }
        }

        return (true, null);
    }
}
```

### Pattern 4: Webhook Payload Envelope

**Recommendation (Claude's Discretion):** Use a standard envelope wrapping the entity data.

```json
{
    "id": "d1e2f3a4-...",
    "timestamp": "2026-02-19T10:30:00Z",
    "version": "1.0",
    "tenantId": "abc123-...",
    "event": "contact.updated",
    "data": {
        "id": "c1d2e3f4-...",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "customFields": { ... }
    },
    "changes": {
        "email": {
            "old": "john.doe@old.com",
            "new": "john@example.com"
        },
        "lastName": {
            "old": "Smith",
            "new": "Doe"
        }
    }
}
```

**Delete events:** Include the full entity snapshot before deletion (the entity is captured pre-save by the interceptor). This is more useful to consumers than just an ID.

### Pattern 5: Subscription Entity with Event Subscriptions

**What:** Store the multi-entity, multi-event selections as a `List<string>` JSONB column.

```csharp
public class WebhookSubscription
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    public string Name { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string Secret { get; set; } = string.Empty;  // HMAC secret

    // e.g. ["Contact.Created", "Contact.Updated", "Deal.Deleted"]
    public List<string> EventSubscriptions { get; set; } = new();

    public bool IncludeCustomFields { get; set; } = false;
    public bool IsActive { get; set; } = true;       // Admin toggle
    public bool IsDisabled { get; set; } = false;     // Auto-disabled by failure count

    public int ConsecutiveFailureCount { get; set; } = 0;
    public DateTimeOffset? LastDeliveryAt { get; set; }
    public DateTimeOffset? DisabledAt { get; set; }
    public string? DisabledReason { get; set; }

    public Guid CreatedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
```

### Anti-Patterns to Avoid

- **Synchronous delivery in the request pipeline:** Never make outbound HTTP calls during `SaveChangesAsync`. Always enqueue to Hangfire. The domain event handler MUST be fast (just enqueue, don't deliver).
- **Retrying on 4xx responses:** 400/401/403/404 are permanent errors -- do not retry. Only retry on 5xx, timeout, and connection failures.
- **Signing parsed JSON:** Always sign the raw string payload, not a re-serialized version. JSON serialization is not deterministic; re-serializing may change field order.
- **Storing secrets in plaintext logs:** Never log the webhook secret. Log delivery payloads but redact the `X-Webhook-Signature` header value.
- **Using `new HttpClient()` directly:** Always use `IHttpClientFactory` to manage connection pooling and avoid socket exhaustion.
- **Validating URL once at creation time only:** SSRF DNS rebinding means the same hostname can resolve differently over time. Re-resolve and validate on EVERY delivery attempt.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Background job scheduling | Custom retry scheduler with timers | Hangfire `[AutomaticRetry]` with `DelaysInSeconds` | Hangfire provides durable persistence, retry visibility, and tenant context propagation already configured |
| HMAC-SHA256 computation | Custom hashing implementation | `System.Security.Cryptography.HMACSHA256` | Built-in, audited, constant-time comparison available |
| HTTP connection management | `new HttpClient()` per request | `IHttpClientFactory` named client | Prevents socket exhaustion, enables DNS rotation, testable |
| Secret generation | Custom random string builder | `RandomNumberGenerator.GetBytes(32)` -> Base64 | Cryptographically secure random, standard approach |

**Key insight:** The existing Hangfire + DomainEvent infrastructure handles 80% of the webhook delivery pipeline. The new code focuses on: (1) matching events to subscriptions, (2) building payloads, (3) signing, (4) SSRF validation, and (5) logging. The scheduling, retry, and tenant isolation are already solved.

## Common Pitfalls

### Pitfall 1: DomainEvent Entity Serialization After DbContext Disposal
**What goes wrong:** The `DomainEventInterceptor` captures entity references during `SavingChanges`. By the time the Hangfire job executes, the DbContext is disposed and lazy-loaded navigation properties will throw.
**Why it happens:** The entity object reference captured in `DomainEvent.Entity` is tracked by the now-disposed DbContext.
**How to avoid:** Serialize the entity to a JSON string payload INSIDE the domain event handler (while the entity is still in memory), NOT in the Hangfire job. Pass the serialized string to the job.
**Warning signs:** `ObjectDisposedException` or null navigation properties in webhook payloads.

### Pitfall 2: DomainEvent Missing Old Values for Update Events
**What goes wrong:** The current `DomainEventInterceptor` only captures `CurrentValue` for modified properties, not `OriginalValue`. The webhook payload needs old/new value pairs.
**Why it happens:** The interceptor was built in Phase 14 as a minimal foundation -- only new values were needed at that point.
**How to avoid:** Enhance the `DomainEventInterceptor` (or the `DomainEvent` record) to also capture `OriginalValue` for modified properties. This is a small change: `changedProperties[prop.Metadata.Name] = new { Old = prop.OriginalValue, New = prop.CurrentValue }` or add a separate `OldValues` dictionary to `DomainEvent`.
**Warning signs:** "changes" object in webhook payload showing only new values, missing old values.

### Pitfall 3: DNS Rebinding Bypassing SSRF Prevention
**What goes wrong:** A webhook URL is validated at subscription creation (resolves to public IP), but at delivery time the DNS record has changed to point to an internal IP (127.0.0.1, 10.x.x.x, etc.).
**Why it happens:** DNS records can have short TTLs and be changed between validation and delivery.
**How to avoid:** Re-resolve DNS and validate the IP on EVERY delivery attempt, not just at subscription creation. Also: disable HTTP redirects in the HttpClient (or re-validate the redirect target URL).
**Warning signs:** Webhook deliveries reaching internal services, unexpected responses from localhost.

### Pitfall 4: Stampede Effect After Endpoint Recovery
**What goes wrong:** When a webhook endpoint goes down, all pending deliveries fail and get retried at similar intervals. When the endpoint recovers, all retries fire at once, potentially overwhelming it again.
**Why it happens:** Deterministic exponential backoff without jitter.
**How to avoid:** Add jitter to retry delays. Hangfire's `DelayInSecondsByAttemptFunc` can include randomness: `attempt => (int)(Math.Pow(2, attempt) * 60 + Random.Shared.Next(0, 30))`.
**Warning signs:** Spike in delivery attempts after an endpoint recovers from downtime.

### Pitfall 5: Webhook Secret Shown in API Responses After Creation
**What goes wrong:** The secret is included in GET responses, violating the Stripe-style "shown once" pattern.
**Why it happens:** The DTO includes all entity fields without thinking about which are write-once.
**How to avoid:** The secret should ONLY be returned in the POST response (creation) and in the regenerate response. GET endpoints return a masked version (e.g., `"whsec_****...last4"`). Store the full secret in the database (needed for signing) but never return it in read DTOs.
**Warning signs:** Secret visible in browser dev tools on the subscription list page.

### Pitfall 6: Webhook Delivery Blocking DomainEvent Dispatch
**What goes wrong:** If the webhook handler takes too long (e.g., querying subscriptions with a slow DB query), it blocks the entire `SaveChangesAsync` response.
**Why it happens:** Domain event handlers run sequentially in `DomainEventDispatcher`. The handler query for matching subscriptions runs in the HTTP request context.
**How to avoid:** Keep the handler FAST. Cache active subscriptions (short TTL, 30s-60s). The handler should only: check cache, match, serialize, enqueue to Hangfire. No network calls.
**Warning signs:** Increased latency on entity CRUD endpoints after enabling webhooks.

## Code Examples

### Webhook Secret Generation
```csharp
// Generate a cryptographically secure webhook secret (Stripe-style prefix)
public static string GenerateSecret()
{
    var bytes = RandomNumberGenerator.GetBytes(32);
    return $"whsec_{Convert.ToBase64String(bytes)}";
}
```

### Hangfire Job with Custom Retry Schedule
```csharp
// 7 attempts: immediate, 1min, 5min, 30min, 2hr, 8hr, 24hr
[Queue("webhooks")]
[AutomaticRetry(Attempts = 0)] // Disable Hangfire auto-retry; we manage retries manually
public async Task DeliverAsync(Guid subscriptionId, string jsonPayload, Guid tenantId)
{
    // Manual retry management gives us:
    // 1. Custom delay schedule with jitter
    // 2. Per-subscription failure tracking
    // 3. Auto-disable after 50 consecutive failures
    // 4. Delivery log entries per attempt
}
```

**Note on retry strategy:** Rather than using Hangfire's built-in `[AutomaticRetry]`, use manual retry scheduling via `BackgroundJob.Schedule()` with calculated delays. This provides better control over:
- Per-subscription consecutive failure counting
- Custom exponential backoff with jitter
- Delivery log creation per attempt
- Auto-disable threshold checking after each failure

```csharp
private static readonly int[] RetryDelaysSeconds = { 0, 60, 300, 1800, 7200, 28800, 86400 };

// On failure, schedule next attempt:
if (attemptNumber < 7)
{
    var baseDelay = RetryDelaysSeconds[attemptNumber];
    var jitter = Random.Shared.Next(0, baseDelay / 10 + 1); // 10% jitter
    var delay = TimeSpan.FromSeconds(baseDelay + jitter);

    BackgroundJob.Schedule<WebhookDeliveryService>(
        WebhookDeliveryService.QueueName,
        svc => svc.DeliverAsync(subscriptionId, jsonPayload, tenantId, attemptNumber + 1),
        delay);
}
```

### IHttpClientFactory Registration
```csharp
// In WebhookServiceExtensions.cs
public static IServiceCollection AddWebhookServices(this IServiceCollection services)
{
    services.AddHttpClient("WebhookDelivery", client =>
    {
        client.Timeout = TimeSpan.FromSeconds(30);
        client.DefaultRequestHeaders.Add("User-Agent", "GlobCRM-Webhook/1.0");
    })
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
    {
        AllowAutoRedirect = false, // Prevent redirect-based SSRF bypass
    });

    services.AddScoped<IDomainEventHandler, WebhookDomainEventHandler>();
    services.AddScoped<WebhookDeliveryService>();
    services.AddScoped<WebhookSsrfValidator>();
    services.AddScoped<WebhookPayloadBuilder>();
    services.AddScoped<IWebhookRepository, WebhookRepository>();

    return services;
}
```

### Delivery Log Entity
```csharp
public class WebhookDeliveryLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid SubscriptionId { get; set; }
    public WebhookSubscription Subscription { get; set; } = null!;

    public string EventType { get; set; } = string.Empty;     // e.g. "Contact.Updated"
    public string EntityId { get; set; } = string.Empty;
    public int AttemptNumber { get; set; }
    public bool Success { get; set; }
    public int? HttpStatusCode { get; set; }
    public string? ResponseBody { get; set; }                   // Truncated to 1KB
    public string? ErrorMessage { get; set; }
    public string RequestPayload { get; set; } = string.Empty;  // Full JSON payload
    public long DurationMs { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
```

### Constant-Time Signature Comparison (for documentation to consumers)
```csharp
// Example verification code for webhook consumers (include in docs/API response):
// C#:
using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(webhookSecret));
var computed = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(rawBody))).ToLower();
var received = request.Headers["X-Webhook-Signature"].Replace("sha256=", "");
var isValid = CryptographicOperations.FixedTimeEquals(
    Encoding.UTF8.GetBytes(computed),
    Encoding.UTF8.GetBytes(received));
```

## Discretion Recommendations

### Payload Envelope Structure
**Recommendation:** Include delivery ID, ISO8601 timestamp, event type (dotted format: `contact.created`), tenant ID, and version string `"1.0"`. This matches the industry standard set by Stripe, GitHub, and Shopify.

### Delete Event Payload
**Recommendation:** Include the full entity snapshot as captured before deletion. The `DomainEventInterceptor` captures the entity reference during `SavingChanges` (before the delete is committed), so the data is available. This is far more useful to consumers than just an ID -- they can sync their systems without needing a separate "get entity before delete" API call.

### Delivery Log Inspection Depth
**Recommendation:** Store full request payload (the JSON sent) and truncated response body (first 1KB). Store HTTP status code, duration in milliseconds, error message for failures, and attempt number. This gives admins enough to debug without storing unbounded response data.

### Log Retention Period
**Recommendation:** 30 days. This is sufficient for debugging webhook integration issues while keeping storage manageable. Implement as a simple scheduled Hangfire job that deletes logs older than 30 days (run daily).

### Manual Retry from Delivery Log
**Recommendation:** Yes, include it. Add a "Retry" button on failed delivery log entries that re-enqueues the original payload to the same subscription. This is a simple feature (just enqueue a Hangfire job with the stored payload) that provides significant value for debugging.

## DomainEvent Enhancement Required

The current `DomainEvent` record and `DomainEventInterceptor` need a small enhancement to support old/new values:

**Current `DomainEvent`:**
```csharp
public record DomainEvent(
    string EntityName,
    string EventType,
    object Entity,
    Guid? EntityId,
    Dictionary<string, object?>? ChangedProperties);  // Only new values
```

**Enhanced (add OldValues):**
```csharp
public record DomainEvent(
    string EntityName,
    string EventType,
    object Entity,
    Guid? EntityId,
    Dictionary<string, object?>? ChangedProperties,      // New values (unchanged)
    Dictionary<string, object?>? OldPropertyValues);     // Original values (new)
```

**Interceptor change (in CaptureEvents):**
```csharp
Dictionary<string, object?>? oldValues = null;
if (entry.State == EntityState.Modified)
{
    changedProperties = new Dictionary<string, object?>();
    oldValues = new Dictionary<string, object?>();
    foreach (var prop in entry.Properties)
    {
        if (prop.IsModified)
        {
            changedProperties[prop.Metadata.Name] = prop.CurrentValue;
            oldValues[prop.Metadata.Name] = prop.OriginalValue;
        }
    }
}
```

This is a backward-compatible change -- existing consumers of `DomainEvent` that don't use `OldPropertyValues` are unaffected.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom thread-based retry loops | Hangfire durable job scheduling | 2020+ | No hand-rolled retry infrastructure needed |
| SHA-1 webhook signatures | SHA-256 (HMAC-SHA256) | 2021+ (Stripe, GitHub migrated) | SHA-1 is deprecated; SHA-256 is the standard |
| Validate URL on creation only | Validate URL + resolve DNS on every delivery | 2022+ (SSRF awareness) | Prevents DNS rebinding attacks |
| Retry all failures uniformly | Response code-aware retry (skip 4xx) | Industry standard | Prevents wasting retries on permanent errors |
| Sync webhook delivery | Async via job queue | Industry standard | Prevents CRUD endpoint latency impact |

**Deprecated/outdated:**
- SHA-1 signatures: GitHub deprecated SHA-1 webhook signatures in favor of SHA-256
- Simple string comparison for signatures: Must use constant-time comparison to prevent timing attacks

## Open Questions

1. **Subscription caching strategy for the domain event handler**
   - What we know: The handler needs to quickly find matching subscriptions for each domain event. Querying the DB on every SaveChanges adds latency.
   - What's unclear: Optimal cache TTL and invalidation strategy. A short TTL (30-60s) is simple but may miss recent subscription changes.
   - Recommendation: Use a simple in-memory cache with 60-second TTL, keyed by tenant ID. Invalidate on subscription CRUD operations by bumping a version counter. This is fast enough for the hot path and simple to implement.

2. **Entity serialization for webhook payloads**
   - What we know: The `DomainEvent.Entity` is an `object` reference. We need to serialize it to JSON including specific fields based on entity type.
   - What's unclear: Whether to use the existing DTO `FromEntity` methods or build a separate serializer.
   - Recommendation: Build a dedicated `WebhookPayloadBuilder` that creates a dictionary representation of each entity type. Using existing DTOs would create a tight coupling between webhook payloads (which should be stable API contracts) and internal DTOs (which change frequently). The builder should handle the 5 entity types with a simple switch/dictionary mapping.

3. **Tenant context in the Hangfire webhook delivery job**
   - What we know: `TenantJobFilter` propagates tenant context via job parameters. The delivery service needs tenant context to load the subscription from the DB.
   - What's unclear: Whether the existing `TenantJobFilter` + `TenantScope` combination correctly sets up the `ApplicationDbContext` tenant context in Hangfire jobs.
   - Recommendation: Test this during implementation. The filter sets `TenantScope.CurrentTenantId`, which `TenantProvider` falls back to when no HTTP context exists. This should work, but needs verification because it hasn't been exercised in production yet (no existing Hangfire jobs use tenant-scoped DbContext queries).

## Sources

### Primary (HIGH confidence)
- Codebase: `DomainEventInterceptor.cs`, `DomainEventDispatcher.cs`, `IDomainEvent.cs` -- existing domain event infrastructure
- Codebase: `HangfireServiceExtensions.cs` -- Hangfire configuration with `webhooks` queue
- Codebase: `TenantJobFilter.cs`, `TenantScope.cs` -- tenant context propagation in Hangfire jobs
- Codebase: `DuplicateSettingsController.cs` -- admin settings controller pattern
- Codebase: `ContactsController.cs`, `ContactConfiguration.cs` -- entity/DTO/config patterns
- [Hangfire Queue Configuration](https://docs.hangfire.io/en/latest/background-processing/configuring-queues.html) -- named queue usage
- [Hangfire AutomaticRetryAttribute](https://api.hangfire.io/html/T_Hangfire_AutomaticRetryAttribute.htm) -- retry with custom delays

### Secondary (MEDIUM confidence)
- [HMAC Webhook Security Pattern](https://webhooks.fyi/security/hmac) -- HMAC-SHA256 signing approach
- [Webhook Retry Best Practices (Hookdeck)](https://hookdeck.com/webhooks/guides/webhook-retry-best-practices) -- retry schedule and jitter recommendations
- [Webhook Retry Best Practices (Svix)](https://www.svix.com/resources/webhook-best-practices/retries/) -- dead letter queue, backoff caps
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) -- SSRF defense-in-depth

### Tertiary (LOW confidence)
- [SSRF Defense Limitations (2025)](https://windshock.github.io/en/post/2025-06-25-ssrf-defense/) -- advanced bypass techniques, DNS rebinding specifics
- [Hookdeck SHA256 Signature Guide](https://hookdeck.com/webhooks/guides/how-to-implement-sha256-webhook-signature-verification) -- implementation details

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed, patterns well-established in codebase
- Architecture: HIGH -- domain event handler pattern explicitly designed for this use case (comment in IDomainEvent.cs: "Multiple handlers can be registered for different concerns (webhooks, workflows, etc.)")
- Delivery/retry: HIGH -- Hangfire retry mechanism is well-documented, webhook retry patterns are industry-standard
- SSRF prevention: MEDIUM -- implementation is straightforward but DNS rebinding edge cases need careful testing
- Frontend: HIGH -- follows existing settings page patterns exactly (roles, teams, duplicate rules, custom fields)
- Pitfalls: HIGH -- based on direct codebase analysis (e.g., missing OldValues in DomainEvent is verified)

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (stable domain, no fast-moving dependencies)
