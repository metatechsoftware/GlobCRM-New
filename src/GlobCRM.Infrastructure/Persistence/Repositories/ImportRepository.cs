using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Persistence.Repositories;

/// <summary>
/// EF Core implementation of IImportRepository.
/// Handles ImportJob CRUD with error includes and user-based filtering.
/// Tenant isolation enforced by ApplicationDbContext global query filter.
/// </summary>
public class ImportRepository : IImportRepository
{
    private readonly ApplicationDbContext _db;

    public ImportRepository(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<ImportJob?> GetByIdAsync(Guid id)
    {
        return await _db.ImportJobs
            .Include(j => j.Errors)
            .Include(j => j.User)
            .FirstOrDefaultAsync(j => j.Id == id);
    }

    /// <inheritdoc />
    public async Task<ImportJob> CreateAsync(ImportJob job)
    {
        _db.ImportJobs.Add(job);
        await _db.SaveChangesAsync();
        return job;
    }

    /// <inheritdoc />
    public async Task UpdateAsync(ImportJob job)
    {
        _db.ImportJobs.Update(job);
        await _db.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task<List<ImportJob>> GetByUserAsync(Guid userId, int page, int pageSize)
    {
        return await _db.ImportJobs
            .Include(j => j.User)
            .Where(j => j.UserId == userId)
            .OrderByDescending(j => j.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }
}
