using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Tracks a single contact's enrollment and progress through an email sequence.
/// Acts as a state machine: Active -> Completed/Replied/Bounced/Unenrolled, with Paused as a toggle.
/// Tenant-scoped with full audit trail of state transitions via timestamp fields.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class SequenceEnrollment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// FK to the email sequence this enrollment belongs to.
    /// </summary>
    public Guid SequenceId { get; set; }

    /// <summary>
    /// Navigation property to the sequence.
    /// </summary>
    public EmailSequence? Sequence { get; set; }

    /// <summary>
    /// FK to the enrolled contact.
    /// </summary>
    public Guid ContactId { get; set; }

    /// <summary>
    /// Navigation property to the enrolled contact.
    /// </summary>
    public Contact? Contact { get; set; }

    /// <summary>
    /// Current enrollment status. Drives execution engine behavior.
    /// </summary>
    public EnrollmentStatus Status { get; set; } = EnrollmentStatus.Active;

    /// <summary>
    /// Current step number in the sequence (0 = not started yet).
    /// Updated after each step is sent.
    /// </summary>
    public int CurrentStepNumber { get; set; } = 0;

    /// <summary>
    /// Total number of steps that have been successfully sent.
    /// </summary>
    public int StepsSent { get; set; } = 0;

    /// <summary>
    /// Step number to start from (default 1). Supports re-enrollment from a specific step.
    /// </summary>
    public int StartFromStep { get; set; } = 1;

    /// <summary>
    /// When the last step email was sent.
    /// </summary>
    public DateTimeOffset? LastStepSentAt { get; set; }

    /// <summary>
    /// When the enrollment completed (all steps sent).
    /// </summary>
    public DateTimeOffset? CompletedAt { get; set; }

    /// <summary>
    /// When a reply was detected from the contact.
    /// </summary>
    public DateTimeOffset? RepliedAt { get; set; }

    /// <summary>
    /// The step number at which the contact replied (if applicable).
    /// </summary>
    public int? ReplyStepNumber { get; set; }

    /// <summary>
    /// When the enrollment was paused by a user.
    /// </summary>
    public DateTimeOffset? PausedAt { get; set; }

    /// <summary>
    /// When a bounce was detected.
    /// </summary>
    public DateTimeOffset? BouncedAt { get; set; }

    /// <summary>
    /// Reason for the bounce (e.g., "Mailbox full", "Address not found").
    /// </summary>
    public string? BounceReason { get; set; }

    /// <summary>
    /// User who enrolled this contact. Required for audit trail.
    /// </summary>
    public Guid CreatedByUserId { get; set; }

    /// <summary>
    /// Navigation property to the enrolling user.
    /// </summary>
    public ApplicationUser? CreatedByUser { get; set; }

    /// <summary>
    /// Hangfire job ID for the currently scheduled next-step job.
    /// Used for pause (delete job) and cancel (delete job) operations.
    /// </summary>
    public string? HangfireJobId { get; set; }

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
