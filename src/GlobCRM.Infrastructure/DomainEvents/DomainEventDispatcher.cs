using GlobCRM.Domain.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.DomainEvents;

/// <summary>
/// Dispatches domain events to all registered IDomainEventHandler instances.
/// Resolves handlers from DI and invokes them sequentially.
/// Errors in individual handlers are logged but do not propagate — consistent with
/// the existing FeedItem/Notification fire-and-forget pattern in the codebase.
/// </summary>
public class DomainEventDispatcher : IDomainEventDispatcher
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<DomainEventDispatcher> _logger;

    public DomainEventDispatcher(
        IServiceProvider serviceProvider,
        ILogger<DomainEventDispatcher> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    /// <summary>
    /// Dispatches a domain event to all registered IDomainEventHandler instances.
    /// Each handler is invoked independently — a failure in one does not prevent others.
    /// </summary>
    public async Task DispatchAsync(DomainEvent domainEvent, CancellationToken ct)
    {
        var handlers = _serviceProvider.GetServices<IDomainEventHandler>();

        foreach (var handler in handlers)
        {
            try
            {
                await handler.HandleAsync(domainEvent, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Domain event handler {HandlerType} failed for {EventType} on {EntityName} (ID: {EntityId})",
                    handler.GetType().Name,
                    domainEvent.EventType,
                    domainEvent.EntityName,
                    domainEvent.EntityId);
            }
        }
    }
}
