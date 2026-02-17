using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Dashboards;

/// <summary>
/// EF Core implementation of IDashboardRepository.
/// Handles dashboard CRUD with widget includes and ownership-based filtering.
/// Tenant isolation enforced by ApplicationDbContext global query filter.
/// </summary>
public class DashboardRepository : IDashboardRepository
{
    private readonly ApplicationDbContext _db;

    public DashboardRepository(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<Dashboard?> GetByIdAsync(Guid id)
    {
        return await _db.Dashboards
            .Include(d => d.Widgets)
            .FirstOrDefaultAsync(d => d.Id == id);
    }

    /// <inheritdoc />
    public async Task<List<Dashboard>> GetAllAsync(Guid? ownerId)
    {
        // Returns team-wide dashboards (OwnerId == null) plus personal dashboards for the given owner
        return await _db.Dashboards
            .Include(d => d.Widgets)
            .Where(d => d.OwnerId == null || d.OwnerId == ownerId)
            .OrderByDescending(d => d.IsDefault)
            .ThenBy(d => d.Name)
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task<Dashboard?> GetDefaultAsync(Guid? ownerId)
    {
        // Try personal default first
        if (ownerId.HasValue)
        {
            var personalDefault = await _db.Dashboards
                .Include(d => d.Widgets)
                .FirstOrDefaultAsync(d => d.OwnerId == ownerId && d.IsDefault);

            if (personalDefault != null)
                return personalDefault;
        }

        // Fall back to team-wide default
        return await _db.Dashboards
            .Include(d => d.Widgets)
            .FirstOrDefaultAsync(d => d.OwnerId == null && d.IsDefault);
    }

    /// <inheritdoc />
    public async Task CreateAsync(Dashboard dashboard)
    {
        _db.Dashboards.Add(dashboard);
        await _db.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task UpdateAsync(Dashboard dashboard)
    {
        // Full-replacement strategy for widgets (matching permission update pattern from Phase 02)
        // Remove existing widgets, add new ones for atomic position/config changes
        var existingWidgets = await _db.DashboardWidgets
            .Where(w => w.DashboardId == dashboard.Id)
            .ToListAsync();

        _db.DashboardWidgets.RemoveRange(existingWidgets);

        foreach (var widget in dashboard.Widgets)
        {
            widget.DashboardId = dashboard.Id;
            _db.DashboardWidgets.Add(widget);
        }

        dashboard.UpdatedAt = DateTimeOffset.UtcNow;
        _db.Dashboards.Update(dashboard);
        await _db.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task DeleteAsync(Guid id)
    {
        var dashboard = await _db.Dashboards.FindAsync(id);
        if (dashboard is not null)
        {
            _db.Dashboards.Remove(dashboard);
            await _db.SaveChangesAsync();
        }
    }
}
