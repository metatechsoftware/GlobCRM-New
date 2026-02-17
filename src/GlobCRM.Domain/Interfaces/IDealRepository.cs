using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository interface for Deal CRUD operations with server-side
/// filtering, sorting, pagination, ownership scope enforcement,
/// pipeline/stage filtering, Kanban loading, and stage history.
/// </summary>
public interface IDealRepository
{
    /// <summary>
    /// Gets a paged list of deals with server-side filtering, sorting, ownership scope,
    /// and optional pipeline/stage filtering.
    /// Includes Stage, Company, and Owner navigations.
    /// </summary>
    Task<PagedResult<Deal>> GetPagedAsync(
        EntityQueryParams queryParams,
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds = null,
        Guid? pipelineId = null,
        Guid? stageId = null);

    /// <summary>
    /// Gets a single deal by ID with Stage, Company, and Owner navigations.
    /// </summary>
    Task<Deal?> GetByIdAsync(Guid id);

    /// <summary>
    /// Gets a single deal by ID with full navigation loading for the detail page:
    /// Stage, Pipeline, Company, Owner, DealContacts.Contact, DealProducts.Product.
    /// </summary>
    Task<Deal?> GetByIdWithLinksAsync(Guid id);

    /// <summary>
    /// Gets all deals for a pipeline for Kanban board display.
    /// No pagination — loads all deals with Stage, Company, Owner includes.
    /// Filters by ownership scope. Excludes terminal (IsWon/IsLost) stages unless includeTerminal is true.
    /// Ordered by Value descending within each stage (client-side grouping).
    /// </summary>
    Task<List<Deal>> GetByPipelineForKanbanAsync(
        Guid pipelineId,
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds = null,
        bool includeTerminal = false);

    /// <summary>
    /// Creates a new deal entity.
    /// </summary>
    Task<Deal> CreateAsync(Deal deal);

    /// <summary>
    /// Updates an existing deal entity, setting UpdatedAt to UtcNow.
    /// </summary>
    Task UpdateAsync(Deal deal);

    /// <summary>
    /// Deletes a deal by ID.
    /// </summary>
    Task DeleteAsync(Guid id);

    /// <summary>
    /// Gets the stage transition history for a deal, ordered by ChangedAt descending.
    /// Includes FromStage, ToStage, and ChangedByUser navigations for timeline display.
    /// </summary>
    Task<List<DealStageHistory>> GetStageHistoryAsync(Guid dealId);
}
