using GlobCRM.Domain.Entities;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository interface for ImportJob CRUD operations.
/// </summary>
public interface IImportRepository
{
    /// <summary>Gets an import job by ID, including errors.</summary>
    Task<ImportJob?> GetByIdAsync(Guid id);

    /// <summary>Creates a new import job.</summary>
    Task<ImportJob> CreateAsync(ImportJob job);

    /// <summary>Updates an existing import job (status, progress, etc.).</summary>
    Task UpdateAsync(ImportJob job);

    /// <summary>Gets a paged list of import jobs for a specific user.</summary>
    Task<List<ImportJob>> GetByUserAsync(Guid userId, int page, int pageSize);
}
