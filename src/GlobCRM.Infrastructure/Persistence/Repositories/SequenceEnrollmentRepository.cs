using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Persistence.Repositories;

/// <summary>
/// EF Core implementation of ISequenceEnrollmentRepository.
/// All queries are automatically tenant-scoped via ApplicationDbContext global query filters.
/// Provides CRUD, pagination, and analytics aggregation for sequence enrollments.
/// </summary>
public class SequenceEnrollmentRepository : ISequenceEnrollmentRepository
{
    private readonly ApplicationDbContext _db;

    public SequenceEnrollmentRepository(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<SequenceEnrollment?> GetByIdAsync(Guid id)
    {
        return await _db.SequenceEnrollments
            .Include(e => e.Sequence)
            .Include(e => e.Contact)
            .Include(e => e.CreatedByUser)
            .FirstOrDefaultAsync(e => e.Id == id);
    }

    /// <inheritdoc />
    public async Task<(List<SequenceEnrollment> Items, int TotalCount)> GetBySequenceIdAsync(
        Guid sequenceId, int page, int pageSize)
    {
        var query = _db.SequenceEnrollments
            .Where(e => e.SequenceId == sequenceId);

        var totalCount = await query.CountAsync();

        var items = await query
            .Include(e => e.Contact)
            .Include(e => e.CreatedByUser)
            .OrderByDescending(e => e.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    /// <inheritdoc />
    public async Task<List<SequenceEnrollment>> GetByContactIdAsync(Guid contactId)
    {
        return await _db.SequenceEnrollments
            .Include(e => e.Sequence)
            .Where(e => e.ContactId == contactId)
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task<SequenceEnrollment?> GetActiveByContactAndSequenceAsync(Guid contactId, Guid sequenceId)
    {
        return await _db.SequenceEnrollments
            .FirstOrDefaultAsync(e =>
                e.ContactId == contactId &&
                e.SequenceId == sequenceId &&
                e.Status == EnrollmentStatus.Active);
    }

    /// <inheritdoc />
    public async Task<SequenceEnrollment> CreateAsync(SequenceEnrollment enrollment)
    {
        _db.SequenceEnrollments.Add(enrollment);
        await _db.SaveChangesAsync();
        return enrollment;
    }

    /// <inheritdoc />
    public async Task CreateBulkAsync(List<SequenceEnrollment> enrollments)
    {
        _db.SequenceEnrollments.AddRange(enrollments);
        await _db.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task UpdateAsync(SequenceEnrollment enrollment)
    {
        enrollment.UpdatedAt = DateTimeOffset.UtcNow;
        _db.SequenceEnrollments.Update(enrollment);
        await _db.SaveChangesAsync();
    }

    /// <inheritdoc />
    public async Task<Dictionary<string, int>> GetAnalyticsAsync(Guid sequenceId)
    {
        return await _db.SequenceEnrollments
            .Where(e => e.SequenceId == sequenceId)
            .GroupBy(e => e.Status)
            .Select(g => new { Status = g.Key.ToString(), Count = g.Count() })
            .ToDictionaryAsync(x => x.Status, x => x.Count);
    }

    /// <inheritdoc />
    public async Task<List<StepMetrics>> GetStepMetricsAsync(Guid sequenceId)
    {
        // Get enrollment IDs for this sequence to filter tracking events
        var enrollmentIds = await _db.SequenceEnrollments
            .Where(e => e.SequenceId == sequenceId)
            .Select(e => e.Id)
            .ToListAsync();

        if (enrollmentIds.Count == 0)
            return [];

        // Group tracking events by step number and event type
        var rawMetrics = await _db.SequenceTrackingEvents
            .Where(t => enrollmentIds.Contains(t.EnrollmentId))
            .GroupBy(t => new { t.StepNumber, t.EventType })
            .Select(g => new { g.Key.StepNumber, g.Key.EventType, Count = g.Count() })
            .ToListAsync();

        // Pivot event types into StepMetrics records
        return rawMetrics
            .GroupBy(m => m.StepNumber)
            .Select(g => new StepMetrics(
                g.Key,
                g.Where(m => m.EventType == "sent").Sum(m => m.Count),
                g.Where(m => m.EventType == "open").Sum(m => m.Count),
                g.Where(m => m.EventType == "click").Sum(m => m.Count),
                g.Where(m => m.EventType == "bounce").Sum(m => m.Count)))
            .OrderBy(m => m.StepNumber)
            .ToList();
    }
}
