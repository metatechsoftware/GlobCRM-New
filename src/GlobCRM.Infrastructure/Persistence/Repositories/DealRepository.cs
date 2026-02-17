using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Persistence.Repositories;

/// <summary>
/// EF Core repository for Deal entities with server-side filtering, sorting,
/// pagination, ownership scope enforcement, pipeline/stage filtering,
/// Kanban loading, and stage history queries. Uses ApplicationDbContext with
/// tenant-scoped global query filters.
/// </summary>
public class DealRepository : IDealRepository
{
    private readonly ApplicationDbContext _db;

    public DealRepository(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<PagedResult<Deal>> GetPagedAsync(
        EntityQueryParams queryParams,
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds = null,
        Guid? pipelineId = null,
        Guid? stageId = null)
    {
        var query = _db.Deals.AsQueryable();

        // 1. Apply pipeline/stage filters
        if (pipelineId.HasValue)
            query = query.Where(d => d.PipelineId == pipelineId.Value);

        if (stageId.HasValue)
            query = query.Where(d => d.PipelineStageId == stageId.Value);

        // 2. Apply ownership scope filtering
        query = ApplyOwnershipScope(query, scope, userId, teamMemberIds);

        // 3. Apply search (case-insensitive across multiple fields)
        if (!string.IsNullOrWhiteSpace(queryParams.Search))
        {
            var search = queryParams.Search.ToLower();
            query = query.Where(d =>
                d.Title.ToLower().Contains(search) ||
                (d.Company != null && d.Company.Name.ToLower().Contains(search)) ||
                (d.Owner != null && d.Owner.FirstName.ToLower().Contains(search)) ||
                (d.Owner != null && d.Owner.LastName.ToLower().Contains(search)));
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
            .Include(d => d.Stage)
            .Include(d => d.Company)
            .Include(d => d.Owner)
            .Skip((queryParams.Page - 1) * queryParams.PageSize)
            .Take(queryParams.PageSize)
            .ToListAsync();

        return new PagedResult<Deal>
        {
            Items = items,
            TotalCount = totalCount,
            Page = queryParams.Page,
            PageSize = queryParams.PageSize
        };
    }

    /// <inheritdoc />
    public async Task<Deal?> GetByIdAsync(Guid id)
    {
        return await _db.Deals
            .Include(d => d.Stage)
            .Include(d => d.Company)
            .Include(d => d.Owner)
            .FirstOrDefaultAsync(d => d.Id == id);
    }

    /// <inheritdoc />
    public async Task<Deal?> GetByIdWithLinksAsync(Guid id)
    {
        return await _db.Deals
            .Include(d => d.Stage)
            .Include(d => d.Pipeline)
            .Include(d => d.Company)
            .Include(d => d.Owner)
            .Include(d => d.DealContacts).ThenInclude(dc => dc.Contact)
            .Include(d => d.DealProducts).ThenInclude(dp => dp.Product)
            .FirstOrDefaultAsync(d => d.Id == id);
    }

    /// <inheritdoc />
    public async Task<List<Deal>> GetByPipelineForKanbanAsync(
        Guid pipelineId,
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds = null,
        bool includeTerminal = false)
    {
        var query = _db.Deals
            .Include(d => d.Stage)
            .Include(d => d.Company)
            .Include(d => d.Owner)
            .Where(d => d.PipelineId == pipelineId)
            .AsQueryable();

        // Filter out terminal stages unless requested
        if (!includeTerminal)
        {
            query = query.Where(d => !d.Stage.IsWon && !d.Stage.IsLost);
        }

        // Apply ownership scope
        query = ApplyOwnershipScope(query, scope, userId, teamMemberIds);

        // Order by Value descending (client-side grouping by StageId)
        return await query
            .OrderByDescending(d => d.Value)
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task<Deal> CreateAsync(Deal deal)
    {
        _db.Deals.Add(deal);
        await _db.SaveChangesAsync();
        return deal;
    }

    /// <inheritdoc />
    public async Task UpdateAsync(Deal deal)
    {
        deal.UpdatedAt = DateTimeOffset.UtcNow;
        _db.Deals.Update(deal);
        await _db.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task DeleteAsync(Guid id)
    {
        var deal = await _db.Deals.FindAsync(id);
        if (deal is not null)
        {
            _db.Deals.Remove(deal);
            await _db.SaveChangesAsync();
        }
    }

    /// <inheritdoc />
    public async Task<List<DealStageHistory>> GetStageHistoryAsync(Guid dealId)
    {
        return await _db.DealStageHistories
            .Include(h => h.FromStage)
            .Include(h => h.ToStage)
            .Include(h => h.ChangedByUser)
            .Where(h => h.DealId == dealId)
            .OrderByDescending(h => h.ChangedAt)
            .ToListAsync();
    }

    /// <summary>
    /// Applies ownership scope filtering to the query.
    /// None: no results. Own: user's records. Team: user + team members. All: no filter.
    /// </summary>
    private static IQueryable<Deal> ApplyOwnershipScope(
        IQueryable<Deal> query,
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds)
    {
        return scope switch
        {
            PermissionScope.All => query,
            PermissionScope.Team => query.Where(d =>
                d.OwnerId == userId ||
                (teamMemberIds != null && teamMemberIds.Contains(d.OwnerId!.Value))),
            PermissionScope.Own => query.Where(d => d.OwnerId == userId),
            PermissionScope.None => query.Where(_ => false),
            _ => query.Where(_ => false)
        };
    }

    /// <summary>
    /// Applies field-level filters using switch on FieldId.
    /// Core fields use standard LINQ operations; custom fields (GUID-length FieldId)
    /// use JSONB containment via EF.Functions.JsonContains for GIN index utilization.
    /// </summary>
    private static IQueryable<Deal> ApplyFilters(
        IQueryable<Deal> query,
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
                query = query.Where(d =>
                    EF.Functions.JsonContains(d.CustomFields, $"{{\"{fieldId}\": \"{value}\"}}"));
                continue;
            }

            // Core field filters
            query = filter.FieldId.ToLower() switch
            {
                "title" => ApplyStringFilter(query, d => d.Title, filter.Operator, filter.Value),
                "description" => ApplyStringFilter(query, d => d.Description!, filter.Operator, filter.Value),
                "companyname" => ApplyStringFilter(query, d => d.Company!.Name, filter.Operator, filter.Value),
                "stagename" => ApplyStringFilter(query, d => d.Stage.Name, filter.Operator, filter.Value),
                "ownername" => ApplyStringFilter(query, d => d.Owner!.FirstName + " " + d.Owner!.LastName, filter.Operator, filter.Value),
                _ => query
            };
        }

        return query;
    }

    /// <summary>
    /// Applies a string comparison filter based on the operator type.
    /// </summary>
    private static IQueryable<Deal> ApplyStringFilter(
        IQueryable<Deal> query,
        System.Linq.Expressions.Expression<Func<Deal, string>> selector,
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
    private static System.Linq.Expressions.Expression<Func<Deal, bool>> CombineExpression(
        System.Linq.Expressions.Expression<Func<Deal, string>> selector,
        System.Linq.Expressions.Expression<Func<string, bool>> predicate)
    {
        var parameter = selector.Parameters[0];
        var selectorBody = selector.Body;
        var predicateBody = new ParameterReplacer(predicate.Parameters[0], selectorBody)
            .Visit(predicate.Body);
        return System.Linq.Expressions.Expression.Lambda<Func<Deal, bool>>(predicateBody, parameter);
    }

    /// <summary>
    /// Applies sorting via switch-based field mapper (no dynamic LINQ dependency).
    /// Default sort: CreatedAt descending.
    /// </summary>
    private static IQueryable<Deal> ApplySorting(
        IQueryable<Deal> query,
        string? sortField,
        string sortDirection)
    {
        var desc = sortDirection.Equals("desc", StringComparison.OrdinalIgnoreCase);

        if (string.IsNullOrWhiteSpace(sortField))
        {
            return desc ? query.OrderBy(d => d.CreatedAt) : query.OrderByDescending(d => d.CreatedAt);
        }

        return sortField.ToLower() switch
        {
            "title" => desc ? query.OrderByDescending(d => d.Title) : query.OrderBy(d => d.Title),
            "value" => desc ? query.OrderByDescending(d => d.Value) : query.OrderBy(d => d.Value),
            "probability" => desc ? query.OrderByDescending(d => d.Probability) : query.OrderBy(d => d.Probability),
            "expectedclosedate" => desc ? query.OrderByDescending(d => d.ExpectedCloseDate) : query.OrderBy(d => d.ExpectedCloseDate),
            "createdat" => desc ? query.OrderByDescending(d => d.CreatedAt) : query.OrderBy(d => d.CreatedAt),
            "updatedat" => desc ? query.OrderByDescending(d => d.UpdatedAt) : query.OrderBy(d => d.UpdatedAt),
            "stagename" => desc ? query.OrderByDescending(d => d.Stage.Name) : query.OrderBy(d => d.Stage.Name),
            "companyname" => desc ? query.OrderByDescending(d => d.Company!.Name) : query.OrderBy(d => d.Company!.Name),
            "ownername" => desc ? query.OrderByDescending(d => d.Owner!.FirstName).ThenByDescending(d => d.Owner!.LastName)
                                : query.OrderBy(d => d.Owner!.FirstName).ThenBy(d => d.Owner!.LastName),
            // Custom field sorting not supported -- would need raw SQL OrderBy for JSONB key extraction.
            // Default to CreatedAt descending for unrecognized fields.
            _ => query.OrderByDescending(d => d.CreatedAt)
        };
    }
}
