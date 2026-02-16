using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository interface for Product CRUD operations with server-side
/// filtering, sorting, and pagination. Products are shared tenant resources
/// with no ownership scope filtering.
/// </summary>
public interface IProductRepository
{
    /// <summary>
    /// Gets a paged list of products with server-side filtering, sorting, and pagination.
    /// No ownership scope filtering (products are shared resources).
    /// </summary>
    Task<PagedResult<Product>> GetPagedAsync(EntityQueryParams queryParams);

    /// <summary>
    /// Gets a single product by ID.
    /// </summary>
    Task<Product?> GetByIdAsync(Guid id);

    /// <summary>
    /// Creates a new product entity.
    /// </summary>
    Task<Product> CreateAsync(Product product);

    /// <summary>
    /// Updates an existing product entity, setting UpdatedAt to UtcNow.
    /// </summary>
    Task UpdateAsync(Product product);

    /// <summary>
    /// Deletes a product by ID.
    /// </summary>
    Task DeleteAsync(Guid id);
}
