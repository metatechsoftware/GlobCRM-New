using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository interface for Contact CRUD operations with server-side
/// filtering, sorting, pagination, and ownership scope enforcement.
/// </summary>
public interface IContactRepository
{
    /// <summary>
    /// Gets a paged list of contacts with server-side filtering, sorting, and ownership scope.
    /// Includes Company navigation for company name in list DTOs.
    /// </summary>
    Task<PagedResult<Contact>> GetPagedAsync(
        EntityQueryParams queryParams,
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds = null);

    /// <summary>
    /// Gets a single contact by ID, including Company and Owner navigations.
    /// </summary>
    Task<Contact?> GetByIdAsync(Guid id);

    /// <summary>
    /// Gets all contacts for a specific company (for the company detail contacts tab).
    /// </summary>
    Task<List<Contact>> GetByCompanyIdAsync(Guid companyId);

    /// <summary>
    /// Creates a new contact entity.
    /// </summary>
    Task<Contact> CreateAsync(Contact contact);

    /// <summary>
    /// Updates an existing contact entity, setting UpdatedAt to UtcNow.
    /// </summary>
    Task UpdateAsync(Contact contact);

    /// <summary>
    /// Deletes a contact by ID.
    /// </summary>
    Task DeleteAsync(Guid id);
}
