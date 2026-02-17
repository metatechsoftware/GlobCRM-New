using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository interface for KPI target CRUD operations.
/// Handles personal and team-wide target management with metric-based queries.
/// </summary>
public interface ITargetRepository
{
    /// <summary>
    /// Gets a target by ID.
    /// </summary>
    Task<Target?> GetByIdAsync(Guid id);

    /// <summary>
    /// Gets all targets visible to a user. Includes team-wide (OwnerId null)
    /// and personal targets matching the specified ownerId.
    /// Pass null to get only team-wide targets.
    /// </summary>
    Task<List<Target>> GetAllAsync(Guid? ownerId);

    /// <summary>
    /// Creates a new target.
    /// </summary>
    Task CreateAsync(Target target);

    /// <summary>
    /// Updates an existing target.
    /// </summary>
    Task UpdateAsync(Target target);

    /// <summary>
    /// Deletes a target by ID.
    /// </summary>
    Task DeleteAsync(Guid id);

    /// <summary>
    /// Gets targets for a specific metric type, filtered by owner.
    /// Pass null for ownerId to get only team-wide targets for the metric.
    /// </summary>
    Task<List<Target>> GetByMetricAsync(MetricType metric, Guid? ownerId);
}
