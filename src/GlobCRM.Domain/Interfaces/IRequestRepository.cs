using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository interface for Request CRUD operations with server-side
/// filtering, sorting, pagination, and ownership scope enforcement.
/// Follows IActivityRepository pattern, simplified (no Kanban grouping).
/// </summary>
public interface IRequestRepository
{
    /// <summary>
    /// Gets a paged list of requests with server-side filtering, sorting, and ownership scope.
    /// Includes Owner, AssignedTo, Contact, and Company navigations for list display.
    /// </summary>
    Task<PagedResult<Request>> GetPagedAsync(
        EntityQueryParams queryParams,
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds = null);

    /// <summary>
    /// Gets a single request by ID for lightweight permission checks.
    /// </summary>
    Task<Request?> GetByIdAsync(Guid id);

    /// <summary>
    /// Creates a new request entity.
    /// </summary>
    Task<Request> CreateAsync(Request request);

    /// <summary>
    /// Updates an existing request entity, setting UpdatedAt to UtcNow.
    /// </summary>
    Task UpdateAsync(Request request);

    /// <summary>
    /// Deletes a request by ID.
    /// </summary>
    Task DeleteAsync(Guid id);
}
