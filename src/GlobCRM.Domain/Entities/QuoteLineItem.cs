namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a line item on a quote with product, quantity, pricing, and computed amounts.
/// Child entity -- inherits tenant isolation via Quote FK (no TenantId).
/// </summary>
public class QuoteLineItem
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Parent quote this line item belongs to.
    /// </summary>
    public Guid QuoteId { get; set; }

    /// <summary>
    /// Navigation property to the parent quote.
    /// </summary>
    public Quote Quote { get; set; } = null!;

    /// <summary>
    /// Optional product reference. Null for ad-hoc/custom line items.
    /// Set to null if the product is deleted (SET NULL on delete).
    /// </summary>
    public Guid? ProductId { get; set; }

    /// <summary>
    /// Navigation property to the linked product.
    /// </summary>
    public Product? Product { get; set; }

    /// <summary>
    /// Description of the line item (product name override or custom description).
    /// </summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// Display order of the line item within the quote.
    /// </summary>
    public int SortOrder { get; set; }

    /// <summary>
    /// Quantity of units (default 1).
    /// </summary>
    public decimal Quantity { get; set; } = 1;

    /// <summary>
    /// Price per unit.
    /// </summary>
    public decimal UnitPrice { get; set; }

    /// <summary>
    /// Discount percentage (0-100) applied to this line item.
    /// </summary>
    public decimal DiscountPercent { get; set; }

    /// <summary>
    /// Tax percentage (0-100) applied to this line item.
    /// </summary>
    public decimal TaxPercent { get; set; }

    /// <summary>
    /// Computed: Quantity * UnitPrice (before discount and tax).
    /// </summary>
    public decimal LineTotal { get; set; }

    /// <summary>
    /// Computed: LineTotal * (DiscountPercent / 100).
    /// </summary>
    public decimal DiscountAmount { get; set; }

    /// <summary>
    /// Computed: (LineTotal - DiscountAmount) * (TaxPercent / 100).
    /// </summary>
    public decimal TaxAmount { get; set; }

    /// <summary>
    /// Computed: LineTotal - DiscountAmount + TaxAmount. Final amount for this line.
    /// </summary>
    public decimal NetTotal { get; set; }
}
