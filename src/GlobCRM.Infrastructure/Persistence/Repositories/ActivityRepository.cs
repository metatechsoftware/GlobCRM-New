using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Persistence.Repositories;

/// <summary>
/// EF Core repository for Activity entities with server-side filtering, sorting,
/// pagination, ownership scope enforcement, entity-scoped queries via ActivityLink,
/// Kanban grouping by status, and status history queries. Uses ApplicationDbContext
/// with tenant-scoped global query filters.
///
/// Ownership scope deviation from Company/Deal: "Own" scope checks BOTH OwnerId
/// and AssignedToId (users see activities they own OR are assigned to). This is
/// because activities are explicitly assigned to different users (ACTV-04).
/// </summary>
public class ActivityRepository : IActivityRepository
{
    private readonly ApplicationDbContext _db;

    public ActivityRepository(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<PagedResult<Activity>> GetPagedAsync(
        EntityQueryParams queryParams,
        Guid? userId,
        PermissionScope scope,
        IEnumerable<Guid>? teamMemberIds,
        string? linkedEntityType = null,
        Guid? linkedEntityId = null)
    {
        var query = _db.Activities.AsQueryable();

        // 1. Apply entity-scoped filtering via ActivityLink
        if (!string.IsNullOrWhiteSpace(linkedEntityType) && linkedEntityId.HasValue)
        {
            var entityType = linkedEntityType;
            var entityId = linkedEntityId.Value;
            query = query.Where(a =>
                a.Links.Any(l => l.EntityType == entityType && l.EntityId == entityId));
        }

        // 2. Apply ownership scope filtering
        query = ApplyOwnershipScope(query, scope, userId, teamMemberIds);

        // 3. Apply search (case-insensitive across subject and description)
        if (!string.IsNullOrWhiteSpace(queryParams.Search))
        {
            var search = queryParams.Search.ToLower();
            query = query.Where(a =>
                a.Subject.ToLower().Contains(search) ||
                (a.Description != null && a.Description.ToLower().Contains(search)) ||
                (a.Owner != null && a.Owner.FirstName.ToLower().Contains(search)) ||
                (a.Owner != null && a.Owner.LastName.ToLower().Contains(search)));
        }

        // 4. Apply filters
        if (queryParams.Filters is { Count: > 0 })
        {
            query = ApplyFilters(query, queryParams.Filters);
        }

        // 5. Apply sorting
        query = ApplySorting(query, queryParams.SortField, queryParams.SortDirection);

        // 6. Get total count before pagination
        var totalCount = await query.CountAsync();

        // 7. Apply pagination and include navigations
        var items = await query
            .Include(a => a.Owner)
            .Include(a => a.AssignedTo)
            .Skip((queryParams.Page - 1) * queryParams.PageSize)
            .Take(queryParams.PageSize)
            .ToListAsync();

        return new PagedResult<Activity>
        {
            Items = items,
            TotalCount = totalCount,
            Page = queryParams.Page,
            PageSize = queryParams.PageSize
        };
    }

    /// <inheritdoc />
    public async Task<Activity?> GetByIdAsync(Guid id)
    {
        return await _db.Activities
            .FirstOrDefaultAsync(a => a.Id == id);
    }

    /// <inheritdoc />
    public async Task<Activity?> GetByIdWithDetailsAsync(Guid id)
    {
        return await _db.Activities
            .Include(a => a.Owner)
            .Include(a => a.AssignedTo)
            .Include(a => a.Comments.OrderByDescending(c => c.CreatedAt))
                .ThenInclude(c => c.Author)
            .Include(a => a.Attachments)
                .ThenInclude(att => att.UploadedBy)
            .Include(a => a.TimeEntries.OrderByDescending(te => te.EntryDate))
                .ThenInclude(te => te.User)
            .Include(a => a.Followers)
                .ThenInclude(f => f.User)
            .Include(a => a.Links)
            .FirstOrDefaultAsync(a => a.Id == id);
    }

    /// <inheritdoc />
    public async Task<List<Activity>> GetByStatusGroupAsync(
        Guid? userId,
        PermissionScope scope,
        IEnumerable<Guid>? teamMemberIds)
    {
        var query = _db.Activities
            .Include(a => a.Owner)
            .Include(a => a.AssignedTo)
            .Where(a => a.Status != ActivityStatus.Done)
            .AsQueryable();

        // Apply ownership scope
        query = ApplyOwnershipScope(query, scope, userId, teamMemberIds);

        // Order by Priority descending (Urgent first), then DueDate ascending (soonest first)
        return await query
            .OrderByDescending(a => a.Priority)
            .ThenBy(a => a.DueDate)
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task<List<ActivityStatusHistory>> GetStatusHistoryAsync(Guid activityId)
    {
        return await _db.ActivityStatusHistories
            .Include(h => h.ChangedByUser)
            .Where(h => h.ActivityId == activityId)
            .OrderByDescending(h => h.ChangedAt)
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task<Activity> CreateAsync(Activity activity)
    {
        _db.Activities.Add(activity);
        await _db.SaveChangesAsync();
        return activity;
    }

    /// <inheritdoc />
    public async Task UpdateAsync(Activity activity)
    {
        activity.UpdatedAt = DateTimeOffset.UtcNow;
        _db.Activities.Update(activity);
        await _db.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task DeleteAsync(Activity activity)
    {
        _db.Activities.Remove(activity);
        await _db.SaveChangesAsync();
    }

    /// <summary>
    /// Applies ownership scope filtering to the query.
    /// Activity deviation: "Own" checks both OwnerId and AssignedToId because
    /// users should see activities they own OR are assigned to (ACTV-04).
    /// "Team" checks both fields against team member IDs.
    /// </summary>
    private static IQueryable<Activity> ApplyOwnershipScope(
        IQueryable<Activity> query,
        PermissionScope scope,
        Guid? userId,
        IEnumerable<Guid>? teamMemberIds)
    {
        var teamIds = teamMemberIds?.ToList();

        return scope switch
        {
            PermissionScope.All => query,
            PermissionScope.Team => query.Where(a =>
                a.OwnerId == userId ||
                a.AssignedToId == userId ||
                (teamIds != null && a.OwnerId.HasValue && teamIds.Contains(a.OwnerId.Value)) ||
                (teamIds != null && a.AssignedToId.HasValue && teamIds.Contains(a.AssignedToId.Value))),
            PermissionScope.Own => query.Where(a =>
                a.OwnerId == userId || a.AssignedToId == userId),
            PermissionScope.None => query.Where(_ => false),
            _ => query.Where(_ => false)
        };
    }

    /// <summary>
    /// Applies field-level filters using switch on FieldId.
    /// Core fields use standard LINQ operations; custom fields (GUID-length FieldId)
    /// use JSONB containment via EF.Functions.JsonContains for GIN index utilization.
    /// </summary>
    private static IQueryable<Activity> ApplyFilters(
        IQueryable<Activity> query,
        List<FilterParam> filters)
    {
        foreach (var filter in filters)
        {
            if (string.IsNullOrEmpty(filter.Value)) continue;

            // Custom field filter (FieldId is a GUID string, length 36)
            if (filter.FieldId.Length == 36 && Guid.TryParse(filter.FieldId, out _))
            {
                var fieldId = filter.FieldId;
                var value = filter.Value;
                query = query.Where(a =>
                    EF.Functions.JsonContains(a.CustomFields, $"{{\"{fieldId}\": \"{value}\"}}"));
                continue;
            }

            // Core field filters
            query = filter.FieldId.ToLower() switch
            {
                "subject" => ApplyStringFilter(query, a => a.Subject, filter.Operator, filter.Value),
                "type" => ApplyStringFilter(query, a => EF.Property<string>(a, "Type"), filter.Operator, filter.Value),
                "status" => ApplyStringFilter(query, a => EF.Property<string>(a, "Status"), filter.Operator, filter.Value),
                "priority" => ApplyStringFilter(query, a => EF.Property<string>(a, "Priority"), filter.Operator, filter.Value),
                "assignedto" => ApplyStringFilter(query, a => a.AssignedTo!.FirstName + " " + a.AssignedTo!.LastName, filter.Operator, filter.Value),
                "ownername" => ApplyStringFilter(query, a => a.Owner!.FirstName + " " + a.Owner!.LastName, filter.Operator, filter.Value),
                _ => query
            };
        }

        return query;
    }

    /// <summary>
    /// Applies a string comparison filter based on the operator type.
    /// </summary>
    private static IQueryable<Activity> ApplyStringFilter(
        IQueryable<Activity> query,
        System.Linq.Expressions.Expression<Func<Activity, string>> selector,
        string filterOperator,
        string value)
    {
        var lowerValue = value.ToLower();

        return filterOperator switch
        {
            "equals" => query.Where(CombineExpression(selector, s => s.ToLower() == lowerValue)),
            "not_equals" => query.Where(CombineExpression(selector, s => s.ToLower() != lowerValue)),
            "contains" => query.Where(CombineExpression(selector, s => s.ToLower().Contains(lowerValue))),
            "starts_with" => query.Where(CombineExpression(selector, s => s.ToLower().StartsWith(lowerValue))),
            _ => query
        };
    }

    /// <summary>
    /// Combines a property selector with a predicate into a single expression tree
    /// that EF Core can translate to SQL.
    /// </summary>
    private static System.Linq.Expressions.Expression<Func<Activity, bool>> CombineExpression(
        System.Linq.Expressions.Expression<Func<Activity, string>> selector,
        System.Linq.Expressions.Expression<Func<string, bool>> predicate)
    {
        var parameter = selector.Parameters[0];
        var selectorBody = selector.Body;
        var predicateBody = new ParameterReplacer(predicate.Parameters[0], selectorBody)
            .Visit(predicate.Body);
        return System.Linq.Expressions.Expression.Lambda<Func<Activity, bool>>(predicateBody, parameter);
    }

    /// <summary>
    /// Applies sorting via switch-based field mapper (no dynamic LINQ dependency).
    /// Default sort: CreatedAt descending.
    /// </summary>
    private static IQueryable<Activity> ApplySorting(
        IQueryable<Activity> query,
        string? sortField,
        string sortDirection)
    {
        var desc = sortDirection.Equals("desc", StringComparison.OrdinalIgnoreCase);

        if (string.IsNullOrWhiteSpace(sortField))
        {
            return desc ? query.OrderBy(a => a.CreatedAt) : query.OrderByDescending(a => a.CreatedAt);
        }

        return sortField.ToLower() switch
        {
            "subject" => desc ? query.OrderByDescending(a => a.Subject) : query.OrderBy(a => a.Subject),
            "type" => desc ? query.OrderByDescending(a => a.Type) : query.OrderBy(a => a.Type),
            "status" => desc ? query.OrderByDescending(a => a.Status) : query.OrderBy(a => a.Status),
            "priority" => desc ? query.OrderByDescending(a => a.Priority) : query.OrderBy(a => a.Priority),
            "duedate" => desc ? query.OrderByDescending(a => a.DueDate) : query.OrderBy(a => a.DueDate),
            "createdat" => desc ? query.OrderByDescending(a => a.CreatedAt) : query.OrderBy(a => a.CreatedAt),
            "updatedat" => desc ? query.OrderByDescending(a => a.UpdatedAt) : query.OrderBy(a => a.UpdatedAt),
            "ownername" => desc ? query.OrderByDescending(a => a.Owner!.FirstName).ThenByDescending(a => a.Owner!.LastName)
                                : query.OrderBy(a => a.Owner!.FirstName).ThenBy(a => a.Owner!.LastName),
            "assignedto" => desc ? query.OrderByDescending(a => a.AssignedTo!.FirstName).ThenByDescending(a => a.AssignedTo!.LastName)
                                 : query.OrderBy(a => a.AssignedTo!.FirstName).ThenBy(a => a.AssignedTo!.LastName),
            // Custom field sorting not supported -- would need raw SQL OrderBy for JSONB key extraction.
            // Default to CreatedAt descending for unrecognized fields.
            _ => query.OrderByDescending(a => a.CreatedAt)
        };
    }
}
