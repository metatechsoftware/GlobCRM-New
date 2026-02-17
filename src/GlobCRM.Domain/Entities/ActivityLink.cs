namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a polymorphic link from an activity to another CRM entity (Contact, Company, Deal).
/// No FK to target entities -- EntityType + EntityId form a logical reference.
/// Child entity -- inherits tenant isolation via Activity FK (no TenantId).
/// </summary>
public class ActivityLink
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Activity this link belongs to.
    /// </summary>
    public Guid ActivityId { get; set; }

    /// <summary>
    /// Navigation property to the parent activity.
    /// </summary>
    public Activity Activity { get; set; } = null!;

    /// <summary>
    /// Type of the linked entity (e.g., "Contact", "Company", "Deal").
    /// </summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>
    /// ID of the linked entity.
    /// </summary>
    public Guid EntityId { get; set; }

    /// <summary>
    /// Denormalized display name of the linked entity for quick rendering.
    /// </summary>
    public string? EntityName { get; set; }

    /// <summary>
    /// Timestamp when the link was created.
    /// </summary>
    public DateTimeOffset LinkedAt { get; set; } = DateTimeOffset.UtcNow;
}
