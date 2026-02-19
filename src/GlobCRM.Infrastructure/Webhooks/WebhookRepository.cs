using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Webhooks;

/// <summary>
/// EF Core implementation of IWebhookRepository.
/// All queries are automatically tenant-scoped via ApplicationDbContext global query filters.
/// </summary>
public class WebhookRepository : IWebhookRepository
{
    private readonly ApplicationDbContext _context;

    public WebhookRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <inheritdoc />
    public async Task<List<WebhookSubscription>> GetActiveSubscriptionsAsync(CancellationToken ct)
    {
        return await _context.WebhookSubscriptions
            .Where(s => s.IsActive && !s.IsDisabled)
            .OrderBy(s => s.Name)
            .ToListAsync(ct);
    }

    /// <inheritdoc />
    public async Task<WebhookSubscription?> GetSubscriptionByIdAsync(Guid id, CancellationToken ct)
    {
        return await _context.WebhookSubscriptions
            .FirstOrDefaultAsync(s => s.Id == id, ct);
    }

    /// <inheritdoc />
    public async Task<WebhookSubscription> CreateSubscriptionAsync(WebhookSubscription subscription, CancellationToken ct)
    {
        _context.WebhookSubscriptions.Add(subscription);
        await _context.SaveChangesAsync(ct);
        return subscription;
    }

    /// <inheritdoc />
    public async Task UpdateSubscriptionAsync(WebhookSubscription subscription, CancellationToken ct)
    {
        subscription.UpdatedAt = DateTimeOffset.UtcNow;
        _context.WebhookSubscriptions.Update(subscription);
        await _context.SaveChangesAsync(ct);
    }

    /// <inheritdoc />
    public async Task DeleteSubscriptionAsync(Guid id, CancellationToken ct)
    {
        var subscription = await _context.WebhookSubscriptions
            .FirstOrDefaultAsync(s => s.Id == id, ct);

        if (subscription is not null)
        {
            _context.WebhookSubscriptions.Remove(subscription);
            await _context.SaveChangesAsync(ct);
        }
    }

    /// <inheritdoc />
    public async Task<(List<WebhookDeliveryLog> Items, int TotalCount)> GetDeliveryLogsAsync(
        Guid? subscriptionId, int page, int pageSize, CancellationToken ct)
    {
        var query = _context.WebhookDeliveryLogs
            .Include(l => l.Subscription)
            .AsQueryable();

        if (subscriptionId.HasValue)
        {
            query = query.Where(l => l.SubscriptionId == subscriptionId.Value);
        }

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(l => l.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    /// <inheritdoc />
    public async Task CreateDeliveryLogAsync(WebhookDeliveryLog log, CancellationToken ct)
    {
        _context.WebhookDeliveryLogs.Add(log);
        await _context.SaveChangesAsync(ct);
    }

    /// <inheritdoc />
    public async Task<List<WebhookSubscription>> GetSubscriptionsForEventAsync(
        string entityName, string eventType, CancellationToken ct)
    {
        var eventKey = $"{entityName}.{eventType}";

        // Load active subscriptions and filter in-memory
        // (JSONB list contains check is more reliable in-memory than via EF translation)
        var activeSubscriptions = await _context.WebhookSubscriptions
            .Where(s => s.IsActive && !s.IsDisabled)
            .ToListAsync(ct);

        return activeSubscriptions
            .Where(s => s.EventSubscriptions.Contains(eventKey))
            .ToList();
    }

    /// <inheritdoc />
    public async Task RegenerateSecretAsync(Guid subscriptionId, string newSecret, CancellationToken ct)
    {
        var subscription = await _context.WebhookSubscriptions
            .FirstOrDefaultAsync(s => s.Id == subscriptionId, ct);

        if (subscription is not null)
        {
            subscription.Secret = newSecret;
            subscription.UpdatedAt = DateTimeOffset.UtcNow;
            await _context.SaveChangesAsync(ct);
        }
    }
}
