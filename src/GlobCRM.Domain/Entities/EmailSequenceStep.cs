namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a single step in an email sequence.
/// Each step references an email template and configures timing (delay + preferred send time).
/// Ordered by StepNumber (1-based). Inherits tenant isolation from parent EmailSequence via FK.
/// </summary>
public class EmailSequenceStep
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// FK to the parent sequence.
    /// </summary>
    public Guid SequenceId { get; set; }

    /// <summary>
    /// Navigation property to the parent sequence.
    /// </summary>
    public EmailSequence Sequence { get; set; } = null!;

    /// <summary>
    /// 1-based step ordering within the sequence.
    /// Unique per sequence (enforced by composite index).
    /// </summary>
    public int StepNumber { get; set; }

    /// <summary>
    /// FK to the email template used for this step's content.
    /// </summary>
    public Guid EmailTemplateId { get; set; }

    /// <summary>
    /// Navigation property to the email template.
    /// </summary>
    public EmailTemplate? EmailTemplate { get; set; }

    /// <summary>
    /// Optional subject line override. When set, replaces the template's default subject
    /// for sequence-specific messaging. Null means use the template subject as-is.
    /// </summary>
    public string? SubjectOverride { get; set; }

    /// <summary>
    /// Days to wait after the previous step (or enrollment start for step 1) before sending.
    /// Default 0 means send immediately (or at preferred send time on enrollment day).
    /// </summary>
    public int DelayDays { get; set; } = 0;

    /// <summary>
    /// Preferred time of day to send this step (e.g., 09:00).
    /// Null means send as soon as the delay period expires.
    /// </summary>
    public TimeOnly? PreferredSendTime { get; set; }

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
