namespace GlobCRM.Domain.Entities;

/// <summary>
/// Audit trail entry recording a deal's stage transition.
/// Tracks which stage the deal moved from/to, who made the change, and when.
/// Child entity — inherits tenant isolation via Deal FK (no TenantId).
/// </summary>
public class DealStageHistory
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Deal that transitioned stages.
    /// </summary>
    public Guid DealId { get; set; }

    /// <summary>
    /// Navigation property to the deal.
    /// </summary>
    public Deal Deal { get; set; } = null!;

    /// <summary>
    /// Stage the deal moved from.
    /// </summary>
    public Guid FromStageId { get; set; }

    /// <summary>
    /// Navigation property to the source stage.
    /// </summary>
    public PipelineStage FromStage { get; set; } = null!;

    /// <summary>
    /// Stage the deal moved to.
    /// </summary>
    public Guid ToStageId { get; set; }

    /// <summary>
    /// Navigation property to the destination stage.
    /// </summary>
    public PipelineStage ToStage { get; set; } = null!;

    /// <summary>
    /// User who performed the stage change. Null if system-initiated.
    /// Set to null if the user is deleted (SET NULL on delete).
    /// </summary>
    public Guid? ChangedByUserId { get; set; }

    /// <summary>
    /// Navigation property to the user who made the change.
    /// </summary>
    public ApplicationUser? ChangedByUser { get; set; }

    /// <summary>
    /// Timestamp when the stage transition occurred.
    /// </summary>
    public DateTimeOffset ChangedAt { get; set; } = DateTimeOffset.UtcNow;
}
