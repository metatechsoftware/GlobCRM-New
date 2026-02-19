using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using Hangfire;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.Webhooks;

/// <summary>
/// Domain event handler that matches CRM entity events to active webhook subscriptions
/// and enqueues Hangfire delivery jobs.
///
/// Design priorities:
/// - FAST: Only check cache, match, serialize, enqueue. No network calls.
/// - Subscriptions are cached per tenant (60-second TTL) to avoid DB query on every SaveChanges.
/// - Payload is serialized NOW (while entity is in memory) to avoid DbContext disposal issues in Hangfire jobs.
/// - Cache can be invalidated from the API controller on subscription CRUD.
/// </summary>
public class WebhookDomainEventHandler : IDomainEventHandler
{
    private readonly IBackgroundJobClient _jobClient;
    private readonly IWebhookRepository _webhookRepository;
    private readonly ITenantProvider _tenantProvider;
    private readonly WebhookPayloadBuilder _payloadBuilder;
    private readonly IMemoryCache _cache;
    private readonly ILogger<WebhookDomainEventHandler> _logger;

    /// <summary>
    /// The set of entity types eligible for webhook delivery.
    /// Per locked decision: core 5 entities, designed so adding more is trivial.
    /// </summary>
    private static readonly HashSet<string> EligibleEntities =
    [
        "Contact", "Company", "Deal", "Lead", "Activity"
    ];

    /// <summary>
    /// Cache duration for active subscriptions per tenant.
    /// 60-second TTL balances performance with freshness.
    /// </summary>
    private static readonly TimeSpan CacheDuration = TimeSpan.FromSeconds(60);

    public WebhookDomainEventHandler(
        IBackgroundJobClient jobClient,
        IWebhookRepository webhookRepository,
        ITenantProvider tenantProvider,
        WebhookPayloadBuilder payloadBuilder,
        IMemoryCache cache,
        ILogger<WebhookDomainEventHandler> logger)
    {
        _jobClient = jobClient;
        _webhookRepository = webhookRepository;
        _tenantProvider = tenantProvider;
        _payloadBuilder = payloadBuilder;
        _cache = cache;
        _logger = logger;
    }

    /// <summary>
    /// Handles a domain event by matching it to active webhook subscriptions
    /// and enqueuing Hangfire delivery jobs for each match.
    /// </summary>
    public async Task HandleAsync(DomainEvent domainEvent, CancellationToken ct)
    {
        // 1. Check if entity is eligible (early return if not)
        if (!EligibleEntities.Contains(domainEvent.EntityName))
            return;

        // 2. Get tenant ID (early return if null)
        var tenantId = _tenantProvider.GetTenantId();
        if (!tenantId.HasValue)
            return;

        // 3. Load active subscriptions from cache (60-second TTL)
        var cacheKey = $"webhook_subs_{tenantId.Value}";
        var subscriptions = await _cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CacheDuration;
            return await _webhookRepository.GetActiveSubscriptionsAsync(ct);
        });

        if (subscriptions is null or { Count: 0 })
            return;

        // 4. Match events and enqueue delivery jobs
        var eventKey = $"{domainEvent.EntityName}.{domainEvent.EventType}";

        foreach (var subscription in subscriptions)
        {
            if (!subscription.EventSubscriptions.Contains(eventKey))
                continue;

            try
            {
                // 5. Serialize payload NOW (while entity is in memory per pitfall #1)
                var payload = _payloadBuilder.BuildPayload(domainEvent, subscription, tenantId.Value);

                // 6. Enqueue Hangfire job to webhooks queue — attemptNumber starts at 0
                _jobClient.Enqueue<WebhookDeliveryService>(
                    WebhookDeliveryService.QueueName,
                    svc => svc.DeliverAsync(subscription.Id, payload, tenantId.Value, 0));

                _logger.LogDebug(
                    "Webhook job enqueued for subscription {SubscriptionId} ({SubscriptionName}), event {EventKey}",
                    subscription.Id, subscription.Name, eventKey);
            }
            catch (Exception ex)
            {
                // Don't let a serialization/enqueue failure for one subscription affect others
                _logger.LogError(ex,
                    "Failed to enqueue webhook for subscription {SubscriptionId}, event {EventKey}",
                    subscription.Id, eventKey);
            }
        }
    }

    /// <summary>
    /// Invalidates the cached subscription list for a tenant.
    /// Call this from the API controller on subscription create/update/delete.
    /// </summary>
    public void InvalidateCache(Guid tenantId)
    {
        var cacheKey = $"webhook_subs_{tenantId}";
        _cache.Remove(cacheKey);
        _logger.LogDebug("Webhook subscription cache invalidated for tenant {TenantId}", tenantId);
    }
}
