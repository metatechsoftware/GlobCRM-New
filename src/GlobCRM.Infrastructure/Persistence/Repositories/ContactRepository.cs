using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Persistence.Repositories;

/// <summary>
/// EF Core repository for Contact entities with server-side filtering, sorting,
/// pagination, and ownership scope enforcement. Includes Company navigation for
/// company name in list DTOs.
/// </summary>
public class ContactRepository : IContactRepository
{
    private readonly ApplicationDbContext _db;

    public ContactRepository(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<PagedResult<Contact>> GetPagedAsync(
        EntityQueryParams queryParams,
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds = null)
    {
        var query = _db.Contacts.AsQueryable();

        // 1. Apply ownership scope filtering
        query = ApplyOwnershipScope(query, scope, userId, teamMemberIds);

        // 2. Apply search (case-insensitive across multiple fields)
        if (!string.IsNullOrWhiteSpace(queryParams.Search))
        {
            var search = queryParams.Search.ToLower();
            query = query.Where(c =>
                c.FirstName.ToLower().Contains(search) ||
                c.LastName.ToLower().Contains(search) ||
                (c.Email != null && c.Email.ToLower().Contains(search)) ||
                (c.JobTitle != null && c.JobTitle.ToLower().Contains(search)) ||
                (c.Department != null && c.Department.ToLower().Contains(search)));
        }

        // 3. Apply filters
        if (queryParams.Filters is { Count: > 0 })
        {
            query = ApplyFilters(query, queryParams.Filters);
        }

        // 4. Apply sorting (include Company for companyName sort)
        query = ApplySorting(query, queryParams.SortField, queryParams.SortDirection);

        // 5. Get total count before pagination
        var totalCount = await query.CountAsync();

        // 6. Apply pagination and include navigations
        var items = await query
            .Include(c => c.Company)
            .Include(c => c.Owner)
            .Skip((queryParams.Page - 1) * queryParams.PageSize)
            .Take(queryParams.PageSize)
            .ToListAsync();

        return new PagedResult<Contact>
        {
            Items = items,
            TotalCount = totalCount,
            Page = queryParams.Page,
            PageSize = queryParams.PageSize
        };
    }

    /// <inheritdoc />
    public async Task<Contact?> GetByIdAsync(Guid id)
    {
        return await _db.Contacts
            .Include(c => c.Company)
            .Include(c => c.Owner)
            .FirstOrDefaultAsync(c => c.Id == id);
    }

    /// <inheritdoc />
    public async Task<List<Contact>> GetByCompanyIdAsync(Guid companyId)
    {
        return await _db.Contacts
            .Where(c => c.CompanyId == companyId)
            .Include(c => c.Owner)
            .OrderBy(c => c.LastName)
            .ThenBy(c => c.FirstName)
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task<Contact> CreateAsync(Contact contact)
    {
        _db.Contacts.Add(contact);
        await _db.SaveChangesAsync();
        return contact;
    }

    /// <inheritdoc />
    public async Task UpdateAsync(Contact contact)
    {
        contact.UpdatedAt = DateTimeOffset.UtcNow;
        _db.Contacts.Update(contact);
        await _db.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task DeleteAsync(Guid id)
    {
        var contact = await _db.Contacts.FindAsync(id);
        if (contact is not null)
        {
            _db.Contacts.Remove(contact);
            await _db.SaveChangesAsync();
        }
    }

    private static IQueryable<Contact> ApplyOwnershipScope(
        IQueryable<Contact> query,
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

    private static IQueryable<Contact> ApplyFilters(
        IQueryable<Contact> query,
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
                query = query.Where(c =>
                    EF.Functions.JsonContains(c.CustomFields, $"{{\"{fieldId}\": \"{value}\"}}"));
                continue;
            }

            var lowerValue = filter.Value.ToLower();

            query = filter.FieldId.ToLower() switch
            {
                "firstname" => ApplyStringFilter(query, c => c.FirstName, filter.Operator, filter.Value),
                "lastname" => ApplyStringFilter(query, c => c.LastName, filter.Operator, filter.Value),
                "email" => ApplyStringFilter(query, c => c.Email!, filter.Operator, filter.Value),
                "jobtitle" => ApplyStringFilter(query, c => c.JobTitle!, filter.Operator, filter.Value),
                "department" => ApplyStringFilter(query, c => c.Department!, filter.Operator, filter.Value),
                "city" => ApplyStringFilter(query, c => c.City!, filter.Operator, filter.Value),
                "state" => ApplyStringFilter(query, c => c.State!, filter.Operator, filter.Value),
                "country" => ApplyStringFilter(query, c => c.Country!, filter.Operator, filter.Value),
                "phone" => ApplyStringFilter(query, c => c.Phone!, filter.Operator, filter.Value),
                _ => query
            };
        }

        return query;
    }

    private static IQueryable<Contact> ApplyStringFilter(
        IQueryable<Contact> query,
        System.Linq.Expressions.Expression<Func<Contact, string>> selector,
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

    private static System.Linq.Expressions.Expression<Func<Contact, bool>> CombineExpression(
        System.Linq.Expressions.Expression<Func<Contact, string>> selector,
        System.Linq.Expressions.Expression<Func<string, bool>> predicate)
    {
        var parameter = selector.Parameters[0];
        var selectorBody = selector.Body;
        var predicateBody = new ParameterReplacer(predicate.Parameters[0], selectorBody)
            .Visit(predicate.Body);
        return System.Linq.Expressions.Expression.Lambda<Func<Contact, bool>>(predicateBody, parameter);
    }

    private static IQueryable<Contact> ApplySorting(
        IQueryable<Contact> query,
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
            "firstname" => desc ? query.OrderByDescending(c => c.FirstName) : query.OrderBy(c => c.FirstName),
            "lastname" => desc ? query.OrderByDescending(c => c.LastName) : query.OrderBy(c => c.LastName),
            "email" => desc ? query.OrderByDescending(c => c.Email) : query.OrderBy(c => c.Email),
            "jobtitle" => desc ? query.OrderByDescending(c => c.JobTitle) : query.OrderBy(c => c.JobTitle),
            "department" => desc ? query.OrderByDescending(c => c.Department) : query.OrderBy(c => c.Department),
            "companyname" => desc
                ? query.Include(c => c.Company).OrderByDescending(c => c.Company!.Name)
                : query.Include(c => c.Company).OrderBy(c => c.Company!.Name),
            "createdat" => desc ? query.OrderByDescending(c => c.CreatedAt) : query.OrderBy(c => c.CreatedAt),
            "updatedat" => desc ? query.OrderByDescending(c => c.UpdatedAt) : query.OrderBy(c => c.UpdatedAt),
            _ => query.OrderByDescending(c => c.CreatedAt)
        };
    }
}
