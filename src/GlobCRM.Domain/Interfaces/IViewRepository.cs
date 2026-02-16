using GlobCRM.Domain.Entities;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository for saved view CRUD operations.
/// Operates on ApplicationDbContext (tenant-scoped via global query filters).
/// Supports both personal views (OwnerId set) and team-wide views (OwnerId null).
/// </summary>
public interface IViewRepository
{
    /// <summary>
    /// Gets views for an entity type: personal views for the specified user + all team-wide views.
    /// Ordered by IsTeamDefault descending, then Name ascending.
    /// </summary>
    Task<List<SavedView>> GetViewsByEntityTypeAsync(string entityType, Guid userId);

    /// <summary>
    /// Gets a single view by ID. Returns null if not found.
    /// </summary>
    Task<SavedView?> GetByIdAsync(Guid id);

    /// <summary>
    /// Gets the team default view for an entity type.
    /// Returns null if no team default is set.
    /// </summary>
    Task<SavedView?> GetTeamDefaultAsync(string entityType);

    /// <summary>
    /// Creates a new saved view.
    /// </summary>
    Task<SavedView> CreateAsync(SavedView view);

    /// <summary>
    /// Updates an existing saved view.
    /// </summary>
    Task UpdateAsync(SavedView view);

    /// <summary>
    /// Deletes a saved view.
    /// </summary>
    Task DeleteAsync(Guid id);

    /// <summary>
    /// Sets a view as the team default for its entity type.
    /// Unsets the previous team default for that entity type in a transaction.
    /// </summary>
    Task SetTeamDefaultAsync(Guid viewId);
}
