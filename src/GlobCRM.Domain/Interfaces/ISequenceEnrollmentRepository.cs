using GlobCRM.Domain.Entities;

namespace GlobCRM.Domain.Interfaces;

/// <summary>
/// Repository interface for SequenceEnrollment CRUD and analytics operations.
/// Implementations use ApplicationDbContext with tenant-scoped global query filters.
/// </summary>
public interface ISequenceEnrollmentRepository
{
    /// <summary>
    /// Gets an enrollment by ID with Sequence and Contact navigation properties loaded.
    /// </summary>
    Task<SequenceEnrollment?> GetByIdAsync(Guid id);

    /// <summary>
    /// Gets enrollments for a specific sequence with pagination support.
    /// </summary>
    Task<(List<SequenceEnrollment> Items, int TotalCount)> GetBySequenceIdAsync(
        Guid sequenceId, int page, int pageSize);

    /// <summary>
    /// Gets all enrollments for a specific contact (across all sequences).
    /// </summary>
    Task<List<SequenceEnrollment>> GetByContactIdAsync(Guid contactId);

    /// <summary>
    /// Gets the active enrollment for a specific contact in a specific sequence.
    /// Returns null if no active enrollment exists (used for duplicate enrollment prevention).
    /// </summary>
    Task<SequenceEnrollment?> GetActiveByContactAndSequenceAsync(Guid contactId, Guid sequenceId);

    /// <summary>
    /// Creates a single enrollment.
    /// </summary>
    Task<SequenceEnrollment> CreateAsync(SequenceEnrollment enrollment);

    /// <summary>
    /// Creates multiple enrollments in bulk (for multi-select enrollment from contacts list).
    /// </summary>
    Task CreateBulkAsync(List<SequenceEnrollment> enrollments);

    /// <summary>
    /// Updates an existing enrollment.
    /// </summary>
    Task UpdateAsync(SequenceEnrollment enrollment);

    /// <summary>
    /// Gets enrollment analytics for a sequence: counts grouped by enrollment status.
    /// Returns a dictionary of status -> count.
    /// </summary>
    Task<Dictionary<string, int>> GetAnalyticsAsync(Guid sequenceId);

    /// <summary>
    /// Gets per-step tracking metrics for a sequence: sent, open, click, bounce counts per step.
    /// Returns a list of step metrics with StepNumber and event type counts.
    /// </summary>
    Task<List<StepMetrics>> GetStepMetricsAsync(Guid sequenceId);
}

/// <summary>
/// Per-step tracking metrics for sequence analytics.
/// Aggregated from SequenceTrackingEvent records.
/// </summary>
public record StepMetrics(int StepNumber, int Sent, int Opens, int Clicks, int Bounces);
