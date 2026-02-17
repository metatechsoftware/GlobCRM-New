using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents an activity (task, call, meeting) in the CRM.
/// Activities are tenant-scoped with workflow status tracking, priority, and JSONB custom fields.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class Activity
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Display title of the activity (e.g., "Follow up with Acme Corp").
    /// </summary>
    public string Subject { get; set; } = string.Empty;

    /// <summary>
    /// Optional detailed description or notes about the activity.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Category of the activity: Task, Call, or Meeting.
    /// </summary>
    public ActivityType Type { get; set; }

    /// <summary>
    /// Current workflow state of the activity.
    /// </summary>
    public ActivityStatus Status { get; set; }

    /// <summary>
    /// Urgency level of the activity.
    /// </summary>
    public ActivityPriority Priority { get; set; }

    /// <summary>
    /// Target completion date for the activity. Nullable for activities without a deadline.
    /// </summary>
    public DateTimeOffset? DueDate { get; set; }

    /// <summary>
    /// Actual completion timestamp, set when activity reaches Done status.
    /// </summary>
    public DateTimeOffset? CompletedAt { get; set; }

    /// <summary>
    /// User who owns this activity. Used for scope-based permission filtering (Own, Team, All).
    /// Set to null if the owner is deleted (SET NULL on delete).
    /// </summary>
    public Guid? OwnerId { get; set; }

    /// <summary>
    /// Navigation property to the activity owner.
    /// </summary>
    public ApplicationUser? Owner { get; set; }

    /// <summary>
    /// User assigned to work on this activity.
    /// Set to null if the assignee is deleted (SET NULL on delete).
    /// </summary>
    public Guid? AssignedToId { get; set; }

    /// <summary>
    /// Navigation property to the assigned user.
    /// </summary>
    public ApplicationUser? AssignedTo { get; set; }

    /// <summary>
    /// Custom fields stored as JSONB. Keys are custom field definition IDs.
    /// </summary>
    public Dictionary<string, object?> CustomFields { get; set; } = new();

    /// <summary>
    /// Marks records created by TenantSeeder for bulk deletion of demo data.
    /// </summary>
    public bool IsSeedData { get; set; } = false;

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation: Activity has many comments
    public ICollection<ActivityComment> Comments { get; set; } = new List<ActivityComment>();

    // Navigation: Activity has many attachments
    public ICollection<ActivityAttachment> Attachments { get; set; } = new List<ActivityAttachment>();

    // Navigation: Activity has many time entries
    public ICollection<ActivityTimeEntry> TimeEntries { get; set; } = new List<ActivityTimeEntry>();

    // Navigation: Activity has many followers
    public ICollection<ActivityFollower> Followers { get; set; } = new List<ActivityFollower>();

    // Navigation: Activity has many links to other entities (polymorphic)
    public ICollection<ActivityLink> Links { get; set; } = new List<ActivityLink>();
}
