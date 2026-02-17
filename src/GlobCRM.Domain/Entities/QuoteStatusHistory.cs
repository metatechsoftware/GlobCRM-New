using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Audit trail entry recording a quote's status transition.
/// Tracks which status the quote moved from/to, who made the change, and when.
/// Child entity -- inherits tenant isolation via Quote FK (no TenantId).
/// Follows ActivityStatusHistory pattern.
/// </summary>
public class QuoteStatusHistory
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Quote that transitioned statuses.
    /// </summary>
    public Guid QuoteId { get; set; }

    /// <summary>
    /// Navigation property to the quote.
    /// </summary>
    public Quote Quote { get; set; } = null!;

    /// <summary>
    /// Status the quote moved from.
    /// </summary>
    public QuoteStatus FromStatus { get; set; }

    /// <summary>
    /// Status the quote moved to.
    /// </summary>
    public QuoteStatus ToStatus { get; set; }

    /// <summary>
    /// User who performed the status change. Null if system-initiated.
    /// Set to null if the user is deleted (SET NULL on delete).
    /// </summary>
    public Guid? ChangedById { get; set; }

    /// <summary>
    /// Navigation property to the user who made the change.
    /// </summary>
    public ApplicationUser? ChangedBy { get; set; }

    /// <summary>
    /// Timestamp when the status transition occurred.
    /// </summary>
    public DateTimeOffset ChangedAt { get; set; } = DateTimeOffset.UtcNow;
}
