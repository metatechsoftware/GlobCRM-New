namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a file attachment on an activity.
/// Child entity -- inherits tenant isolation via Activity FK (no TenantId).
/// </summary>
public class ActivityAttachment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Activity this attachment belongs to.
    /// </summary>
    public Guid ActivityId { get; set; }

    /// <summary>
    /// Navigation property to the parent activity.
    /// </summary>
    public Activity Activity { get; set; } = null!;

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
    /// User who uploaded the attachment. Null if the user is deleted (SET NULL on delete).
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
