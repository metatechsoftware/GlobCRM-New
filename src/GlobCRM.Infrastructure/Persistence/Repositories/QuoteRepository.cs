using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Persistence.Repositories;

/// <summary>
/// EF Core repository for Quote entities with server-side filtering, sorting,
/// pagination, ownership scope enforcement, line item eager loading, versioning
/// queries, and status history. Uses ApplicationDbContext with tenant-scoped
/// global query filters.
/// </summary>
public class QuoteRepository : IQuoteRepository
{
    private readonly ApplicationDbContext _db;

    public QuoteRepository(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<PagedResult<Quote>> GetPagedAsync(
        EntityQueryParams queryParams,
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds = null)
    {
        var query = _db.Quotes.AsQueryable();

        // 1. Apply ownership scope filtering
        query = ApplyOwnershipScope(query, scope, userId, teamMemberIds);

        // 2. Apply search (case-insensitive across multiple fields)
        if (!string.IsNullOrWhiteSpace(queryParams.Search))
        {
            var search = queryParams.Search.ToLower();
            query = query.Where(q =>
                q.Title.ToLower().Contains(search) ||
                q.QuoteNumber.ToLower().Contains(search) ||
                (q.Contact != null && (q.Contact.FirstName.ToLower().Contains(search) || q.Contact.LastName.ToLower().Contains(search))) ||
                (q.Company != null && q.Company.Name.ToLower().Contains(search)));
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
            .Include(q => q.Contact)
            .Include(q => q.Company)
            .Include(q => q.Deal)
            .Include(q => q.Owner)
            .Skip((queryParams.Page - 1) * queryParams.PageSize)
            .Take(queryParams.PageSize)
            .ToListAsync();

        return new PagedResult<Quote>
        {
            Items = items,
            TotalCount = totalCount,
            Page = queryParams.Page,
            PageSize = queryParams.PageSize
        };
    }

    /// <inheritdoc />
    public async Task<Quote?> GetByIdAsync(Guid id)
    {
        return await _db.Quotes
            .Include(q => q.Contact)
            .Include(q => q.Company)
            .Include(q => q.Deal)
            .Include(q => q.Owner)
            .FirstOrDefaultAsync(q => q.Id == id);
    }

    /// <inheritdoc />
    public async Task<Quote?> GetByIdWithLineItemsAsync(Guid id)
    {
        return await _db.Quotes
            .Include(q => q.LineItems.OrderBy(li => li.SortOrder))
                .ThenInclude(li => li.Product)
            .Include(q => q.Contact)
            .Include(q => q.Company)
            .Include(q => q.Deal)
            .Include(q => q.Owner)
            .Include(q => q.StatusHistories.OrderByDescending(sh => sh.ChangedAt))
            .FirstOrDefaultAsync(q => q.Id == id);
    }

    /// <inheritdoc />
    public async Task<List<Quote>> GetVersionsAsync(Guid originalQuoteId)
    {
        return await _db.Quotes
            .Where(q => q.OriginalQuoteId == originalQuoteId || q.Id == originalQuoteId)
            .OrderByDescending(q => q.VersionNumber)
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task<Quote> CreateAsync(Quote quote)
    {
        _db.Quotes.Add(quote);
        await _db.SaveChangesAsync();
        return quote;
    }

    /// <inheritdoc />
    public async Task UpdateAsync(Quote quote)
    {
        quote.UpdatedAt = DateTimeOffset.UtcNow;
        _db.Quotes.Update(quote);
        await _db.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task DeleteAsync(Guid id)
    {
        var quote = await _db.Quotes.FindAsync(id);
        if (quote is not null)
        {
            _db.Quotes.Remove(quote);
            await _db.SaveChangesAsync();
        }
    }

    /// <summary>
    /// Applies ownership scope filtering to the query.
    /// None: no results. Own: user's records. Team: user + team members. All: no filter.
    /// </summary>
    private static IQueryable<Quote> ApplyOwnershipScope(
        IQueryable<Quote> query,
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds)
    {
        return scope switch
        {
            PermissionScope.All => query,
            PermissionScope.Team => query.Where(q =>
                q.OwnerId == userId ||
                (teamMemberIds != null && teamMemberIds.Contains(q.OwnerId!.Value))),
            PermissionScope.Own => query.Where(q => q.OwnerId == userId),
            PermissionScope.None => query.Where(_ => false),
            _ => query.Where(_ => false)
        };
    }

    /// <summary>
    /// Applies field-level filters using switch on FieldId.
    /// Supports: status, contactId, companyId, dealId, ownerId, plus string fields.
    /// Custom fields (GUID-length FieldId) use JSONB containment.
    /// </summary>
    private static IQueryable<Quote> ApplyFilters(
        IQueryable<Quote> query,
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
                query = query.Where(q =>
                    EF.Functions.JsonContains(q.CustomFields, $"{{\"{fieldId}\": \"{value}\"}}"));
                continue;
            }

            // Core field filters
            query = filter.FieldId.ToLower() switch
            {
                "status" => ApplyStringFilter(query, q => EF.Property<string>(q, "Status"), filter.Operator, filter.Value),
                "title" => ApplyStringFilter(query, q => q.Title, filter.Operator, filter.Value),
                "quotenumber" => ApplyStringFilter(query, q => q.QuoteNumber, filter.Operator, filter.Value),
                "contactid" => Guid.TryParse(filter.Value, out var contactId)
                    ? query.Where(q => q.ContactId == contactId)
                    : query,
                "companyid" => Guid.TryParse(filter.Value, out var companyId)
                    ? query.Where(q => q.CompanyId == companyId)
                    : query,
                "dealid" => Guid.TryParse(filter.Value, out var dealId)
                    ? query.Where(q => q.DealId == dealId)
                    : query,
                "ownerid" => Guid.TryParse(filter.Value, out var ownerId)
                    ? query.Where(q => q.OwnerId == ownerId)
                    : query,
                "contactname" => ApplyStringFilter(query, q => q.Contact!.FirstName + " " + q.Contact!.LastName, filter.Operator, filter.Value),
                "companyname" => ApplyStringFilter(query, q => q.Company!.Name, filter.Operator, filter.Value),
                "ownername" => ApplyStringFilter(query, q => q.Owner!.FirstName + " " + q.Owner!.LastName, filter.Operator, filter.Value),
                _ => query
            };
        }

        return query;
    }

    /// <summary>
    /// Applies a string comparison filter based on the operator type.
    /// </summary>
    private static IQueryable<Quote> ApplyStringFilter(
        IQueryable<Quote> query,
        System.Linq.Expressions.Expression<Func<Quote, string>> selector,
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
    private static System.Linq.Expressions.Expression<Func<Quote, bool>> CombineExpression(
        System.Linq.Expressions.Expression<Func<Quote, string>> selector,
        System.Linq.Expressions.Expression<Func<string, bool>> predicate)
    {
        var parameter = selector.Parameters[0];
        var selectorBody = selector.Body;
        var predicateBody = new ParameterReplacer(predicate.Parameters[0], selectorBody)
            .Visit(predicate.Body);
        return System.Linq.Expressions.Expression.Lambda<Func<Quote, bool>>(predicateBody, parameter);
    }

    /// <summary>
    /// Applies sorting via switch-based field mapper (no dynamic LINQ dependency).
    /// Default sort: CreatedAt descending.
    /// </summary>
    private static IQueryable<Quote> ApplySorting(
        IQueryable<Quote> query,
        string? sortField,
        string sortDirection)
    {
        var desc = sortDirection.Equals("desc", StringComparison.OrdinalIgnoreCase);

        if (string.IsNullOrWhiteSpace(sortField))
        {
            return desc ? query.OrderBy(q => q.CreatedAt) : query.OrderByDescending(q => q.CreatedAt);
        }

        return sortField.ToLower() switch
        {
            "quotenumber" => desc ? query.OrderByDescending(q => q.QuoteNumber) : query.OrderBy(q => q.QuoteNumber),
            "title" => desc ? query.OrderByDescending(q => q.Title) : query.OrderBy(q => q.Title),
            "status" => desc ? query.OrderByDescending(q => q.Status) : query.OrderBy(q => q.Status),
            "grandtotal" => desc ? query.OrderByDescending(q => q.GrandTotal) : query.OrderBy(q => q.GrandTotal),
            "issuedate" => desc ? query.OrderByDescending(q => q.IssueDate) : query.OrderBy(q => q.IssueDate),
            "createdat" => desc ? query.OrderByDescending(q => q.CreatedAt) : query.OrderBy(q => q.CreatedAt),
            "contactname" => desc ? query.OrderByDescending(q => q.Contact!.FirstName).ThenByDescending(q => q.Contact!.LastName)
                                  : query.OrderBy(q => q.Contact!.FirstName).ThenBy(q => q.Contact!.LastName),
            "companyname" => desc ? query.OrderByDescending(q => q.Company!.Name) : query.OrderBy(q => q.Company!.Name),
            "ownername" => desc ? query.OrderByDescending(q => q.Owner!.FirstName).ThenByDescending(q => q.Owner!.LastName)
                                : query.OrderBy(q => q.Owner!.FirstName).ThenBy(q => q.Owner!.LastName),
            // Custom field sorting not supported -- would need raw SQL OrderBy for JSONB key extraction.
            // Default to CreatedAt descending for unrecognized fields.
            _ => query.OrderByDescending(q => q.CreatedAt)
        };
    }
}
