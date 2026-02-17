using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Dashboards;

/// <summary>
/// EF Core implementation of ITargetRepository.
/// Handles KPI target CRUD with metric-based queries and ownership filtering.
/// Tenant isolation enforced by ApplicationDbContext global query filter.
/// </summary>
public class TargetRepository : ITargetRepository
{
    private readonly ApplicationDbContext _db;

    public TargetRepository(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<Target?> GetByIdAsync(Guid id)
    {
        return await _db.Targets
            .FirstOrDefaultAsync(t => t.Id == id);
    }

    /// <inheritdoc />
    public async Task<List<Target>> GetAllAsync(Guid? ownerId)
    {
        // Returns team-wide targets (OwnerId == null) plus personal targets for the given owner
        return await _db.Targets
            .Where(t => t.OwnerId == null || t.OwnerId == ownerId)
            .OrderBy(t => t.Name)
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task<List<Target>> GetByMetricAsync(MetricType metric, Guid? ownerId)
    {
        return await _db.Targets
            .Where(t => t.MetricType == metric && (t.OwnerId == null || t.OwnerId == ownerId))
            .OrderBy(t => t.StartDate)
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task CreateAsync(Target target)
    {
        _db.Targets.Add(target);
        await _db.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task UpdateAsync(Target target)
    {
        target.UpdatedAt = DateTimeOffset.UtcNow;
        _db.Targets.Update(target);
        await _db.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task DeleteAsync(Guid id)
    {
        var target = await _db.Targets.FindAsync(id);
        if (target is not null)
        {
            _db.Targets.Remove(target);
            await _db.SaveChangesAsync();
        }
    }
}
