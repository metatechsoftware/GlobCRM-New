using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Persistence.Repositories;

/// <summary>
/// EF Core repository for Product entities with server-side filtering, sorting,
/// and pagination. Products are shared tenant resources with no ownership scope filtering.
/// </summary>
public class ProductRepository : IProductRepository
{
    private readonly ApplicationDbContext _db;

    public ProductRepository(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<PagedResult<Product>> GetPagedAsync(EntityQueryParams queryParams)
    {
        var query = _db.Products.AsQueryable();

        // 1. Apply search (case-insensitive across multiple fields)
        if (!string.IsNullOrWhiteSpace(queryParams.Search))
        {
            var search = queryParams.Search.ToLower();
            query = query.Where(p =>
                p.Name.ToLower().Contains(search) ||
                (p.SKU != null && p.SKU.ToLower().Contains(search)) ||
                (p.Category != null && p.Category.ToLower().Contains(search)) ||
                (p.Description != null && p.Description.ToLower().Contains(search)));
        }

        // 2. Apply filters
        if (queryParams.Filters is { Count: > 0 })
        {
            query = ApplyFilters(query, queryParams.Filters);
        }

        // 3. Apply sorting
        query = ApplySorting(query, queryParams.SortField, queryParams.SortDirection);

        // 4. Get total count before pagination
        var totalCount = await query.CountAsync();

        // 5. Apply pagination
        var items = await query
            .Skip((queryParams.Page - 1) * queryParams.PageSize)
            .Take(queryParams.PageSize)
            .ToListAsync();

        return new PagedResult<Product>
        {
            Items = items,
            TotalCount = totalCount,
            Page = queryParams.Page,
            PageSize = queryParams.PageSize
        };
    }

    /// <inheritdoc />
    public async Task<Product?> GetByIdAsync(Guid id)
    {
        return await _db.Products.FirstOrDefaultAsync(p => p.Id == id);
    }

    /// <inheritdoc />
    public async Task<Product> CreateAsync(Product product)
    {
        _db.Products.Add(product);
        await _db.SaveChangesAsync();
        return product;
    }

    /// <inheritdoc />
    public async Task UpdateAsync(Product product)
    {
        product.UpdatedAt = DateTimeOffset.UtcNow;
        _db.Products.Update(product);
        await _db.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task DeleteAsync(Guid id)
    {
        var product = await _db.Products.FindAsync(id);
        if (product is not null)
        {
            _db.Products.Remove(product);
            await _db.SaveChangesAsync();
        }
    }

    private static IQueryable<Product> ApplyFilters(
        IQueryable<Product> query,
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
                query = query.Where(p =>
                    EF.Functions.JsonContains(p.CustomFields, $"{{\"{fieldId}\": \"{value}\"}}"));
                continue;
            }

            query = filter.FieldId.ToLower() switch
            {
                "name" => ApplyStringFilter(query, p => p.Name, filter.Operator, filter.Value),
                "sku" => ApplyStringFilter(query, p => p.SKU!, filter.Operator, filter.Value),
                "category" => ApplyStringFilter(query, p => p.Category!, filter.Operator, filter.Value),
                "description" => ApplyStringFilter(query, p => p.Description!, filter.Operator, filter.Value),
                "isactive" => bool.TryParse(filter.Value, out var isActive)
                    ? query.Where(p => p.IsActive == isActive)
                    : query,
                _ => query
            };
        }

        return query;
    }

    private static IQueryable<Product> ApplyStringFilter(
        IQueryable<Product> query,
        System.Linq.Expressions.Expression<Func<Product, string>> selector,
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

    private static System.Linq.Expressions.Expression<Func<Product, bool>> CombineExpression(
        System.Linq.Expressions.Expression<Func<Product, string>> selector,
        System.Linq.Expressions.Expression<Func<string, bool>> predicate)
    {
        var parameter = selector.Parameters[0];
        var selectorBody = selector.Body;
        var predicateBody = new ParameterReplacer(predicate.Parameters[0], selectorBody)
            .Visit(predicate.Body);
        return System.Linq.Expressions.Expression.Lambda<Func<Product, bool>>(predicateBody, parameter);
    }

    private static IQueryable<Product> ApplySorting(
        IQueryable<Product> query,
        string? sortField,
        string sortDirection)
    {
        var desc = sortDirection.Equals("desc", StringComparison.OrdinalIgnoreCase);

        if (string.IsNullOrWhiteSpace(sortField))
        {
            return desc ? query.OrderBy(p => p.CreatedAt) : query.OrderByDescending(p => p.CreatedAt);
        }

        return sortField.ToLower() switch
        {
            "name" => desc ? query.OrderByDescending(p => p.Name) : query.OrderBy(p => p.Name),
            "unitprice" => desc ? query.OrderByDescending(p => p.UnitPrice) : query.OrderBy(p => p.UnitPrice),
            "sku" => desc ? query.OrderByDescending(p => p.SKU) : query.OrderBy(p => p.SKU),
            "category" => desc ? query.OrderByDescending(p => p.Category) : query.OrderBy(p => p.Category),
            "createdat" => desc ? query.OrderByDescending(p => p.CreatedAt) : query.OrderBy(p => p.CreatedAt),
            "updatedat" => desc ? query.OrderByDescending(p => p.UpdatedAt) : query.OrderBy(p => p.UpdatedAt),
            "isactive" => desc ? query.OrderByDescending(p => p.IsActive) : query.OrderBy(p => p.IsActive),
            _ => query.OrderByDescending(p => p.CreatedAt)
        };
    }
}
