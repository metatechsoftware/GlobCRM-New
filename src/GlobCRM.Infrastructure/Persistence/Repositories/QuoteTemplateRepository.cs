using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Persistence.Repositories;

/// <summary>
/// EF Core implementation of IQuoteTemplateRepository.
/// All queries are automatically tenant-scoped via ApplicationDbContext global query filters.
/// </summary>
public class QuoteTemplateRepository : IQuoteTemplateRepository
{
    private readonly ApplicationDbContext _db;

    public QuoteTemplateRepository(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<List<QuoteTemplate>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return await _db.QuoteTemplates
            .OrderByDescending(qt => qt.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<QuoteTemplate?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _db.QuoteTemplates
            .FirstOrDefaultAsync(qt => qt.Id == id, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<QuoteTemplate?> GetDefaultAsync(CancellationToken cancellationToken = default)
    {
        return await _db.QuoteTemplates
            .FirstOrDefaultAsync(qt => qt.IsDefault, cancellationToken);
    }

    /// <inheritdoc />
    public async Task AddAsync(QuoteTemplate template, CancellationToken cancellationToken = default)
    {
        _db.QuoteTemplates.Add(template);
        await _db.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task UpdateAsync(QuoteTemplate template, CancellationToken cancellationToken = default)
    {
        _db.QuoteTemplates.Update(template);
        await _db.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var template = await _db.QuoteTemplates
            .FirstOrDefaultAsync(qt => qt.Id == id, cancellationToken);

        if (template != null)
        {
            _db.QuoteTemplates.Remove(template);
            await _db.SaveChangesAsync(cancellationToken);
        }
    }

    /// <inheritdoc />
    public async Task ClearDefaultAsync(CancellationToken cancellationToken = default)
    {
        await _db.QuoteTemplates
            .Where(qt => qt.IsDefault)
            .ExecuteUpdateAsync(s => s.SetProperty(qt => qt.IsDefault, false), cancellationToken);
    }
}
