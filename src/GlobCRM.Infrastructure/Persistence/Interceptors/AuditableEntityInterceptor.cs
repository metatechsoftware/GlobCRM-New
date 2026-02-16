using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace GlobCRM.Infrastructure.Persistence.Interceptors;

/// <summary>
/// EF Core SaveChangesInterceptor that automatically sets CreatedAt on newly added entities
/// and UpdatedAt on modified entities. Uses convention-based detection (entities with
/// CreatedAt/UpdatedAt DateTimeOffset properties).
/// </summary>
public class AuditableEntityInterceptor : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result)
    {
        if (eventData.Context is not null)
            UpdateAuditableEntities(eventData.Context);

        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        if (eventData.Context is not null)
            UpdateAuditableEntities(eventData.Context);

        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private static void UpdateAuditableEntities(DbContext context)
    {
        var now = DateTimeOffset.UtcNow;

        foreach (var entry in context.ChangeTracker.Entries())
        {
            if (entry.State == EntityState.Added)
            {
                SetPropertyIfExists(entry, "CreatedAt", now);
                SetPropertyIfExists(entry, "UpdatedAt", now);
            }
            else if (entry.State == EntityState.Modified)
            {
                SetPropertyIfExists(entry, "UpdatedAt", now);
            }
        }
    }

    private static void SetPropertyIfExists(EntityEntry entry, string propertyName, DateTimeOffset value)
    {
        var property = entry.Properties.FirstOrDefault(p => p.Metadata.Name == propertyName);
        if (property is not null && property.Metadata.ClrType == typeof(DateTimeOffset))
        {
            property.CurrentValue = value;
        }
    }
}
