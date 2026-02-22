using GlobCRM.Domain.Entities;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository interface for QuoteTemplate CRUD operations.
/// All queries are automatically tenant-scoped via EF Core global query filters.
/// </summary>
public interface IQuoteTemplateRepository
{
    /// <summary>
    /// Returns all quote templates for the current tenant, ordered by CreatedAt descending.
    /// </summary>
    Task<List<QuoteTemplate>> GetAllAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Finds a single quote template by its ID.
    /// </summary>
    Task<QuoteTemplate?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the default quote template for the current tenant, or null if none is set.
    /// </summary>
    Task<QuoteTemplate?> GetDefaultAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Adds a new quote template entity and saves changes.
    /// </summary>
    Task AddAsync(QuoteTemplate template, CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates an existing quote template entity and saves changes.
    /// </summary>
    Task UpdateAsync(QuoteTemplate template, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes a quote template by ID and saves changes.
    /// </summary>
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Clears IsDefault on all quote templates for the current tenant.
    /// Used before setting a new default to ensure only one default exists.
    /// </summary>
    Task ClearDefaultAsync(CancellationToken cancellationToken = default);
}
