using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository interface for Quote CRUD operations with server-side
/// filtering, sorting, pagination, ownership scope enforcement,
/// line item loading, versioning, and status history.
/// </summary>
public interface IQuoteRepository
{
    /// <summary>
    /// Gets a paged list of quotes with server-side filtering, sorting, and ownership scope.
    /// Includes Contact, Company, and Owner navigations for list display.
    /// </summary>
    Task<PagedResult<Quote>> GetPagedAsync(
        EntityQueryParams queryParams,
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds = null);

    /// <summary>
    /// Gets a single quote by ID for lightweight permission checks.
    /// </summary>
    Task<Quote?> GetByIdAsync(Guid id);

    /// <summary>
    /// Gets a single quote by ID with full navigation loading for the detail page:
    /// LineItems (with Product), Contact, Company, Deal, Owner, StatusHistories.
    /// </summary>
    Task<Quote?> GetByIdWithLineItemsAsync(Guid id);

    /// <summary>
    /// Gets all versions of a quote by the original quote ID, ordered by VersionNumber.
    /// </summary>
    Task<List<Quote>> GetVersionsAsync(Guid originalQuoteId);

    /// <summary>
    /// Creates a new quote entity.
    /// </summary>
    Task<Quote> CreateAsync(Quote quote);

    /// <summary>
    /// Updates an existing quote entity, setting UpdatedAt to UtcNow.
    /// </summary>
    Task UpdateAsync(Quote quote);

    /// <summary>
    /// Deletes a quote by ID.
    /// </summary>
    Task DeleteAsync(Guid id);
}
