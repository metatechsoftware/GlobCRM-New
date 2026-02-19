using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Persistence.Repositories;

/// <summary>
/// EF Core implementation of IEmailSequenceRepository.
/// All queries are automatically tenant-scoped via ApplicationDbContext global query filters.
/// Steps are always ordered by StepNumber when eagerly loaded.
/// </summary>
public class EmailSequenceRepository : IEmailSequenceRepository
{
    private readonly ApplicationDbContext _db;

    public EmailSequenceRepository(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<List<EmailSequence>> GetAllAsync(Guid tenantId)
    {
        return await _db.EmailSequences
            .Include(s => s.CreatedByUser)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task<EmailSequence?> GetByIdAsync(Guid id)
    {
        return await _db.EmailSequences
            .Include(s => s.Steps.OrderBy(step => step.StepNumber))
            .Include(s => s.CreatedByUser)
            .FirstOrDefaultAsync(s => s.Id == id);
    }

    /// <inheritdoc />
    public async Task<EmailSequenceStep?> GetStepAsync(Guid sequenceId, int stepNumber)
    {
        return await _db.EmailSequenceSteps
            .Include(s => s.EmailTemplate)
            .FirstOrDefaultAsync(s => s.SequenceId == sequenceId && s.StepNumber == stepNumber);
    }

    /// <inheritdoc />
    public async Task<EmailSequence?> GetByIdWithStepsAndTemplatesAsync(Guid id)
    {
        return await _db.EmailSequences
            .Include(s => s.Steps.OrderBy(step => step.StepNumber))
                .ThenInclude(step => step.EmailTemplate)
            .Include(s => s.CreatedByUser)
            .FirstOrDefaultAsync(s => s.Id == id);
    }

    /// <inheritdoc />
    public async Task<EmailSequence> CreateAsync(EmailSequence sequence)
    {
        _db.EmailSequences.Add(sequence);
        await _db.SaveChangesAsync();
        return sequence;
    }

    /// <inheritdoc />
    public async Task UpdateAsync(EmailSequence sequence)
    {
        sequence.UpdatedAt = DateTimeOffset.UtcNow;
        _db.EmailSequences.Update(sequence);
        await _db.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task DeleteAsync(Guid id)
    {
        var sequence = await _db.EmailSequences.FindAsync(id);
        if (sequence is not null)
        {
            _db.EmailSequences.Remove(sequence);
            await _db.SaveChangesAsync();
        }
    }
}
