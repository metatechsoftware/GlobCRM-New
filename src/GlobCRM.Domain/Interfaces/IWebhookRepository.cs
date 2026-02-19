using GlobCRM.Domain.Entities;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository interface for webhook subscription and delivery log CRUD operations.
/// Implementations use ApplicationDbContext with tenant-scoped global query filters.
/// </summary>
public interface IWebhookRepository
{
    /// <summary>
    /// Gets all active and non-disabled subscriptions for the current tenant.
    /// </summary>
    Task<List<WebhookSubscription>> GetActiveSubscriptionsAsync(CancellationToken ct);

    /// <summary>
    /// Gets all subscriptions for the current tenant (regardless of active/disabled state).
    /// Used by admin UI for subscription management listing.
    /// </summary>
    Task<List<WebhookSubscription>> GetAllSubscriptionsAsync(CancellationToken ct);

    /// <summary>
    /// Gets a specific subscription by ID (tenant-filtered).
    /// </summary>
    Task<WebhookSubscription?> GetSubscriptionByIdAsync(Guid id, CancellationToken ct);

    /// <summary>
    /// Creates a new webhook subscription.
    /// </summary>
    Task<WebhookSubscription> CreateSubscriptionAsync(WebhookSubscription subscription, CancellationToken ct);

    /// <summary>
    /// Updates an existing webhook subscription.
    /// </summary>
    Task UpdateSubscriptionAsync(WebhookSubscription subscription, CancellationToken ct);

    /// <summary>
    /// Deletes a webhook subscription by ID. Cascade deletes delivery logs.
    /// </summary>
    Task DeleteSubscriptionAsync(Guid id, CancellationToken ct);

    /// <summary>
    /// Gets delivery logs with optional subscription filter and pagination.
    /// Null subscriptionId returns all logs for the current tenant.
    /// </summary>
    Task<(List<WebhookDeliveryLog> Items, int TotalCount)> GetDeliveryLogsAsync(
        Guid? subscriptionId, int page, int pageSize, CancellationToken ct);

    /// <summary>
    /// Creates a delivery log entry.
    /// </summary>
    Task CreateDeliveryLogAsync(WebhookDeliveryLog log, CancellationToken ct);

    /// <summary>
    /// Gets a single delivery log by ID (tenant-filtered, includes subscription navigation).
    /// </summary>
    Task<WebhookDeliveryLog?> GetDeliveryLogByIdAsync(Guid id, CancellationToken ct);

    /// <summary>
    /// Gets active, non-disabled subscriptions that are subscribed to a specific entity+event combination.
    /// Filters in-memory since EventSubscriptions is a JSONB list.
    /// </summary>
    Task<List<WebhookSubscription>> GetSubscriptionsForEventAsync(
        string entityName, string eventType, CancellationToken ct);

    /// <summary>
    /// Regenerates the HMAC secret for a subscription.
    /// </summary>
    Task RegenerateSecretAsync(Guid subscriptionId, string newSecret, CancellationToken ct);
}
