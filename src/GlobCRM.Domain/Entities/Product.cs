namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a product or service in the CRM catalog.
/// Products are tenant-scoped shared resources (no OwnerId) with UnitPrice for quote line items.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class Product
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    // Core fields (PROD-03)
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    /// <summary>
    /// Default unit price. Quotes can override this per line item.
    /// </summary>
    public decimal UnitPrice { get; set; }

    /// <summary>
    /// Stock keeping unit. Unique per tenant (enforced by filtered unique index).
    /// </summary>
    public string? SKU { get; set; }

    public string? Category { get; set; }

    /// <summary>
    /// Active status for hiding without deleting. Inactive products are excluded from quote line item selection.
    /// </summary>
    public bool IsActive { get; set; } = true;

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
