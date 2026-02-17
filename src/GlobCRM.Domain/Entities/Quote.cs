using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a quote/proposal in the CRM.
/// Quotes are tenant-scoped with line items, versioning, status tracking, and JSONB custom fields.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class Quote
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Auto-generated quote number (e.g., "Q-0001"). Unique within tenant.
    /// </summary>
    public string QuoteNumber { get; set; } = string.Empty;

    /// <summary>
    /// Display title of the quote (e.g., "Enterprise License Proposal").
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Optional detailed description of the quote.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Current lifecycle state of the quote.
    /// </summary>
    public QuoteStatus Status { get; set; } = QuoteStatus.Draft;

    /// <summary>
    /// Date the quote was issued/created.
    /// </summary>
    public DateOnly IssueDate { get; set; }

    /// <summary>
    /// Optional expiry date after which the quote is no longer valid.
    /// </summary>
    public DateOnly? ExpiryDate { get; set; }

    /// <summary>
    /// Version number of this quote (default 1). Increments when a new version is created.
    /// </summary>
    public int VersionNumber { get; set; } = 1;

    /// <summary>
    /// Self-referencing FK to the original quote when this is a versioned copy.
    /// Null for original quotes.
    /// </summary>
    public Guid? OriginalQuoteId { get; set; }

    /// <summary>
    /// Navigation property to the original quote (for versioning).
    /// </summary>
    public Quote? OriginalQuote { get; set; }

    /// <summary>
    /// Optional deal associated with this quote.
    /// Set to null if the deal is deleted (SET NULL on delete).
    /// </summary>
    public Guid? DealId { get; set; }

    /// <summary>
    /// Navigation property to the associated deal.
    /// </summary>
    public Deal? Deal { get; set; }

    /// <summary>
    /// Optional contact associated with this quote.
    /// Set to null if the contact is deleted (SET NULL on delete).
    /// </summary>
    public Guid? ContactId { get; set; }

    /// <summary>
    /// Navigation property to the associated contact.
    /// </summary>
    public Contact? Contact { get; set; }

    /// <summary>
    /// Optional company associated with this quote.
    /// Set to null if the company is deleted (SET NULL on delete).
    /// </summary>
    public Guid? CompanyId { get; set; }

    /// <summary>
    /// Navigation property to the associated company.
    /// </summary>
    public Company? Company { get; set; }

    /// <summary>
    /// User who owns this quote. Used for scope-based permission filtering (Own, Team, All).
    /// Set to null if the owner is deleted (SET NULL on delete).
    /// </summary>
    public Guid? OwnerId { get; set; }

    /// <summary>
    /// Navigation property to the quote owner.
    /// </summary>
    public ApplicationUser? Owner { get; set; }

    /// <summary>
    /// Sum of all line item net totals before discounts and taxes.
    /// </summary>
    public decimal Subtotal { get; set; }

    /// <summary>
    /// Total discount amount across all line items.
    /// </summary>
    public decimal DiscountTotal { get; set; }

    /// <summary>
    /// Total tax amount across all line items.
    /// </summary>
    public decimal TaxTotal { get; set; }

    /// <summary>
    /// Final total: Subtotal - DiscountTotal + TaxTotal.
    /// </summary>
    public decimal GrandTotal { get; set; }

    /// <summary>
    /// Optional notes for PDF terms/conditions.
    /// </summary>
    public string? Notes { get; set; }

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

    // Navigation: Quote has many line items
    public ICollection<QuoteLineItem> LineItems { get; set; } = new List<QuoteLineItem>();

    // Navigation: Quote has many status history entries
    public ICollection<QuoteStatusHistory> StatusHistories { get; set; } = new List<QuoteStatusHistory>();
}
