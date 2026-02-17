using GlobCRM.Domain.Entities;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository interface for Pipeline CRUD operations with stage management.
/// Pipelines are admin-configured entities with ordered stages.
/// </summary>
public interface IPipelineRepository
{
    /// <summary>
    /// Gets all pipelines for the current tenant, including ordered stages.
    /// Ordered by IsDefault descending then Name ascending.
    /// </summary>
    Task<List<Pipeline>> GetAllAsync();

    /// <summary>
    /// Gets a single pipeline by ID with its stages ordered by SortOrder.
    /// </summary>
    Task<Pipeline?> GetByIdWithStagesAsync(Guid id);

    /// <summary>
    /// Creates a new pipeline entity with its stages.
    /// </summary>
    Task<Pipeline> CreateAsync(Pipeline pipeline);

    /// <summary>
    /// Updates an existing pipeline entity and its stages.
    /// </summary>
    Task UpdateAsync(Pipeline pipeline);

    /// <summary>
    /// Deletes a pipeline by ID. Will cascade delete stages.
    /// </summary>
    Task DeleteAsync(Guid id);

    /// <summary>
    /// Checks whether any deals are currently in the specified stage.
    /// Used to prevent stage removal when deals are assigned to it.
    /// </summary>
    Task<bool> HasDealsInStageAsync(Guid stageId);
}
