namespace GlobCRM.Domain.Entities;

/// <summary>
/// Records the conversion of a lead to a contact (required), company (optional), and deal (optional).
/// One-to-one with Lead (unique constraint on LeadId).
/// Child entity -- inherits tenant isolation via Lead FK (no TenantId).
/// </summary>
public class LeadConversion
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Lead that was converted. One conversion per lead (unique index on LeadId).
    /// </summary>
    public Guid LeadId { get; set; }

    /// <summary>
    /// Navigation property to the lead.
    /// </summary>
    public Lead Lead { get; set; } = null!;

    /// <summary>
    /// Contact created from this lead (always required during conversion).
    /// </summary>
    public Guid ContactId { get; set; }

    /// <summary>
    /// Navigation property to the created contact.
    /// </summary>
    public Contact Contact { get; set; } = null!;

    /// <summary>
    /// Company created or linked during conversion (optional).
    /// </summary>
    public Guid? CompanyId { get; set; }

    /// <summary>
    /// Navigation property to the company.
    /// </summary>
    public Company? Company { get; set; }

    /// <summary>
    /// Deal created during conversion (optional).
    /// </summary>
    public Guid? DealId { get; set; }

    /// <summary>
    /// Navigation property to the deal.
    /// </summary>
    public Deal? Deal { get; set; }

    /// <summary>
    /// User who performed the conversion (required).
    /// </summary>
    public Guid ConvertedByUserId { get; set; }

    /// <summary>
    /// Navigation property to the user who performed conversion.
    /// </summary>
    public ApplicationUser ConvertedByUser { get; set; } = null!;

    /// <summary>
    /// Timestamp when the conversion occurred.
    /// </summary>
    public DateTimeOffset ConvertedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Optional notes about the conversion.
    /// </summary>
    public string? Notes { get; set; }
}
