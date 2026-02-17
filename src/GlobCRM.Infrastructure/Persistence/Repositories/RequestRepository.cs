using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Persistence.Repositories;

/// <summary>
/// EF Core repository for Request entities with server-side filtering, sorting,
/// pagination, and dual-ownership scope enforcement. Uses ApplicationDbContext with
/// tenant-scoped global query filters.
///
/// Ownership scope deviation from Company/Deal: "Own" scope checks BOTH OwnerId
/// and AssignedToId (users see requests they own OR are assigned to). This matches
/// the Activity dual-ownership pattern since requests are explicitly assigned.
/// </summary>
public class RequestRepository : IRequestRepository
{
    private readonly ApplicationDbContext _db;

    public RequestRepository(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<PagedResult<Request>> GetPagedAsync(
        EntityQueryParams queryParams,
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds = null)
    {
        var query = _db.Requests.AsQueryable();

        // 1. Apply ownership scope filtering (dual-ownership: OwnerId + AssignedToId)
        query = ApplyOwnershipScope(query, scope, userId, teamMemberIds);

        // 2. Apply search (case-insensitive across multiple fields)
        if (!string.IsNullOrWhiteSpace(queryParams.Search))
        {
            var search = queryParams.Search.ToLower();
            query = query.Where(r =>
                r.Subject.ToLower().Contains(search) ||
                (r.Description != null && r.Description.ToLower().Contains(search)) ||
                (r.Category != null && r.Category.ToLower().Contains(search)) ||
                (r.Owner != null && r.Owner.FirstName.ToLower().Contains(search)) ||
                (r.Owner != null && r.Owner.LastName.ToLower().Contains(search)));
        }

        // 3. Apply filters
        if (queryParams.Filters is { Count: > 0 })
        {
            query = ApplyFilters(query, queryParams.Filters);
        }

        // 4. Apply sorting
        query = ApplySorting(query, queryParams.SortField, queryParams.SortDirection);

        // 5. Get total count before pagination
        var totalCount = await query.CountAsync();

        // 6. Apply pagination and include navigations
        var items = await query
            .Include(r => r.Contact)
            .Include(r => r.Company)
            .Include(r => r.Owner)
            .Include(r => r.AssignedTo)
            .Skip((queryParams.Page - 1) * queryParams.PageSize)
            .Take(queryParams.PageSize)
            .ToListAsync();

        return new PagedResult<Request>
        {
            Items = items,
            TotalCount = totalCount,
            Page = queryParams.Page,
            PageSize = queryParams.PageSize
        };
    }

    /// <inheritdoc />
    public async Task<Request?> GetByIdAsync(Guid id)
    {
        return await _db.Requests
            .Include(r => r.Contact)
            .Include(r => r.Company)
            .Include(r => r.Owner)
            .Include(r => r.AssignedTo)
            .FirstOrDefaultAsync(r => r.Id == id);
    }

    /// <inheritdoc />
    public async Task<Request> CreateAsync(Request request)
    {
        _db.Requests.Add(request);
        await _db.SaveChangesAsync();
        return request;
    }

    /// <inheritdoc />
    public async Task UpdateAsync(Request request)
    {
        request.UpdatedAt = DateTimeOffset.UtcNow;
        _db.Requests.Update(request);
        await _db.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task DeleteAsync(Guid id)
    {
        var request = await _db.Requests.FindAsync(id);
        if (request is not null)
        {
            _db.Requests.Remove(request);
            await _db.SaveChangesAsync();
        }
    }

    /// <summary>
    /// Applies ownership scope filtering to the query.
    /// Request deviation: "Own" checks both OwnerId and AssignedToId because
    /// users should see requests they own OR are assigned to (matching Activity pattern).
    /// "Team" checks both fields against team member IDs.
    /// </summary>
    private static IQueryable<Request> ApplyOwnershipScope(
        IQueryable<Request> query,
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds)
    {
        return scope switch
        {
            PermissionScope.All => query,
            PermissionScope.Team => query.Where(r =>
                r.OwnerId == userId ||
                r.AssignedToId == userId ||
                (teamMemberIds != null && r.OwnerId.HasValue && teamMemberIds.Contains(r.OwnerId.Value)) ||
                (teamMemberIds != null && r.AssignedToId.HasValue && teamMemberIds.Contains(r.AssignedToId.Value))),
            PermissionScope.Own => query.Where(r =>
                r.OwnerId == userId || r.AssignedToId == userId),
            PermissionScope.None => query.Where(_ => false),
            _ => query.Where(_ => false)
        };
    }

    /// <summary>
    /// Applies field-level filters using switch on FieldId.
    /// Supports: status, priority, category, contactId, companyId, ownerId, assignedToId.
    /// Custom fields (GUID-length FieldId) use JSONB containment.
    /// </summary>
    private static IQueryable<Request> ApplyFilters(
        IQueryable<Request> query,
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
                query = query.Where(r =>
                    EF.Functions.JsonContains(r.CustomFields, $"{{\"{fieldId}\": \"{value}\"}}"));
                continue;
            }

            // Core field filters
            query = filter.FieldId.ToLower() switch
            {
                "subject" => ApplyStringFilter(query, r => r.Subject, filter.Operator, filter.Value),
                "status" => ApplyStringFilter(query, r => EF.Property<string>(r, "Status"), filter.Operator, filter.Value),
                "priority" => ApplyStringFilter(query, r => EF.Property<string>(r, "Priority"), filter.Operator, filter.Value),
                "category" => ApplyStringFilter(query, r => r.Category!, filter.Operator, filter.Value),
                "contactid" => Guid.TryParse(filter.Value, out var contactId)
                    ? query.Where(r => r.ContactId == contactId)
                    : query,
                "companyid" => Guid.TryParse(filter.Value, out var companyId)
                    ? query.Where(r => r.CompanyId == companyId)
                    : query,
                "ownerid" => Guid.TryParse(filter.Value, out var ownerId)
                    ? query.Where(r => r.OwnerId == ownerId)
                    : query,
                "assignedtoid" => Guid.TryParse(filter.Value, out var assignedToId)
                    ? query.Where(r => r.AssignedToId == assignedToId)
                    : query,
                "ownername" => ApplyStringFilter(query, r => r.Owner!.FirstName + " " + r.Owner!.LastName, filter.Operator, filter.Value),
                "assignedto" => ApplyStringFilter(query, r => r.AssignedTo!.FirstName + " " + r.AssignedTo!.LastName, filter.Operator, filter.Value),
                _ => query
            };
        }

        return query;
    }

    /// <summary>
    /// Applies a string comparison filter based on the operator type.
    /// </summary>
    private static IQueryable<Request> ApplyStringFilter(
        IQueryable<Request> query,
        System.Linq.Expressions.Expression<Func<Request, string>> selector,
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
    private static System.Linq.Expressions.Expression<Func<Request, bool>> CombineExpression(
        System.Linq.Expressions.Expression<Func<Request, string>> selector,
        System.Linq.Expressions.Expression<Func<string, bool>> predicate)
    {
        var parameter = selector.Parameters[0];
        var selectorBody = selector.Body;
        var predicateBody = new ParameterReplacer(predicate.Parameters[0], selectorBody)
            .Visit(predicate.Body);
        return System.Linq.Expressions.Expression.Lambda<Func<Request, bool>>(predicateBody, parameter);
    }

    /// <summary>
    /// Applies sorting via switch-based field mapper (no dynamic LINQ dependency).
    /// Default sort: CreatedAt descending.
    /// </summary>
    private static IQueryable<Request> ApplySorting(
        IQueryable<Request> query,
        string? sortField,
        string sortDirection)
    {
        var desc = sortDirection.Equals("desc", StringComparison.OrdinalIgnoreCase);

        if (string.IsNullOrWhiteSpace(sortField))
        {
            return desc ? query.OrderBy(r => r.CreatedAt) : query.OrderByDescending(r => r.CreatedAt);
        }

        return sortField.ToLower() switch
        {
            "subject" => desc ? query.OrderByDescending(r => r.Subject) : query.OrderBy(r => r.Subject),
            "status" => desc ? query.OrderByDescending(r => r.Status) : query.OrderBy(r => r.Status),
            "priority" => desc ? query.OrderByDescending(r => r.Priority) : query.OrderBy(r => r.Priority),
            "category" => desc ? query.OrderByDescending(r => r.Category) : query.OrderBy(r => r.Category),
            "createdat" => desc ? query.OrderByDescending(r => r.CreatedAt) : query.OrderBy(r => r.CreatedAt),
            "ownername" => desc ? query.OrderByDescending(r => r.Owner!.FirstName).ThenByDescending(r => r.Owner!.LastName)
                                : query.OrderBy(r => r.Owner!.FirstName).ThenBy(r => r.Owner!.LastName),
            "assignedto" => desc ? query.OrderByDescending(r => r.AssignedTo!.FirstName).ThenByDescending(r => r.AssignedTo!.LastName)
                                 : query.OrderBy(r => r.AssignedTo!.FirstName).ThenBy(r => r.AssignedTo!.LastName),
            // Custom field sorting not supported -- would need raw SQL OrderBy for JSONB key extraction.
            // Default to CreatedAt descending for unrecognized fields.
            _ => query.OrderByDescending(r => r.CreatedAt)
        };
    }
}
