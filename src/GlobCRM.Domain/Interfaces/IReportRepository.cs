using GlobCRM.Domain.Entities;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository interface for report CRUD, category management, and access-controlled queries.
/// Implementations use ApplicationDbContext with tenant-scoped global query filters.
/// </summary>
public interface IReportRepository
{
    // -- Report CRUD --

    /// <summary>
    /// Gets a report by ID with Category navigation included.
    /// </summary>
    Task<Report?> GetByIdAsync(Guid id);

    /// <summary>
    /// Gets a paginated list of reports with access control filtering.
    /// Returns reports the user owns, shared reports, or seed data reports.
    /// </summary>
    /// <param name="categoryId">Optional category filter (null = all categories).</param>
    /// <param name="entityType">Optional entity type filter (null = all types).</param>
    /// <param name="search">Optional name search (contains, case-insensitive).</param>
    /// <param name="includeShared">When true, include shared reports from other users.</param>
    /// <param name="userId">Current user ID for ownership filtering.</param>
    /// <param name="page">1-based page number.</param>
    /// <param name="pageSize">Number of items per page.</param>
    Task<(List<Report> Items, int TotalCount)> GetAllAsync(
        string? categoryId, string? entityType, string? search,
        bool includeShared, Guid userId, int page, int pageSize);

    /// <summary>
    /// Creates a new report.
    /// </summary>
    Task<Report> CreateAsync(Report report);

    /// <summary>
    /// Updates an existing report.
    /// </summary>
    Task<Report> UpdateAsync(Report report);

    /// <summary>
    /// Deletes a report by ID.
    /// </summary>
    Task DeleteAsync(Guid id);

    // -- Category CRUD --

    /// <summary>
    /// Gets all report categories for the current tenant, ordered by SortOrder.
    /// </summary>
    Task<List<ReportCategory>> GetCategoriesAsync();

    /// <summary>
    /// Creates a new report category.
    /// </summary>
    Task<ReportCategory> CreateCategoryAsync(ReportCategory category);

    /// <summary>
    /// Updates an existing report category.
    /// </summary>
    Task<ReportCategory> UpdateCategoryAsync(ReportCategory category);

    /// <summary>
    /// Deletes a report category by ID.
    /// </summary>
    Task DeleteCategoryAsync(Guid id);
}
