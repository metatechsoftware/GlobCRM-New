namespace GlobCRM.Domain.Entities;

/// <summary>
/// Join entity for the many-to-many relationship between Deal and Contact.
/// Child entity — inherits tenant isolation via Deal FK (no TenantId).
/// Composite PK on (DealId, ContactId).
/// </summary>
public class DealContact
{
    /// <summary>
    /// Deal side of the relationship.
    /// </summary>
    public Guid DealId { get; set; }

    /// <summary>
    /// Navigation property to the linked deal.
    /// </summary>
    public Deal Deal { get; set; } = null!;

    /// <summary>
    /// Contact side of the relationship.
    /// </summary>
    public Guid ContactId { get; set; }

    /// <summary>
    /// Navigation property to the linked contact.
    /// </summary>
    public Contact Contact { get; set; } = null!;

    /// <summary>
    /// Timestamp when the contact was linked to the deal.
    /// </summary>
    public DateTimeOffset LinkedAt { get; set; } = DateTimeOffset.UtcNow;
}
