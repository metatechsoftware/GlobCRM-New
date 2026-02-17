using GlobCRM.Domain.Entities;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository interface for dashboard CRUD operations.
/// Handles personal and team-wide dashboard management with default selection.
/// </summary>
public interface IDashboardRepository
{
    /// <summary>
    /// Gets a dashboard by ID, including its widgets.
    /// </summary>
    Task<Dashboard?> GetByIdAsync(Guid id);

    /// <summary>
    /// Gets all dashboards visible to a user. Includes team-wide (OwnerId null)
    /// and personal dashboards matching the specified ownerId.
    /// Pass null to get only team-wide dashboards.
    /// </summary>
    Task<List<Dashboard>> GetAllAsync(Guid? ownerId);

    /// <summary>
    /// Creates a new dashboard.
    /// </summary>
    Task CreateAsync(Dashboard dashboard);

    /// <summary>
    /// Updates an existing dashboard and its widgets.
    /// </summary>
    Task UpdateAsync(Dashboard dashboard);

    /// <summary>
    /// Deletes a dashboard and all its widgets (cascade).
    /// </summary>
    Task DeleteAsync(Guid id);

    /// <summary>
    /// Gets the default dashboard for a user. Checks personal default first,
    /// then falls back to team-wide default.
    /// Pass null to get only the team-wide default.
    /// </summary>
    Task<Dashboard?> GetDefaultAsync(Guid? ownerId);
}
