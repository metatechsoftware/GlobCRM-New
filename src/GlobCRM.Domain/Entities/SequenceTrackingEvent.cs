namespace GlobCRM.Domain.Entities;

/// <summary>
/// Records email tracking events (sent, open, click, bounce) for sequence enrollment steps.
/// Used for per-step and per-sequence analytics (open rate, click rate, etc.).
/// Tenant-scoped for data isolation. Cascade-deleted when parent enrollment is removed.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class SequenceTrackingEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// FK to the enrollment this event belongs to.
    /// </summary>
    public Guid EnrollmentId { get; set; }

    /// <summary>
    /// Navigation property to the enrollment.
    /// </summary>
    public SequenceEnrollment? Enrollment { get; set; }

    /// <summary>
    /// The step number within the sequence that generated this event.
    /// </summary>
    public int StepNumber { get; set; }

    /// <summary>
    /// Type of tracking event: "sent", "open", "click", "bounce".
    /// </summary>
    public string EventType { get; set; } = string.Empty;

    /// <summary>
    /// The URL that was clicked (for "click" events only).
    /// </summary>
    public string? Url { get; set; }

    /// <summary>
    /// Gmail message ID for correlating with Gmail API responses.
    /// </summary>
    public string? GmailMessageId { get; set; }

    /// <summary>
    /// Gmail thread ID for reply detection correlation.
    /// </summary>
    public string? GmailThreadId { get; set; }

    /// <summary>
    /// User agent of the recipient's email client (for "open" and "click" events).
    /// </summary>
    public string? UserAgent { get; set; }

    /// <summary>
    /// IP address of the recipient (for "open" and "click" events).
    /// </summary>
    public string? IpAddress { get; set; }

    // Audit timestamp (tracking events are append-only, no UpdatedAt needed)
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
