using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Persistence.Repositories;

/// <summary>
/// EF Core repository for Lead entities with server-side filtering, sorting,
/// pagination, ownership scope enforcement, stage/source/temperature filtering,
/// Kanban loading, and stage history queries. Uses ApplicationDbContext with
/// tenant-scoped global query filters.
/// </summary>
public class LeadRepository : ILeadRepository
{
    private readonly ApplicationDbContext _db;

    public LeadRepository(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<PagedResult<Lead>> GetPagedAsync(
        EntityQueryParams queryParams,
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds = null,
        Guid? stageId = null,
        Guid? sourceId = null,
        LeadTemperature? temperature = null)
    {
        var query = _db.Leads.AsQueryable();

        // 1. Apply stage/source/temperature filters
        if (stageId.HasValue)
            query = query.Where(l => l.LeadStageId == stageId.Value);

        if (sourceId.HasValue)
            query = query.Where(l => l.LeadSourceId == sourceId.Value);

        if (temperature.HasValue)
            query = query.Where(l => l.Temperature == temperature.Value);

        // 2. Apply ownership scope filtering
        query = ApplyOwnershipScope(query, scope, userId, teamMemberIds);

        // 3. Apply search (case-insensitive across multiple fields)
        if (!string.IsNullOrWhiteSpace(queryParams.Search))
        {
            var search = queryParams.Search.ToLower();
            query = query.Where(l =>
                l.FirstName.ToLower().Contains(search) ||
                l.LastName.ToLower().Contains(search) ||
                (l.Email != null && l.Email.ToLower().Contains(search)) ||
                (l.CompanyName != null && l.CompanyName.ToLower().Contains(search)) ||
                (l.Owner != null && l.Owner.FirstName.ToLower().Contains(search)) ||
                (l.Owner != null && l.Owner.LastName.ToLower().Contains(search)));
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
            .Include(l => l.Stage)
            .Include(l => l.Source)
            .Include(l => l.Owner)
            .Skip((queryParams.Page - 1) * queryParams.PageSize)
            .Take(queryParams.PageSize)
            .ToListAsync();

        return new PagedResult<Lead>
        {
            Items = items,
            TotalCount = totalCount,
            Page = queryParams.Page,
            PageSize = queryParams.PageSize
        };
    }

    /// <inheritdoc />
    public async Task<Lead?> GetByIdAsync(Guid id)
    {
        return await _db.Leads
            .Include(l => l.Stage)
            .Include(l => l.Source)
            .Include(l => l.Owner)
            .FirstOrDefaultAsync(l => l.Id == id);
    }

    /// <inheritdoc />
    public async Task<Lead?> GetByIdWithDetailsAsync(Guid id)
    {
        var lead = await _db.Leads
            .Include(l => l.Stage)
            .Include(l => l.Source)
            .Include(l => l.Owner)
            .Include(l => l.LeadConversion)
            .FirstOrDefaultAsync(l => l.Id == id);

        // Eagerly load conversion navigations if conversion exists
        if (lead?.LeadConversion != null)
        {
            await _db.Entry(lead.LeadConversion)
                .Reference(c => c.Contact)
                .LoadAsync();

            if (lead.LeadConversion.CompanyId.HasValue)
            {
                await _db.Entry(lead.LeadConversion)
                    .Reference(c => c.Company)
                    .LoadAsync();
            }

            if (lead.LeadConversion.DealId.HasValue)
            {
                await _db.Entry(lead.LeadConversion)
                    .Reference(c => c.Deal)
                    .LoadAsync();
            }
        }

        return lead;
    }

    /// <inheritdoc />
    public async Task<List<Lead>> GetForKanbanAsync(
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds = null,
        bool includeTerminal = false)
    {
        var query = _db.Leads
            .Include(l => l.Stage)
            .Include(l => l.Source)
            .Include(l => l.Owner)
            .AsQueryable();

        // Filter out terminal stages unless requested
        if (!includeTerminal)
        {
            query = query.Where(l => !l.Stage.IsConverted && !l.Stage.IsLost);
        }

        // Apply ownership scope
        query = ApplyOwnershipScope(query, scope, userId, teamMemberIds);

        // Order by CreatedAt descending (client-side grouping by StageId)
        return await query
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task<Lead> CreateAsync(Lead lead)
    {
        _db.Leads.Add(lead);
        await _db.SaveChangesAsync();
        return lead;
    }

    /// <inheritdoc />
    public async Task UpdateAsync(Lead lead)
    {
        lead.UpdatedAt = DateTimeOffset.UtcNow;
        _db.Leads.Update(lead);
        await _db.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task DeleteAsync(Guid id)
    {
        var lead = await _db.Leads.FindAsync(id);
        if (lead is not null)
        {
            _db.Leads.Remove(lead);
            await _db.SaveChangesAsync();
        }
    }

    /// <inheritdoc />
    public async Task<List<LeadStageHistory>> GetStageHistoryAsync(Guid leadId)
    {
        return await _db.LeadStageHistories
            .Include(h => h.FromStage)
            .Include(h => h.ToStage)
            .Include(h => h.ChangedByUser)
            .Where(h => h.LeadId == leadId)
            .OrderByDescending(h => h.ChangedAt)
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task<List<LeadStage>> GetStagesAsync()
    {
        return await _db.LeadStages
            .OrderBy(s => s.SortOrder)
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task<List<LeadSource>> GetSourcesAsync()
    {
        return await _db.LeadSources
            .OrderBy(s => s.SortOrder)
            .ToListAsync();
    }

    /// <summary>
    /// Applies ownership scope filtering to the query.
    /// None: no results. Own: user's records. Team: user + team members. All: no filter.
    /// </summary>
    private static IQueryable<Lead> ApplyOwnershipScope(
        IQueryable<Lead> query,
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds)
    {
        return scope switch
        {
            PermissionScope.All => query,
            PermissionScope.Team => query.Where(l =>
                l.OwnerId == userId ||
                (teamMemberIds != null && teamMemberIds.Contains(l.OwnerId!.Value))),
            PermissionScope.Own => query.Where(l => l.OwnerId == userId),
            PermissionScope.None => query.Where(_ => false),
            _ => query.Where(_ => false)
        };
    }

    /// <summary>
    /// Applies field-level filters using switch on FieldId.
    /// Core fields use standard LINQ operations; custom fields (GUID-length FieldId)
    /// use JSONB containment via EF.Functions.JsonContains for GIN index utilization.
    /// </summary>
    private static IQueryable<Lead> ApplyFilters(
        IQueryable<Lead> query,
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
                query = query.Where(l =>
                    EF.Functions.JsonContains(l.CustomFields, $"{{\"{fieldId}\": \"{value}\"}}"));
                continue;
            }

            // Core field filters
            query = filter.FieldId.ToLower() switch
            {
                "firstname" => ApplyStringFilter(query, l => l.FirstName, filter.Operator, filter.Value),
                "lastname" => ApplyStringFilter(query, l => l.LastName, filter.Operator, filter.Value),
                "email" => ApplyStringFilter(query, l => l.Email!, filter.Operator, filter.Value),
                "companyname" => ApplyStringFilter(query, l => l.CompanyName!, filter.Operator, filter.Value),
                "description" => ApplyStringFilter(query, l => l.Description!, filter.Operator, filter.Value),
                "stagename" => ApplyStringFilter(query, l => l.Stage.Name, filter.Operator, filter.Value),
                "sourcename" => ApplyStringFilter(query, l => l.Source!.Name, filter.Operator, filter.Value),
                "ownername" => ApplyStringFilter(query, l => l.Owner!.FirstName + " " + l.Owner!.LastName, filter.Operator, filter.Value),
                _ => query
            };
        }

        return query;
    }

    /// <summary>
    /// Applies a string comparison filter based on the operator type.
    /// </summary>
    private static IQueryable<Lead> ApplyStringFilter(
        IQueryable<Lead> query,
        System.Linq.Expressions.Expression<Func<Lead, string>> selector,
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
    private static System.Linq.Expressions.Expression<Func<Lead, bool>> CombineExpression(
        System.Linq.Expressions.Expression<Func<Lead, string>> selector,
        System.Linq.Expressions.Expression<Func<string, bool>> predicate)
    {
        var parameter = selector.Parameters[0];
        var selectorBody = selector.Body;
        var predicateBody = new ParameterReplacer(predicate.Parameters[0], selectorBody)
            .Visit(predicate.Body);
        return System.Linq.Expressions.Expression.Lambda<Func<Lead, bool>>(predicateBody, parameter);
    }

    /// <summary>
    /// Applies sorting via switch-based field mapper (no dynamic LINQ dependency).
    /// Default sort: CreatedAt descending.
    /// </summary>
    private static IQueryable<Lead> ApplySorting(
        IQueryable<Lead> query,
        string? sortField,
        string sortDirection)
    {
        var desc = sortDirection.Equals("desc", StringComparison.OrdinalIgnoreCase);

        if (string.IsNullOrWhiteSpace(sortField))
        {
            return desc ? query.OrderBy(l => l.CreatedAt) : query.OrderByDescending(l => l.CreatedAt);
        }

        return sortField.ToLower() switch
        {
            "firstname" => desc ? query.OrderByDescending(l => l.FirstName) : query.OrderBy(l => l.FirstName),
            "lastname" => desc ? query.OrderByDescending(l => l.LastName) : query.OrderBy(l => l.LastName),
            "email" => desc ? query.OrderByDescending(l => l.Email) : query.OrderBy(l => l.Email),
            "companyname" => desc ? query.OrderByDescending(l => l.CompanyName) : query.OrderBy(l => l.CompanyName),
            "temperature" => desc ? query.OrderByDescending(l => l.Temperature) : query.OrderBy(l => l.Temperature),
            "createdat" => desc ? query.OrderByDescending(l => l.CreatedAt) : query.OrderBy(l => l.CreatedAt),
            "updatedat" => desc ? query.OrderByDescending(l => l.UpdatedAt) : query.OrderBy(l => l.UpdatedAt),
            "stagename" => desc ? query.OrderByDescending(l => l.Stage.Name) : query.OrderBy(l => l.Stage.Name),
            "sourcename" => desc ? query.OrderByDescending(l => l.Source!.Name) : query.OrderBy(l => l.Source!.Name),
            "ownername" => desc ? query.OrderByDescending(l => l.Owner!.FirstName).ThenByDescending(l => l.Owner!.LastName)
                                : query.OrderBy(l => l.Owner!.FirstName).ThenBy(l => l.Owner!.LastName),
            _ => query.OrderByDescending(l => l.CreatedAt)
        };
    }
}
