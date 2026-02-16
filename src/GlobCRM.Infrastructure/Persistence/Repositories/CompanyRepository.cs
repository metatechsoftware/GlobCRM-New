using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Persistence.Repositories;

/// <summary>
/// EF Core repository for Company entities with server-side filtering, sorting,
/// pagination, and ownership scope enforcement. Uses ApplicationDbContext with
/// tenant-scoped global query filters.
/// </summary>
public class CompanyRepository : ICompanyRepository
{
    private readonly ApplicationDbContext _db;

    public CompanyRepository(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<PagedResult<Company>> GetPagedAsync(
        EntityQueryParams queryParams,
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds = null)
    {
        var query = _db.Companies.AsQueryable();

        // 1. Apply ownership scope filtering
        query = ApplyOwnershipScope(query, scope, userId, teamMemberIds);

        // 2. Apply search (case-insensitive across multiple fields)
        if (!string.IsNullOrWhiteSpace(queryParams.Search))
        {
            var search = queryParams.Search.ToLower();
            query = query.Where(c =>
                c.Name.ToLower().Contains(search) ||
                (c.Industry != null && c.Industry.ToLower().Contains(search)) ||
                (c.Email != null && c.Email.ToLower().Contains(search)) ||
                (c.City != null && c.City.ToLower().Contains(search)));
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

        // 6. Apply pagination and include Owner navigation
        var items = await query
            .Include(c => c.Owner)
            .Skip((queryParams.Page - 1) * queryParams.PageSize)
            .Take(queryParams.PageSize)
            .ToListAsync();

        return new PagedResult<Company>
        {
            Items = items,
            TotalCount = totalCount,
            Page = queryParams.Page,
            PageSize = queryParams.PageSize
        };
    }

    /// <inheritdoc />
    public async Task<Company?> GetByIdAsync(Guid id)
    {
        return await _db.Companies
            .Include(c => c.Owner)
            .FirstOrDefaultAsync(c => c.Id == id);
    }

    /// <inheritdoc />
    public async Task<Company> CreateAsync(Company company)
    {
        _db.Companies.Add(company);
        await _db.SaveChangesAsync();
        return company;
    }

    /// <inheritdoc />
    public async Task UpdateAsync(Company company)
    {
        company.UpdatedAt = DateTimeOffset.UtcNow;
        _db.Companies.Update(company);
        await _db.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task DeleteAsync(Guid id)
    {
        var company = await _db.Companies.FindAsync(id);
        if (company is not null)
        {
            _db.Companies.Remove(company);
            await _db.SaveChangesAsync();
        }
    }

    /// <summary>
    /// Applies ownership scope filtering to the query.
    /// None: no results. Own: user's records. Team: user + team members. All: no filter.
    /// </summary>
    private static IQueryable<Company> ApplyOwnershipScope(
        IQueryable<Company> query,
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds)
    {
        return scope switch
        {
            PermissionScope.All => query,
            PermissionScope.Team => query.Where(c =>
                c.OwnerId == userId ||
                (teamMemberIds != null && teamMemberIds.Contains(c.OwnerId!.Value))),
            PermissionScope.Own => query.Where(c => c.OwnerId == userId),
            PermissionScope.None => query.Where(_ => false),
            _ => query.Where(_ => false)
        };
    }

    /// <summary>
    /// Applies field-level filters using switch on FieldId.
    /// Core fields use standard LINQ operations; custom fields (GUID-length FieldId)
    /// use JSONB containment via EF.Functions.JsonContains for GIN index utilization.
    /// </summary>
    private static IQueryable<Company> ApplyFilters(
        IQueryable<Company> query,
        List<FilterParam> filters)
    {
        foreach (var filter in filters)
        {
            if (string.IsNullOrEmpty(filter.Value)) continue;

            // Custom field filter (FieldId is a GUID string, length 36)
            if (filter.FieldId.Length == 36 && Guid.TryParse(filter.FieldId, out _))
            {
                // Use raw SQL for JSONB containment to leverage GIN index
                var fieldId = filter.FieldId;
                var value = filter.Value;
                query = query.Where(c =>
                    EF.Functions.JsonContains(c.CustomFields, $"{{\"{fieldId}\": \"{value}\"}}"));
                continue;
            }

            // Core field filters
            query = filter.FieldId.ToLower() switch
            {
                "name" => ApplyStringFilter(query, c => c.Name, filter.Operator, filter.Value),
                "industry" => ApplyStringFilter(query, c => c.Industry!, filter.Operator, filter.Value),
                "city" => ApplyStringFilter(query, c => c.City!, filter.Operator, filter.Value),
                "state" => ApplyStringFilter(query, c => c.State!, filter.Operator, filter.Value),
                "country" => ApplyStringFilter(query, c => c.Country!, filter.Operator, filter.Value),
                "email" => ApplyStringFilter(query, c => c.Email!, filter.Operator, filter.Value),
                "phone" => ApplyStringFilter(query, c => c.Phone!, filter.Operator, filter.Value),
                "website" => ApplyStringFilter(query, c => c.Website!, filter.Operator, filter.Value),
                "size" => ApplyStringFilter(query, c => c.Size!, filter.Operator, filter.Value),
                _ => query
            };
        }

        return query;
    }

    /// <summary>
    /// Applies a string comparison filter based on the operator type.
    /// </summary>
    private static IQueryable<Company> ApplyStringFilter(
        IQueryable<Company> query,
        System.Linq.Expressions.Expression<Func<Company, string>> selector,
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
    private static System.Linq.Expressions.Expression<Func<Company, bool>> CombineExpression(
        System.Linq.Expressions.Expression<Func<Company, string>> selector,
        System.Linq.Expressions.Expression<Func<string, bool>> predicate)
    {
        var parameter = selector.Parameters[0];
        var selectorBody = selector.Body;
        var predicateBody = new ParameterReplacer(predicate.Parameters[0], selectorBody)
            .Visit(predicate.Body);
        return System.Linq.Expressions.Expression.Lambda<Func<Company, bool>>(predicateBody, parameter);
    }

    /// <summary>
    /// Applies sorting via switch-based field mapper (no dynamic LINQ dependency).
    /// Default sort: CreatedAt descending.
    /// </summary>
    private static IQueryable<Company> ApplySorting(
        IQueryable<Company> query,
        string? sortField,
        string sortDirection)
    {
        var desc = sortDirection.Equals("desc", StringComparison.OrdinalIgnoreCase);

        if (string.IsNullOrWhiteSpace(sortField))
        {
            return desc ? query.OrderBy(c => c.CreatedAt) : query.OrderByDescending(c => c.CreatedAt);
        }

        return sortField.ToLower() switch
        {
            "name" => desc ? query.OrderByDescending(c => c.Name) : query.OrderBy(c => c.Name),
            "industry" => desc ? query.OrderByDescending(c => c.Industry) : query.OrderBy(c => c.Industry),
            "city" => desc ? query.OrderByDescending(c => c.City) : query.OrderBy(c => c.City),
            "state" => desc ? query.OrderByDescending(c => c.State) : query.OrderBy(c => c.State),
            "country" => desc ? query.OrderByDescending(c => c.Country) : query.OrderBy(c => c.Country),
            "email" => desc ? query.OrderByDescending(c => c.Email) : query.OrderBy(c => c.Email),
            "size" => desc ? query.OrderByDescending(c => c.Size) : query.OrderBy(c => c.Size),
            "createdat" => desc ? query.OrderByDescending(c => c.CreatedAt) : query.OrderBy(c => c.CreatedAt),
            "updatedat" => desc ? query.OrderByDescending(c => c.UpdatedAt) : query.OrderBy(c => c.UpdatedAt),
            // Custom field sorting not supported -- would need raw SQL OrderBy.
            // Default to CreatedAt descending for unrecognized fields.
            _ => query.OrderByDescending(c => c.CreatedAt)
        };
    }
}

/// <summary>
/// Expression tree visitor that replaces one parameter with another expression.
/// Used to compose property selector and predicate expressions for EF Core translation.
/// </summary>
internal class ParameterReplacer : System.Linq.Expressions.ExpressionVisitor
{
    private readonly System.Linq.Expressions.ParameterExpression _oldParameter;
    private readonly System.Linq.Expressions.Expression _newExpression;

    public ParameterReplacer(
        System.Linq.Expressions.ParameterExpression oldParameter,
        System.Linq.Expressions.Expression newExpression)
    {
        _oldParameter = oldParameter;
        _newExpression = newExpression;
    }

    protected override System.Linq.Expressions.Expression VisitParameter(
        System.Linq.Expressions.ParameterExpression node)
    {
        return node == _oldParameter ? _newExpression : base.VisitParameter(node);
    }
}
