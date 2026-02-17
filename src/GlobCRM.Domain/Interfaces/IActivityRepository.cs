using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository interface for Activity CRUD operations with server-side
/// filtering, sorting, pagination, ownership scope enforcement,
/// entity-scoped queries via ActivityLink, Kanban grouping, and status history.
/// </summary>
public interface IActivityRepository
{
    /// <summary>
    /// Gets a paged list of activities with server-side filtering, sorting, ownership scope,
    /// and optional entity-scoped filtering via ActivityLink.
    /// Includes Owner and AssignedTo navigations for name display.
    /// </summary>
    Task<PagedResult<Activity>> GetPagedAsync(
        EntityQueryParams queryParams,
        Guid? userId,
        PermissionScope scope,
        IEnumerable<Guid>? teamMemberIds,
        string? linkedEntityType = null,
        Guid? linkedEntityId = null);

    /// <summary>
    /// Gets a single activity by ID for lightweight permission checks.
    /// </summary>
    Task<Activity?> GetByIdAsync(Guid id);

    /// <summary>
    /// Gets a single activity by ID with full navigation loading for the detail page:
    /// Owner, AssignedTo, Comments (with Author), Attachments (with UploadedBy),
    /// TimeEntries (with User), Followers (with User), Links.
    /// </summary>
    Task<Activity?> GetByIdWithDetailsAsync(Guid id);

    /// <summary>
    /// Gets all non-Done activities for Kanban view, grouped by status.
    /// No pagination — loads all activities with Owner and AssignedTo includes.
    /// Ordered by Priority descending, DueDate ascending.
    /// </summary>
    Task<List<Activity>> GetByStatusGroupAsync(
        Guid? userId,
        PermissionScope scope,
        IEnumerable<Guid>? teamMemberIds);

    /// <summary>
    /// Gets the status transition history for an activity, ordered by ChangedAt descending.
    /// Includes ChangedByUser navigation for timeline display.
    /// </summary>
    Task<List<ActivityStatusHistory>> GetStatusHistoryAsync(Guid activityId);

    /// <summary>
    /// Creates a new activity entity.
    /// </summary>
    Task<Activity> CreateAsync(Activity activity);

    /// <summary>
    /// Updates an existing activity entity, setting UpdatedAt to UtcNow.
    /// </summary>
    Task UpdateAsync(Activity activity);

    /// <summary>
    /// Deletes an activity entity.
    /// </summary>
    Task DeleteAsync(Activity activity);
}
