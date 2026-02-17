using GlobCRM.Domain.Entities;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository interface for EmailAccount CRUD operations.
/// Supports per-user account lookup, active account listing for background sync,
/// and standard create/update/delete.
/// </summary>
public interface IEmailAccountRepository
{
    /// <summary>
    /// Gets the email account for a specific user in the current tenant.
    /// Returns null if the user has not connected a Gmail account.
    /// </summary>
    Task<EmailAccount?> GetByUserIdAsync(Guid userId);

    /// <summary>
    /// Gets all active email accounts across all tenants for background sync service.
    /// Uses IgnoreQueryFilters to bypass tenant filter.
    /// </summary>
    Task<List<EmailAccount>> GetAllActiveAccountsAsync();

    /// <summary>
    /// Creates a new email account entity.
    /// </summary>
    Task<EmailAccount> CreateAsync(EmailAccount emailAccount);

    /// <summary>
    /// Updates an existing email account entity, setting UpdatedAt to UtcNow.
    /// </summary>
    Task UpdateAsync(EmailAccount emailAccount);

    /// <summary>
    /// Deletes an email account by ID.
    /// </summary>
    Task DeleteAsync(Guid id);
}
