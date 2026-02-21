using GlobCRM.Domain.Entities;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository interface for Integration and IntegrationActivityLog entities.
/// All queries are automatically tenant-scoped via EF Core global query filters.
/// </summary>
public interface IIntegrationRepository
{
    /// <summary>
    /// Finds an integration by its key slug (e.g., "slack") for the current tenant.
    /// </summary>
    Task<Integration?> GetByKeyAsync(string integrationKey);

    /// <summary>
    /// Returns all integrations for the current tenant.
    /// </summary>
    Task<List<Integration>> GetAllAsync();

    /// <summary>
    /// Finds a single integration by its ID.
    /// </summary>
    Task<Integration?> GetByIdAsync(Guid id);

    /// <summary>
    /// Returns the most recent activity log entries for an integration,
    /// ordered by CreatedAt descending.
    /// </summary>
    Task<List<IntegrationActivityLog>> GetActivityLogsAsync(Guid integrationId, int limit = 50);

    /// <summary>
    /// Adds a new integration entity to the context.
    /// </summary>
    Task AddAsync(Integration integration);

    /// <summary>
    /// Adds a new activity log entry to the context.
    /// </summary>
    Task AddActivityLogAsync(IntegrationActivityLog log);

    /// <summary>
    /// Persists all tracked changes to the database.
    /// </summary>
    Task SaveChangesAsync();
}
