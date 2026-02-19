namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Represents a domain event captured by the DomainEventInterceptor during SaveChanges.
/// Contains entity lifecycle information (Created/Updated/Deleted) with change tracking details.
/// </summary>
/// <param name="EntityName">The CLR type name of the entity (e.g., "Contact", "Deal").</param>
/// <param name="EventType">The lifecycle event type: "Created", "Updated", or "Deleted".</param>
/// <param name="Entity">Reference to the entity instance.</param>
/// <param name="EntityId">The entity's Id property value, if available.</param>
/// <param name="ChangedProperties">For Updated events: dictionary of property name to new value. Null for Created/Deleted.</param>
public record DomainEvent(
    string EntityName,
    string EventType,
    object Entity,
    Guid? EntityId,
    Dictionary<string, object?>? ChangedProperties);

/// <summary>
/// Handler for domain events. Implementations are resolved from DI and invoked
/// by the DomainEventDispatcher after successful SaveChanges.
/// Multiple handlers can be registered for different concerns (webhooks, workflows, etc.).
/// </summary>
public interface IDomainEventHandler
{
    /// <summary>
    /// Handles a domain event asynchronously.
    /// Implementations should be resilient — exceptions are caught by the dispatcher
    /// and do not fail the primary save operation.
    /// </summary>
    Task HandleAsync(DomainEvent domainEvent, CancellationToken ct);
}
