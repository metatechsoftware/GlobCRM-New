using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Persistence.Repositories;

/// <summary>
/// EF Core implementation of IIntegrationRepository.
/// All queries are automatically tenant-scoped via ApplicationDbContext global query filters.
/// </summary>
public class IntegrationRepository : IIntegrationRepository
{
    private readonly ApplicationDbContext _db;

    public IntegrationRepository(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<Integration?> GetByKeyAsync(string integrationKey)
    {
        return await _db.Integrations
            .FirstOrDefaultAsync(i => i.IntegrationKey == integrationKey);
    }

    /// <inheritdoc />
    public async Task<List<Integration>> GetAllAsync()
    {
        return await _db.Integrations
            .OrderBy(i => i.IntegrationKey)
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task<Integration?> GetByIdAsync(Guid id)
    {
        return await _db.Integrations
            .FirstOrDefaultAsync(i => i.Id == id);
    }

    /// <inheritdoc />
    public async Task<List<IntegrationActivityLog>> GetActivityLogsAsync(Guid integrationId, int limit = 50)
    {
        return await _db.IntegrationActivityLogs
            .Where(l => l.IntegrationId == integrationId)
            .OrderByDescending(l => l.CreatedAt)
            .Take(limit)
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task AddAsync(Integration integration)
    {
        _db.Integrations.Add(integration);
    }

    /// <inheritdoc />
    public async Task AddActivityLogAsync(IntegrationActivityLog log)
    {
        _db.IntegrationActivityLogs.Add(log);
    }

    /// <inheritdoc />
    public async Task SaveChangesAsync()
    {
        await _db.SaveChangesAsync();
    }
}
