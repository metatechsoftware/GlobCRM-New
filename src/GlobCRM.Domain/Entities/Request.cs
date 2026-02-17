using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a request/support ticket in the CRM.
/// Requests are tenant-scoped with workflow status tracking, priority, and JSONB custom fields.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// Follows Activity entity pattern, simplified.
/// </summary>
public class Request
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Display title/subject of the request (e.g., "Cannot access dashboard").
    /// </summary>
    public string Subject { get; set; } = string.Empty;

    /// <summary>
    /// Optional detailed description of the request.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Current workflow state of the request.
    /// </summary>
    public RequestStatus Status { get; set; } = RequestStatus.New;

    /// <summary>
    /// Urgency level of the request.
    /// </summary>
    public RequestPriority Priority { get; set; }

    /// <summary>
    /// Free-text category for flexible classification (e.g., "Billing", "Technical", "General").
    /// </summary>
    public string? Category { get; set; }

    /// <summary>
    /// User who owns this request. Used for scope-based permission filtering (Own, Team, All).
    /// Set to null if the owner is deleted (SET NULL on delete).
    /// </summary>
    public Guid? OwnerId { get; set; }

    /// <summary>
    /// Navigation property to the request owner.
    /// </summary>
    public ApplicationUser? Owner { get; set; }

    /// <summary>
    /// User assigned to work on this request.
    /// Set to null if the assignee is deleted (SET NULL on delete).
    /// </summary>
    public Guid? AssignedToId { get; set; }

    /// <summary>
    /// Navigation property to the assigned user.
    /// </summary>
    public ApplicationUser? AssignedTo { get; set; }

    /// <summary>
    /// Optional contact who submitted or is associated with this request.
    /// Set to null if the contact is deleted (SET NULL on delete).
    /// </summary>
    public Guid? ContactId { get; set; }

    /// <summary>
    /// Navigation property to the associated contact.
    /// </summary>
    public Contact? Contact { get; set; }

    /// <summary>
    /// Optional company associated with this request.
    /// Set to null if the company is deleted (SET NULL on delete).
    /// </summary>
    public Guid? CompanyId { get; set; }

    /// <summary>
    /// Navigation property to the associated company.
    /// </summary>
    public Company? Company { get; set; }

    /// <summary>
    /// Timestamp when the request was resolved. Set when status transitions to Resolved.
    /// </summary>
    public DateTimeOffset? ResolvedAt { get; set; }

    /// <summary>
    /// Timestamp when the request was closed. Set when status transitions to Closed.
    /// </summary>
    public DateTimeOffset? ClosedAt { get; set; }

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
}
