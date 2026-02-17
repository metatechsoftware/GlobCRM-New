# Phase 8: Real-Time & Notifications - Research

**Researched:** 2026-02-17
**Domain:** SignalR real-time communication, notification system design, activity feed architecture
**Confidence:** HIGH

## Summary

Phase 8 adds two major subsystems to GlobCRM: (1) a real-time notification system powered by ASP.NET Core SignalR that delivers in-app and email notifications for CRM events, and (2) an activity feed combining system-generated events with user-created social posts. The backend requires new domain entities (Notification, NotificationPreference, FeedItem, FeedComment), a SignalR Hub with JWT authentication and tenant-scoped groups, a notification dispatcher service that raises notifications from existing controllers/services, a background service for due-date-approaching checks, and extensions to the existing email service for notification emails. The Angular frontend requires a SignalR client service wrapper with automatic reconnection, a notification store, a notification center (bell icon + dropdown/panel), notification preferences settings, and a feed feature with activity stream + social posting.

SignalR is already included in the ASP.NET Core shared framework (no additional NuGet package needed for .NET 10). The JavaScript client `@microsoft/signalr` v10.0.0 is the matching npm package. The existing JWT authentication setup needs a small modification to read tokens from the WebSocket query string. CORS configuration already allows credentials from localhost:4200, which is required for SignalR. The existing `IEmailService` and SendGrid infrastructure will be extended with a notification email method for email channel delivery.

**Primary recommendation:** Use SignalR groups for tenant isolation (group per tenant), IHubContext<T> injection for sending notifications from controllers/services, and a centralized NotificationDispatcher service that coordinates in-app persistence, SignalR push, and email delivery based on user preferences.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Microsoft.AspNetCore.SignalR (built-in) | 10.0 | Server-side real-time hub | Included in ASP.NET Core shared framework, no NuGet needed |
| @microsoft/signalr | 10.0.0 | JavaScript/TypeScript SignalR client | Official Microsoft client, version-matched to .NET 10 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| SendGrid (existing) | 9.29.3 | Email notification delivery | Already installed, extend IEmailService for notification emails |
| RazorLight (existing) | 2.3.1 | Email template rendering | Already installed, add notification email templates |
| @ngrx/signals (existing) | 19.2.1 | Frontend state management | Already used for all entity stores |
| @angular/material (existing) | 19.2.19 | UI components (badge, sidenav, menu) | Bell icon badge, notification panel, feed UI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SignalR groups for tenant isolation | Custom connection tracking | Groups are built-in, memory-managed, and sufficient for this scale |
| Background service for due dates | Hangfire/Quartz.NET | Overkill -- project already uses BackgroundService pattern (EmailSyncBackgroundService) |
| Separate notification microservice | Monolith notification service | Monolith is the current architecture, keep consistent |

**Installation (frontend only -- backend is built-in):**
```bash
cd globcrm-web && npm install @microsoft/signalr@10.0.0
```

## Architecture Patterns

### Recommended Project Structure

**Backend:**
```
src/GlobCRM.Domain/
  Entities/
    Notification.cs              # In-app notification entity
    NotificationPreference.cs    # Per-user notification channel preferences
    FeedItem.cs                  # Activity feed entry (system event or social post)
    FeedComment.cs               # Comment on a feed item
  Enums/
    NotificationType.cs          # ActivityAssigned, DealStageChanged, Mention, DueDateApproaching, EmailReceived
    NotificationChannel.cs       # InApp, Email
    FeedItemType.cs              # SystemEvent, SocialPost
  Interfaces/
    INotificationRepository.cs   # Notification CRUD + mark read/unread
    IFeedRepository.cs           # Feed items + comments CRUD

src/GlobCRM.Infrastructure/
  Notifications/
    NotificationServiceExtensions.cs  # DI registration
    NotificationRepository.cs         # EF Core implementation
    NotificationDispatcher.cs         # Coordinates in-app + SignalR + email delivery
    DueDateNotificationService.cs     # BackgroundService for approaching due dates
  Feed/
    FeedServiceExtensions.cs     # DI registration
    FeedRepository.cs            # EF Core implementation
  Persistence/
    Configurations/
      NotificationConfiguration.cs
      NotificationPreferenceConfiguration.cs
      FeedItemConfiguration.cs
      FeedCommentConfiguration.cs
  Email/
    SendGridEmailSender.cs       # Extend with SendNotificationEmailAsync method

src/GlobCRM.Api/
  Hubs/
    CrmHub.cs                    # Main SignalR hub (notifications + feed updates)
  Controllers/
    NotificationsController.cs   # Notification list, mark read, preferences
    FeedController.cs            # Feed items list, create post, add comment
```

**Frontend:**
```
globcrm-web/src/app/
  core/
    signalr/
      signalr.service.ts         # SignalR connection wrapper (root-provided)
  features/
    notifications/
      notification.models.ts     # TypeScript interfaces
      notification.service.ts    # API service
      notification.store.ts      # NgRx Signal Store (root-provided)
      notification-center/
        notification-center.component.ts  # Bell icon + dropdown panel
    feed/
      feed.models.ts             # TypeScript interfaces
      feed.service.ts            # API service
      feed.store.ts              # NgRx Signal Store (component-provided)
      feed-list/
        feed-list.component.ts   # Activity stream + social posts
      feed-post-form/
        feed-post-form.component.ts  # Create new social post
  settings/
    notification-preferences/
      notification-preferences.component.ts  # NOTF-05 preferences UI
```

### Pattern 1: SignalR Hub with JWT Authentication and Tenant Groups
**What:** A single hub that authenticates via JWT, adds connections to tenant-scoped groups, and sends targeted notifications.
**When to use:** All real-time communication in the application.
**Example:**
```csharp
// Source: Microsoft Learn - SignalR Authentication docs (aspnetcore-10.0)
// In DependencyInjection.cs, modify JWT Bearer configuration:
options.Events = new JwtBearerEvents
{
    OnMessageReceived = context =>
    {
        var accessToken = context.Request.Query["access_token"];
        var path = context.HttpContext.Request.Path;
        if (!string.IsNullOrEmpty(accessToken) &&
            path.StartsWithSegments("/hubs"))
        {
            context.Token = accessToken;
        }
        return Task.CompletedTask;
    }
};

// Hub implementation:
[Authorize]
public class CrmHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        // Extract tenant from JWT claims
        var tenantId = Context.User?.FindFirst("organizationId")?.Value;
        var userId = Context.UserIdentifier;
        if (!string.IsNullOrEmpty(tenantId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"tenant_{tenantId}");
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
        }
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        // Groups are automatically cleaned up on disconnect
        await base.OnDisconnectedAsync(exception);
    }
}
```

### Pattern 2: NotificationDispatcher Service (Mediator Pattern)
**What:** A centralized service that receives notification events and dispatches them to the correct channels (in-app DB write, SignalR push, email) based on user preferences.
**When to use:** Every time a notification-worthy event occurs in the system.
**Example:**
```csharp
public class NotificationDispatcher
{
    private readonly ApplicationDbContext _db;
    private readonly IHubContext<CrmHub> _hubContext;
    private readonly IEmailService _emailService;

    public async Task DispatchAsync(NotificationRequest request)
    {
        // 1. Persist to database
        var notification = new Notification { /* ... */ };
        _db.Notifications.Add(notification);
        await _db.SaveChangesAsync();

        // 2. Send real-time via SignalR (always for in-app)
        await _hubContext.Clients
            .Group($"user_{request.RecipientId}")
            .SendAsync("ReceiveNotification", MapToDto(notification));

        // 3. Check user preferences for email channel
        var prefs = await _db.NotificationPreferences
            .FirstOrDefaultAsync(p => p.UserId == request.RecipientId
                && p.NotificationType == request.Type);
        if (prefs?.EmailEnabled == true)
        {
            await _emailService.SendNotificationEmailAsync(/* ... */);
        }
    }
}
```

### Pattern 3: IHubContext Injection in Controllers
**What:** Inject IHubContext<CrmHub> into existing controllers to trigger real-time updates when data changes.
**When to use:** In existing controllers (DealsController, ActivitiesController, etc.) after successful mutations.
**Example:**
```csharp
// Source: Microsoft Learn - SignalR HubContext (aspnetcore-10.0)
public class DealsController : ControllerBase
{
    private readonly IHubContext<CrmHub> _hubContext;
    private readonly NotificationDispatcher _dispatcher;

    [HttpPatch("{id}/stage")]
    public async Task<IActionResult> ChangeStage(Guid id, ChangeStageRequest request)
    {
        // ... existing stage change logic ...

        // After successful stage change, dispatch notification
        await _dispatcher.DispatchAsync(new NotificationRequest
        {
            Type = NotificationType.DealStageChanged,
            RecipientId = deal.OwnerId,
            EntityType = "Deal",
            EntityId = deal.Id,
            Message = $"Deal '{deal.Name}' moved to {newStage.Name}"
        });

        return Ok(result);
    }
}
```

### Pattern 4: Angular SignalR Service (Root-Provided Singleton)
**What:** A root-provided service that manages the SignalR connection lifecycle, handles reconnection, and exposes typed event observables.
**When to use:** Single instance shared across the entire Angular app.
**Example:**
```typescript
// Source: Microsoft Learn - SignalR JavaScript client (aspnetcore-10.0)
@Injectable({ providedIn: 'root' })
export class SignalRService {
  private hubConnection: signalR.HubConnection | null = null;
  private readonly authStore = inject(AuthStore);

  readonly connectionState = signal<'disconnected' | 'connecting' | 'connected'>('disconnected');

  // Typed event subjects
  private notificationSubject = new Subject<NotificationDto>();
  notification$ = this.notificationSubject.asObservable();

  private feedUpdateSubject = new Subject<FeedItemDto>();
  feedUpdate$ = this.feedUpdateSubject.asObservable();

  start(): void {
    const token = this.authStore.accessToken();
    if (!token) return;

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.apiUrl}/hubs/crm`, {
        accessTokenFactory: () => this.authStore.accessToken() ?? ''
      })
      .withAutomaticReconnect([0, 2000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.hubConnection.on('ReceiveNotification', (notification: NotificationDto) => {
      this.notificationSubject.next(notification);
    });

    this.hubConnection.on('FeedUpdate', (feedItem: FeedItemDto) => {
      this.feedUpdateSubject.next(feedItem);
    });

    this.hubConnection.onreconnecting(() => {
      this.connectionState.set('connecting');
    });

    this.hubConnection.onreconnected(() => {
      this.connectionState.set('connected');
    });

    this.hubConnection.onclose(() => {
      this.connectionState.set('disconnected');
    });

    this.connectionState.set('connecting');
    this.hubConnection.start()
      .then(() => this.connectionState.set('connected'))
      .catch(err => console.error('SignalR connection error:', err));
  }

  stop(): void {
    this.hubConnection?.stop();
    this.hubConnection = null;
    this.connectionState.set('disconnected');
  }
}
```

### Pattern 5: Activity Feed with RBAC Filtering
**What:** Feed items are stored with entity references and filtered at query time using the same permission service used by other entities.
**When to use:** All feed queries must respect user's permission scope.
**Example:**
```csharp
// Feed repository applies RBAC filtering
public async Task<PagedResult<FeedItem>> GetFeedAsync(Guid userId, int page, int pageSize)
{
    var query = _db.FeedItems
        .Where(f => f.TenantId == _tenantProvider.GetTenantId())
        .OrderByDescending(f => f.CreatedAt);

    // Social posts visible to all tenant users
    // System events filtered by entity-level RBAC
    // (user can only see events for entities they have View permission on)

    return await query.ToPagedResultAsync(page, pageSize);
}
```

### Anti-Patterns to Avoid
- **Polling for notifications:** Never use HTTP polling when SignalR is available -- it wastes bandwidth and creates unnecessary server load.
- **Storing notification preferences in JSONB on User:** Use a separate NotificationPreference table with proper columns for each notification type, allowing easy queries and updates.
- **Sending notifications synchronously in request pipeline:** The NotificationDispatcher should persist the notification and push via SignalR quickly, but email sending should be fire-and-forget (or queued) to avoid slowing down API responses.
- **Creating separate hubs per feature:** One CrmHub with different event names is simpler and more maintainable than multiple hubs.
- **Not tenant-isolating SignalR groups:** Always use tenant-prefixed group names to prevent cross-tenant notification leakage.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket connection management | Custom WebSocket server | ASP.NET Core SignalR | Handles transport negotiation, reconnection, serialization, groups |
| Automatic reconnection | Manual reconnect timer | `withAutomaticReconnect()` | Built-in exponential backoff with configurable delays |
| JWT token in WebSocket | Custom auth middleware | `OnMessageReceived` event + `accessTokenFactory` | Official pattern, handles query string token for browser WS limitation |
| Connection-to-user mapping | Custom dictionary tracking | SignalR `Context.UserIdentifier` + Groups | Built-in user tracking via IUserIdProvider, auto group cleanup |
| Email notification formatting | String concatenation | RazorLight templates (existing) | Already set up for branded transactional emails |
| Background job scheduling | Custom timer/thread | `BackgroundService` (existing pattern) | Already used for EmailSyncBackgroundService, proven in project |

**Key insight:** SignalR handles all the complex WebSocket lifecycle management (transport fallback, reconnection, serialization, group management) that would take weeks to hand-roll correctly. The only custom code needed is the Hub class, the notification dispatcher, and the Angular service wrapper.

## Common Pitfalls

### Pitfall 1: JWT Token Not Read from WebSocket Query String
**What goes wrong:** SignalR connections fail with 401 Unauthorized because the JWT token is sent in the query string for WebSocket/SSE transports, but the JWT middleware only reads from the Authorization header by default.
**Why it happens:** Browser WebSocket API cannot set HTTP headers, so SignalR sends the token as `?access_token=xxx` query parameter.
**How to avoid:** Add `OnMessageReceived` event handler to `JwtBearerEvents` that reads `access_token` from `context.Request.Query` when the path starts with `/hubs`.
**Warning signs:** 401 errors only when using WebSocket transport; long-polling may still work since it uses regular HTTP headers.

### Pitfall 2: CORS Configuration Missing AllowCredentials for SignalR
**What goes wrong:** SignalR connection fails with CORS errors in the browser console.
**Why it happens:** SignalR requires `AllowCredentials()` in the CORS policy, and you cannot use `AllowAnyOrigin()` with `AllowCredentials()`.
**How to avoid:** The existing CORS policy already uses `WithOrigins("http://localhost:4200").AllowCredentials()` which is correct. Just verify it stays that way.
**Warning signs:** CORS error messages in browser DevTools console during connection attempt.

### Pitfall 3: SignalR Connection Not Started/Stopped with Auth Lifecycle
**What goes wrong:** SignalR connection attempts before authentication, or remains connected after logout exposing stale data.
**Why it happens:** SignalR service starts independently of auth state.
**How to avoid:** Start SignalR connection after successful login (when accessToken becomes available), stop on logout. Use `effect()` in a root component watching `authStore.isAuthenticated()`.
**Warning signs:** Connection errors in console before login page, or notifications arriving after logout.

### Pitfall 4: Tenant Leakage via SignalR Groups
**What goes wrong:** Notifications from one tenant's actions are broadcast to users in another tenant.
**Why it happens:** Group names not prefixed with tenant ID, or notifications sent to `Clients.All` instead of tenant group.
**How to avoid:** Always use `$"tenant_{tenantId}"` group names. Never use `Clients.All` -- always target specific user or tenant groups.
**Warning signs:** Users seeing notifications for entities they don't have access to, or from other organizations.

### Pitfall 5: NotificationStore Not Root-Provided
**What goes wrong:** Each component creates its own notification store instance, losing unread count state between navigations.
**Why it happens:** Following the component-provided pattern used by entity stores (Email, Deal, etc.).
**How to avoid:** NotificationStore and SignalRService MUST be `providedIn: 'root'` since they persist across the entire session. Entity stores are component-provided because each list page is independent, but notifications are global.
**Warning signs:** Unread badge count resets when navigating between pages.

### Pitfall 6: Notification Email Flooding
**What goes wrong:** User receives dozens of email notifications in quick succession (e.g., batch deal stage changes).
**Why it happens:** Each event triggers an immediate email without throttling.
**How to avoid:** For email channel, consider batching or debouncing. For v1, a simpler approach: only send email notifications for high-priority events (assignment, mention, due date approaching) and respect user preference toggles per notification type.
**Warning signs:** User complaints about email volume, SendGrid rate limits hit.

### Pitfall 7: Feed Query Performance Without Indexes
**What goes wrong:** Feed page loads slowly as feed_items table grows.
**Why it happens:** Missing indexes on (tenant_id, created_at) and (entity_type, entity_id) for feed queries.
**How to avoid:** Add composite indexes in the EF Core configuration and create proper GIN indexes for any JSONB columns.
**Warning signs:** Slow feed page load, especially for tenants with high activity.

## Code Examples

Verified patterns from official sources:

### SignalR Hub Endpoint Mapping (Program.cs)
```csharp
// Source: Microsoft Learn - SignalR Configuration (aspnetcore-10.0)
// Add SignalR services
builder.Services.AddSignalR();

// Map hub endpoint (after app.UseAuthentication/UseAuthorization)
app.MapHub<CrmHub>("/hubs/crm");
```

### JWT Bearer Token Query String Handler
```csharp
// Source: Microsoft Learn - SignalR Auth (aspnetcore-10.0)
// Add to existing JwtBearer configuration in DependencyInjection.cs
.AddJwtBearer(options =>
{
    // ... existing token validation parameters ...

    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) &&
                path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});
```

### SignalR Client Connection with JWT (Angular)
```typescript
// Source: Microsoft Learn - SignalR JavaScript client (aspnetcore-10.0)
import * as signalR from '@microsoft/signalr';

const connection = new signalR.HubConnectionBuilder()
  .withUrl('http://localhost:5233/hubs/crm', {
    accessTokenFactory: () => this.authStore.accessToken() ?? ''
  })
  .withAutomaticReconnect([0, 2000, 10000, 30000])
  .configureLogging(signalR.LogLevel.Warning)
  .build();

// Listen for notifications
connection.on('ReceiveNotification', (notification) => {
  console.log('Notification received:', notification);
});

// Start connection
await connection.start();
```

### IHubContext Injection in Controller
```csharp
// Source: Microsoft Learn - SignalR HubContext (aspnetcore-10.0)
public class NotificationsController : ControllerBase
{
    private readonly IHubContext<CrmHub> _hubContext;

    public NotificationsController(IHubContext<CrmHub> hubContext)
    {
        _hubContext = hubContext;
    }

    // Send to specific user
    await _hubContext.Clients
        .Group($"user_{userId}")
        .SendAsync("ReceiveNotification", notificationDto);

    // Send to all users in tenant
    await _hubContext.Clients
        .Group($"tenant_{tenantId}")
        .SendAsync("FeedUpdate", feedItemDto);
}
```

### Background Service with IHubContext
```csharp
// Source: Microsoft Learn - SignalR Background Services (aspnetcore-10.0)
public class DueDateNotificationService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<CrmHub> _hubContext;

    public DueDateNotificationService(
        IServiceScopeFactory scopeFactory,
        IHubContext<CrmHub> hubContext)
    {
        _scopeFactory = scopeFactory;
        _hubContext = hubContext;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            // Query activities with due dates approaching (next 24h)
            // Create notifications + push via SignalR
            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }
}
```

### Notification Preference Entity Pattern
```csharp
public class NotificationPreference
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid UserId { get; set; }
    public NotificationType NotificationType { get; set; }
    public bool InAppEnabled { get; set; } = true;
    public bool EmailEnabled { get; set; } = true;
    public ApplicationUser User { get; set; } = null!;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @aspnet/signalr npm package | @microsoft/signalr npm package | 2020 (ASP.NET Core 3.1) | Old package deprecated, use @microsoft/signalr |
| Manual reconnect timer | withAutomaticReconnect() | 2019 (SignalR 3.0) | Built-in configurable reconnect with backoff |
| Long polling by default | WebSocket with fallback | Current | WebSocket is preferred transport, auto-negotiated |
| No stateful reconnect | Stateful reconnect available | ASP.NET Core 8+ | Buffers messages during brief disconnections, prevents data loss |

**Deprecated/outdated:**
- `@aspnet/signalr` npm package: Deprecated, replaced by `@microsoft/signalr`
- Manual `HubConnection.start()` retry loops: Replaced by `withAutomaticReconnect()`
- Startup.cs class-based configuration: .NET 10 uses minimal API / Program.cs pattern (already used in project)

## Open Questions

1. **Stateful Reconnect (ASP.NET Core 8+ feature)**
   - What we know: Stateful reconnect buffers messages during brief disconnections, available since ASP.NET Core 8
   - What's unclear: Whether it's worth enabling for a CRM notification system where notifications are also persisted to DB
   - Recommendation: Skip for v1 -- notifications are persisted in DB, so missed SignalR messages can be fetched via API on reconnect. Simpler.

2. **Notification Email Batching/Digests**
   - What we know: Individual emails per event can flood users
   - What's unclear: Whether to implement email digests (hourly/daily summary) in v1
   - Recommendation: Start with per-event emails for high-priority types only (assignment, mention, due date). User preferences control which types generate emails. Batching can be Phase 11 polish.

3. **Feed Item Retention/Cleanup**
   - What we know: Feed items accumulate over time, potentially millions per tenant
   - What's unclear: Whether to implement TTL-based cleanup or pagination-only approach
   - Recommendation: Pagination-only for v1 with proper indexes. Add retention policy in Phase 11 if needed.

4. **Mention Detection (@user)**
   - What we know: NOTF-06 requires mention notifications. This implies parsing text for @user references.
   - What's unclear: Where mentions can occur (feed posts? activity comments?) and the exact syntax/UX.
   - Recommendation: Support @mentions in feed posts and activity comments. Simple regex `@\w+` matching against team directory. Frontend autocomplete for @mentions.

## Sources

### Primary (HIGH confidence)
- Microsoft Learn - [SignalR Authentication (aspnetcore-10.0)](https://learn.microsoft.com/en-us/aspnet/core/signalr/authn-and-authz?view=aspnetcore-10.0) - JWT auth, OnMessageReceived, IUserIdProvider
- Microsoft Learn - [SignalR Configuration (aspnetcore-10.0)](https://learn.microsoft.com/en-us/aspnet/core/signalr/configuration?view=aspnetcore-10.0) - Hub options, transport config, timeouts
- Microsoft Learn - [SignalR HubContext (aspnetcore-10.0)](https://learn.microsoft.com/en-us/aspnet/core/signalr/hubcontext?view=aspnetcore-10.0) - IHubContext injection, sending from controllers/services
- Microsoft Learn - [SignalR Groups](https://learn.microsoft.com/en-us/aspnet/core/signalr/groups?view=aspnetcore-9.0) - Group management, user targeting
- NPM - [@microsoft/signalr](https://www.npmjs.com/package/@microsoft/signalr) - v10.0.0, JavaScript client
- Existing codebase patterns - DI extensions, entity configurations, signal stores, background services

### Secondary (MEDIUM confidence)
- Microsoft Learn - [SignalR Background Services](https://learn.microsoft.com/en-us/aspnet/core/signalr/background-services?view=aspnetcore-9.0) - IHubContext in BackgroundService
- [Code Maze - SignalR Angular Integration](https://code-maze.com/netcore-signalr-angular-realtime-charts/) - Angular service wrapper patterns
- [MagicBell - Notification System Design](https://www.magicbell.com/blog/notification-system-design) - Notification architecture patterns

### Tertiary (LOW confidence)
- None -- all critical patterns verified against official Microsoft Learn documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - SignalR is built into ASP.NET Core, @microsoft/signalr is the only official client, well-documented
- Architecture: HIGH - Patterns verified against official docs, consistent with existing project patterns
- Pitfalls: HIGH - JWT query string issue and CORS are well-documented, tenant isolation patterns are clear
- Feed design: MEDIUM - Custom design based on CRM domain knowledge, no single "standard" feed library for .NET

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (30 days -- stable technology, well-established patterns)
