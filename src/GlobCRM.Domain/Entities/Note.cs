namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a rich-text note attached to any CRM entity via polymorphic linking.
/// EntityType + EntityId form a logical reference (no FK constraints to target entities).
/// Tenant-scoped with triple-layer isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class Note
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Note title / subject line.
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Rich text body (HTML from Quill editor).
    /// </summary>
    public string Body { get; set; } = string.Empty;

    /// <summary>
    /// Stripped plain text version for search and list display.
    /// </summary>
    public string? PlainTextBody { get; set; }

    /// <summary>
    /// Type of the linked entity (e.g., "Company", "Contact", "Deal", "Quote", "Request").
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
    /// User who authored this note. Null if the author is deleted (SET NULL on delete).
    /// </summary>
    public Guid? AuthorId { get; set; }

    /// <summary>
    /// Navigation property to the author.
    /// </summary>
    public ApplicationUser? Author { get; set; }

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Flag for tenant seeder-generated data.
    /// </summary>
    public bool IsSeedData { get; set; }
}
