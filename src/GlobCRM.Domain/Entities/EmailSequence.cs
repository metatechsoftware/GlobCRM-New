using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a multi-step automated email sequence (drip campaign).
/// Contains an ordered list of steps, each referencing an email template with configurable delays.
/// Tenant-scoped with ownership tracking for RBAC scope filtering.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class EmailSequence
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Display name of the sequence (e.g., "New Customer Onboarding").
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional description of the sequence purpose and target audience.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Lifecycle status: Draft, Active, Paused, Archived.
    /// New sequences start as Draft until explicitly activated.
    /// </summary>
    public SequenceStatus Status { get; set; } = SequenceStatus.Draft;

    /// <summary>
    /// User who created this sequence. Required for ownership tracking.
    /// </summary>
    public Guid CreatedByUserId { get; set; }

    /// <summary>
    /// Navigation property to the creating user.
    /// </summary>
    public ApplicationUser? CreatedByUser { get; set; }

    /// <summary>
    /// Ordered list of steps in this sequence.
    /// Steps are cascade-deleted when the sequence is deleted.
    /// </summary>
    public List<EmailSequenceStep> Steps { get; set; } = [];

    /// <summary>
    /// Marks records created by TenantSeeder for bulk deletion of demo data.
    /// </summary>
    public bool IsSeedData { get; set; } = false;

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
