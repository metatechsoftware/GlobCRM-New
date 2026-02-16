using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository interface for Company CRUD operations with server-side
/// filtering, sorting, pagination, and ownership scope enforcement.
/// </summary>
public interface ICompanyRepository
{
    /// <summary>
    /// Gets a paged list of companies with server-side filtering, sorting, and ownership scope.
    /// </summary>
    /// <param name="queryParams">Pagination, sorting, search, and filter parameters.</param>
    /// <param name="scope">The permission scope to apply (None, Own, Team, All).</param>
    /// <param name="userId">The current user's ID for ownership filtering.</param>
    /// <param name="teamMemberIds">Team member user IDs for Team scope filtering.</param>
    Task<PagedResult<Company>> GetPagedAsync(
        EntityQueryParams queryParams,
        PermissionScope scope,
        Guid userId,
        List<Guid>? teamMemberIds = null);

    /// <summary>
    /// Gets a single company by ID, including Owner navigation.
    /// </summary>
    Task<Company?> GetByIdAsync(Guid id);

    /// <summary>
    /// Creates a new company entity.
    /// </summary>
    Task<Company> CreateAsync(Company company);

    /// <summary>
    /// Updates an existing company entity, setting UpdatedAt to UtcNow.
    /// </summary>
    Task UpdateAsync(Company company);

    /// <summary>
    /// Deletes a company by ID.
    /// </summary>
    Task DeleteAsync(Guid id);
}
