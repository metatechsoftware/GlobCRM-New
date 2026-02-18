namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a generic file attachment on any CRM entity via polymorphic linking.
/// EntityType + EntityId form a logical reference (no FK constraints to target entities).
/// Tenant-scoped with triple-layer isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class Attachment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Type of the linked entity (e.g., "Company", "Contact", "Deal", "Quote", "Request").
    /// </summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>
    /// ID of the linked entity.
    /// </summary>
    public Guid EntityId { get; set; }

    /// <summary>
    /// Original file name as uploaded by the user.
    /// </summary>
    public string FileName { get; set; } = string.Empty;

    /// <summary>
    /// Path to the file in the storage system (local or cloud).
    /// </summary>
    public string StoragePath { get; set; } = string.Empty;

    /// <summary>
    /// MIME content type of the file (e.g., "application/pdf", "image/png").
    /// </summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>
    /// File size in bytes.
    /// </summary>
    public long FileSizeBytes { get; set; }

    /// <summary>
    /// User who uploaded this attachment. Null if the user is deleted (SET NULL on delete).
    /// </summary>
    public Guid? UploadedById { get; set; }

    /// <summary>
    /// Navigation property to the user who uploaded.
    /// </summary>
    public ApplicationUser? UploadedBy { get; set; }

    /// <summary>
    /// Timestamp when the file was uploaded.
    /// </summary>
    public DateTimeOffset UploadedAt { get; set; } = DateTimeOffset.UtcNow;
}
