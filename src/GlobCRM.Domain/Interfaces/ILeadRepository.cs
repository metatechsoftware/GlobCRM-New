using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository interface for Lead CRUD operations with server-side
/// filtering, sorting, pagination, ownership scope enforcement,
/// stage/source/temperature filtering, Kanban loading, and stage history.
/// </summary>
public interface ILeadRepository
{
    /// <summary>
    /// Gets a paged list of leads with server-side filtering, sorting, ownership scope,
    /// and optional stage/source/temperature filtering.
    /// Includes Stage, Source, and Owner navigations.
    /// </summary>
    Task<PagedResult<Lead>> GetPagedAsync(
        EntityQueryParams queryParams,
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds = null,
        Guid? stageId = null,
        Guid? sourceId = null,
        LeadTemperature? temperature = null);

    /// <summary>
    /// Gets a single lead by ID with Stage, Source, and Owner navigations.
    /// </summary>
    Task<Lead?> GetByIdAsync(Guid id);

    /// <summary>
    /// Gets a single lead by ID with full navigation loading for the detail page:
    /// Stage, Source, Owner, and LeadConversion with Contact, Company, Deal navigations.
    /// </summary>
    Task<Lead?> GetByIdWithDetailsAsync(Guid id);

    /// <summary>
    /// Gets all leads for Kanban board display.
    /// No pagination -- loads all leads with Stage, Source, Owner includes.
    /// Filters by ownership scope. Excludes terminal (IsConverted/IsLost) stages unless includeTerminal is true.
    /// Ordered by CreatedAt descending.
    /// </summary>
    Task<List<Lead>> GetForKanbanAsync(
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds = null,
        bool includeTerminal = false);

    /// <summary>
    /// Creates a new lead entity.
    /// </summary>
    Task<Lead> CreateAsync(Lead lead);

    /// <summary>
    /// Updates an existing lead entity, setting UpdatedAt to UtcNow.
    /// </summary>
    Task UpdateAsync(Lead lead);

    /// <summary>
    /// Deletes a lead by ID.
    /// </summary>
    Task DeleteAsync(Guid id);

    /// <summary>
    /// Gets the stage transition history for a lead, ordered by ChangedAt descending.
    /// Includes FromStage, ToStage, and ChangedByUser navigations for timeline display.
    /// </summary>
    Task<List<LeadStageHistory>> GetStageHistoryAsync(Guid leadId);

    /// <summary>
    /// Gets all lead stages for the current tenant, ordered by SortOrder.
    /// </summary>
    Task<List<LeadStage>> GetStagesAsync();

    /// <summary>
    /// Gets all lead sources for the current tenant, ordered by SortOrder.
    /// </summary>
    Task<List<LeadSource>> GetSourcesAsync();
}
