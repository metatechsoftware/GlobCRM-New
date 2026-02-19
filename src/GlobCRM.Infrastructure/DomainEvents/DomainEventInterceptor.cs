using GlobCRM.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;

namespace GlobCRM.Infrastructure.DomainEvents;

/// <summary>
/// EF Core SaveChangesInterceptor that captures entity lifecycle events (Created/Updated/Deleted)
/// during SavingChanges and dispatches them via IDomainEventDispatcher after successful save.
///
/// Must be registered AFTER AuditableEntityInterceptor so that audit timestamps are set
/// before domain events capture the final entity state.
///
/// Dispatch failures do NOT fail the primary save operation — consistent with the existing
/// FeedItem/Notification fire-and-forget pattern in the codebase.
/// </summary>
public class DomainEventInterceptor : SaveChangesInterceptor
{
    private readonly IDomainEventDispatcher _dispatcher;
    private readonly ILogger<DomainEventInterceptor> _logger;

    private static readonly AsyncLocal<List<DomainEvent>?> _pendingEvents = new();

    public DomainEventInterceptor(
        IDomainEventDispatcher dispatcher,
        ILogger<DomainEventInterceptor> logger)
    {
        _dispatcher = dispatcher;
        _logger = logger;
    }

    /// <summary>
    /// Before SaveChanges: capture entity states from the ChangeTracker.
    /// Creates DomainEvent records for Added, Modified, and Deleted entities.
    /// For Modified entities, captures the changed property names and new values.
    /// </summary>
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        if (eventData.Context is not null)
            CaptureEvents(eventData.Context);

        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    /// <summary>
    /// Synchronous version of SavingChanges event capture.
    /// </summary>
    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result)
    {
        if (eventData.Context is not null)
            CaptureEvents(eventData.Context);

        return base.SavingChanges(eventData, result);
    }

    /// <summary>
    /// After successful SaveChanges: dispatch all captured events.
    /// Errors in dispatch are logged but do not fail the save operation.
    /// </summary>
    public override async ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData,
        int result,
        CancellationToken cancellationToken = default)
    {
        await DispatchPendingEventsAsync(cancellationToken);
        return await base.SavedChangesAsync(eventData, result, cancellationToken);
    }

    /// <summary>
    /// Synchronous version of post-save event dispatch.
    /// </summary>
    public override int SavedChanges(
        SaveChangesCompletedEventData eventData,
        int result)
    {
        // Fire-and-forget dispatch for sync path
        _ = DispatchPendingEventsAsync(CancellationToken.None);
        return base.SavedChanges(eventData, result);
    }

    private void CaptureEvents(DbContext context)
    {
        var events = new List<DomainEvent>();

        foreach (var entry in context.ChangeTracker.Entries())
        {
            string? eventType = entry.State switch
            {
                EntityState.Added => "Created",
                EntityState.Modified => "Updated",
                EntityState.Deleted => "Deleted",
                _ => null
            };

            if (eventType is null) continue;

            // Extract entity ID via reflection (convention: property named "Id")
            Guid? entityId = null;
            var idProperty = entry.Entity.GetType().GetProperty("Id");
            if (idProperty?.GetValue(entry.Entity) is Guid guidId)
            {
                entityId = guidId;
            }

            // For Modified entities, capture changed properties
            Dictionary<string, object?>? changedProperties = null;
            if (entry.State == EntityState.Modified)
            {
                changedProperties = new Dictionary<string, object?>();
                foreach (var prop in entry.Properties)
                {
                    if (prop.IsModified)
                    {
                        changedProperties[prop.Metadata.Name] = prop.CurrentValue;
                    }
                }
            }

            events.Add(new DomainEvent(
                EntityName: entry.Entity.GetType().Name,
                EventType: eventType,
                Entity: entry.Entity,
                EntityId: entityId,
                ChangedProperties: changedProperties));
        }

        _pendingEvents.Value = events;
    }

    private async Task DispatchPendingEventsAsync(CancellationToken cancellationToken)
    {
        var events = _pendingEvents.Value;
        _pendingEvents.Value = null;

        if (events is null or { Count: 0 }) return;

        foreach (var domainEvent in events)
        {
            try
            {
                await _dispatcher.DispatchAsync(domainEvent, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Failed to dispatch domain event {EventType} for {EntityName} (ID: {EntityId})",
                    domainEvent.EventType,
                    domainEvent.EntityName,
                    domainEvent.EntityId);
            }
        }
    }
}
