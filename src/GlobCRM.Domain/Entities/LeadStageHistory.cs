namespace GlobCRM.Domain.Entities;

/// <summary>
/// Audit trail entry recording a lead's stage transition.
/// Tracks which stage the lead moved from/to, who made the change, and when.
/// Child entity -- inherits tenant isolation via Lead FK (no TenantId).
/// </summary>
public class LeadStageHistory
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Lead that transitioned stages.
    /// </summary>
    public Guid LeadId { get; set; }

    /// <summary>
    /// Navigation property to the lead.
    /// </summary>
    public Lead Lead { get; set; } = null!;

    /// <summary>
    /// Stage the lead moved from. Null for the initial stage assignment.
    /// </summary>
    public Guid? FromStageId { get; set; }

    /// <summary>
    /// Navigation property to the source stage.
    /// </summary>
    public LeadStage? FromStage { get; set; }

    /// <summary>
    /// Stage the lead moved to.
    /// </summary>
    public Guid ToStageId { get; set; }

    /// <summary>
    /// Navigation property to the destination stage.
    /// </summary>
    public LeadStage ToStage { get; set; } = null!;

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

    /// <summary>
    /// Optional notes about the stage transition.
    /// </summary>
    public string? Notes { get; set; }
}
