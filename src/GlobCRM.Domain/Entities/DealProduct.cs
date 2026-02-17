namespace GlobCRM.Domain.Entities;

/// <summary>
/// Join entity for the many-to-many relationship between Deal and Product.
/// Includes quantity and optional price override for deal-specific pricing.
/// Child entity — inherits tenant isolation via Deal FK (no TenantId).
/// Composite PK on (DealId, ProductId).
/// </summary>
public class DealProduct
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
    /// Product side of the relationship.
    /// </summary>
    public Guid ProductId { get; set; }

    /// <summary>
    /// Navigation property to the linked product.
    /// </summary>
    public Product Product { get; set; } = null!;

    /// <summary>
    /// Quantity of the product in this deal (default 1).
    /// </summary>
    public int Quantity { get; set; } = 1;

    /// <summary>
    /// Optional unit price override. When null, uses Product.UnitPrice.
    /// </summary>
    public decimal? UnitPrice { get; set; }

    /// <summary>
    /// Timestamp when the product was linked to the deal.
    /// </summary>
    public DateTimeOffset LinkedAt { get; set; } = DateTimeOffset.UtcNow;
}
