using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Persistence.Repositories;

/// <summary>
/// EF Core repository for Pipeline entities with stage management.
/// Uses ApplicationDbContext with tenant-scoped global query filters.
/// </summary>
public class PipelineRepository : IPipelineRepository
{
    private readonly ApplicationDbContext _db;

    public PipelineRepository(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<List<Pipeline>> GetAllAsync()
    {
        return await _db.Pipelines
            .Include(p => p.Stages.OrderBy(s => s.SortOrder))
            .OrderByDescending(p => p.IsDefault)
            .ThenBy(p => p.Name)
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task<Pipeline?> GetByIdWithStagesAsync(Guid id)
    {
        return await _db.Pipelines
            .Include(p => p.Stages.OrderBy(s => s.SortOrder))
            .FirstOrDefaultAsync(p => p.Id == id);
    }

    /// <inheritdoc />
    public async Task<Pipeline> CreateAsync(Pipeline pipeline)
    {
        _db.Pipelines.Add(pipeline);
        await _db.SaveChangesAsync();
        return pipeline;
    }

    /// <inheritdoc />
    public async Task UpdateAsync(Pipeline pipeline)
    {
        pipeline.UpdatedAt = DateTimeOffset.UtcNow;
        _db.Pipelines.Update(pipeline);
        await _db.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task DeleteAsync(Guid id)
    {
        var pipeline = await _db.Pipelines.FindAsync(id);
        if (pipeline is not null)
        {
            _db.Pipelines.Remove(pipeline);
            await _db.SaveChangesAsync();
        }
    }

    /// <inheritdoc />
    public async Task<bool> HasDealsInStageAsync(Guid stageId)
    {
        return await _db.Deals.AnyAsync(d => d.PipelineStageId == stageId);
    }
}
