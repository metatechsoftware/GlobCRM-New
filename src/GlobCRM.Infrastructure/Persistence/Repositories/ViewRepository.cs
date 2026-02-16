using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Persistence.Repositories;

/// <summary>
/// Repository for saved view CRUD operations.
/// Uses ApplicationDbContext with tenant-scoped global query filters.
/// Supports both personal views (OwnerId set) and team-wide views (OwnerId null).
/// </summary>
public class ViewRepository : IViewRepository
{
    private readonly ApplicationDbContext _context;

    public ViewRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Gets views for an entity type: personal views for the specified user + all team-wide views.
    /// Team-wide views (OwnerId == null) are visible to all users.
    /// Personal views (OwnerId == userId) are visible only to their owner.
    /// Ordered by IsTeamDefault descending (team default first), then Name ascending.
    /// </summary>
    public async Task<List<SavedView>> GetViewsByEntityTypeAsync(string entityType, Guid userId)
    {
        return await _context.SavedViews
            .Where(v => v.EntityType == entityType
                && (v.OwnerId == userId || v.OwnerId == null))
            .OrderByDescending(v => v.IsTeamDefault)
            .ThenBy(v => v.Name)
            .ToListAsync();
    }

    public async Task<SavedView?> GetByIdAsync(Guid id)
    {
        return await _context.SavedViews
            .FirstOrDefaultAsync(v => v.Id == id);
    }

    /// <summary>
    /// Gets the team default view for an entity type.
    /// There should only be one per entity type per tenant.
    /// </summary>
    public async Task<SavedView?> GetTeamDefaultAsync(string entityType)
    {
        return await _context.SavedViews
            .FirstOrDefaultAsync(v => v.EntityType == entityType && v.IsTeamDefault);
    }

    public async Task<SavedView> CreateAsync(SavedView view)
    {
        _context.SavedViews.Add(view);
        await _context.SaveChangesAsync();
        return view;
    }

    public async Task UpdateAsync(SavedView view)
    {
        view.UpdatedAt = DateTimeOffset.UtcNow;
        _context.SavedViews.Update(view);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Guid id)
    {
        var view = await _context.SavedViews
            .FirstOrDefaultAsync(v => v.Id == id);

        if (view is not null)
        {
            _context.SavedViews.Remove(view);
            await _context.SaveChangesAsync();
        }
    }

    /// <summary>
    /// Sets a view as the team default for its entity type.
    /// In a transaction: unsets IsTeamDefault on all views for the entity type,
    /// then sets IsTeamDefault on the target view.
    /// </summary>
    public async Task SetTeamDefaultAsync(Guid viewId)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync();

        try
        {
            var targetView = await _context.SavedViews
                .FirstOrDefaultAsync(v => v.Id == viewId);

            if (targetView is null)
                return;

            // Unset previous team default for this entity type
            var currentDefaults = await _context.SavedViews
                .Where(v => v.EntityType == targetView.EntityType && v.IsTeamDefault)
                .ToListAsync();

            foreach (var view in currentDefaults)
            {
                view.IsTeamDefault = false;
                view.UpdatedAt = DateTimeOffset.UtcNow;
            }

            // Set new team default
            targetView.IsTeamDefault = true;
            targetView.UpdatedAt = DateTimeOffset.UtcNow;

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }
}
