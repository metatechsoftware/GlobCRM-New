namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Dispatches domain events to registered handlers after successful SaveChanges.
/// Implemented by infrastructure layer to resolve handlers from DI.
/// </summary>
public interface IDomainEventDispatcher
{
    /// <summary>
    /// Dispatches a domain event to all registered IDomainEventHandler instances.
    /// Failures in individual handlers are logged but do not propagate.
    /// </summary>
    Task DispatchAsync(DomainEvent domainEvent, CancellationToken ct);
}
