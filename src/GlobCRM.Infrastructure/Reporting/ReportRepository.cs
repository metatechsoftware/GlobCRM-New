using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Reporting;

/// <summary>
/// EF Core implementation of IReportRepository.
/// All queries are automatically tenant-scoped via ApplicationDbContext global query filters.
/// Access control: users see their own reports, shared reports, and seed data reports.
/// </summary>
public class ReportRepository : IReportRepository
{
    private readonly ApplicationDbContext _context;

    public ReportRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    // -- Report CRUD --

    /// <inheritdoc />
    public async Task<Report?> GetByIdAsync(Guid id)
    {
        return await _context.Reports
            .Include(r => r.Category)
            .FirstOrDefaultAsync(r => r.Id == id);
    }

    /// <inheritdoc />
    public async Task<(List<Report> Items, int TotalCount)> GetAllAsync(
        string? categoryId, string? entityType, string? search,
        bool includeShared, Guid userId, int page, int pageSize)
    {
        var query = _context.Reports
            .Include(r => r.Category)
            .AsQueryable();

        // Access control: user's own reports + shared reports + seed data
        query = query.Where(r =>
            r.OwnerId == userId ||
            (includeShared && r.IsShared) ||
            r.IsSeedData);

        // Optional category filter
        if (!string.IsNullOrEmpty(categoryId) && Guid.TryParse(categoryId, out var catGuid))
        {
            query = query.Where(r => r.CategoryId == catGuid);
        }

        // Optional entity type filter
        if (!string.IsNullOrEmpty(entityType))
        {
            query = query.Where(r => r.EntityType == entityType);
        }

        // Optional name search (case-insensitive contains)
        if (!string.IsNullOrEmpty(search))
        {
            var lowerSearch = search.ToLower();
            query = query.Where(r => r.Name.ToLower().Contains(lowerSearch));
        }

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(r => r.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    /// <inheritdoc />
    public async Task<Report> CreateAsync(Report report)
    {
        _context.Reports.Add(report);
        await _context.SaveChangesAsync();
        return report;
    }

    /// <inheritdoc />
    public async Task<Report> UpdateAsync(Report report)
    {
        report.UpdatedAt = DateTimeOffset.UtcNow;
        _context.Reports.Update(report);
        await _context.SaveChangesAsync();
        return report;
    }

    /// <inheritdoc />
    public async Task DeleteAsync(Guid id)
    {
        var report = await _context.Reports
            .FirstOrDefaultAsync(r => r.Id == id);

        if (report is not null)
        {
            _context.Reports.Remove(report);
            await _context.SaveChangesAsync();
        }
    }

    // -- Category CRUD --

    /// <inheritdoc />
    public async Task<List<ReportCategory>> GetCategoriesAsync()
    {
        return await _context.ReportCategories
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task<ReportCategory> CreateCategoryAsync(ReportCategory category)
    {
        _context.ReportCategories.Add(category);
        await _context.SaveChangesAsync();
        return category;
    }

    /// <inheritdoc />
    public async Task<ReportCategory> UpdateCategoryAsync(ReportCategory category)
    {
        category.UpdatedAt = DateTimeOffset.UtcNow;
        _context.ReportCategories.Update(category);
        await _context.SaveChangesAsync();
        return category;
    }

    /// <inheritdoc />
    public async Task DeleteCategoryAsync(Guid id)
    {
        var category = await _context.ReportCategories
            .FirstOrDefaultAsync(c => c.Id == id);

        if (category is not null)
        {
            _context.ReportCategories.Remove(category);
            await _context.SaveChangesAsync();
        }
    }
}
