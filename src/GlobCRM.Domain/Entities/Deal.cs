namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a deal/opportunity in the CRM.
/// Deals are tenant-scoped with pipeline stage tracking, entity linking, and JSONB custom fields.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class Deal
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Display title of the deal (e.g., "Acme Corp - Enterprise License").
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Monetary value of the deal. Nullable for deals without a known value.
    /// </summary>
    public decimal? Value { get; set; }

    /// <summary>
    /// Win probability (0.0-1.0). Can be overridden from the stage default.
    /// </summary>
    public decimal? Probability { get; set; }

    /// <summary>
    /// Expected close date for forecasting.
    /// </summary>
    public DateOnly? ExpectedCloseDate { get; set; }

    /// <summary>
    /// Actual close date, set when deal reaches a terminal stage (won/lost).
    /// </summary>
    public DateOnly? ActualCloseDate { get; set; }

    /// <summary>
    /// Pipeline this deal belongs to (required).
    /// </summary>
    public Guid PipelineId { get; set; }

    /// <summary>
    /// Navigation property to the parent pipeline.
    /// </summary>
    public Pipeline Pipeline { get; set; } = null!;

    /// <summary>
    /// Current stage of the deal within its pipeline (required).
    /// </summary>
    public Guid PipelineStageId { get; set; }

    /// <summary>
    /// Navigation property to the current pipeline stage.
    /// </summary>
    public PipelineStage Stage { get; set; } = null!;

    /// <summary>
    /// User who owns this deal. Used for scope-based permission filtering (Own, Team, All).
    /// Set to null if the owner is deleted (SET NULL on delete).
    /// </summary>
    public Guid? OwnerId { get; set; }

    /// <summary>
    /// Navigation property to the deal owner.
    /// </summary>
    public ApplicationUser? Owner { get; set; }

    /// <summary>
    /// Optional company associated with this deal.
    /// Set to null if the company is deleted (SET NULL on delete).
    /// </summary>
    public Guid? CompanyId { get; set; }

    /// <summary>
    /// Navigation property to the associated company.
    /// </summary>
    public Company? Company { get; set; }

    /// <summary>
    /// Custom fields stored as JSONB. Keys are custom field definition IDs.
    /// </summary>
    public Dictionary<string, object?> CustomFields { get; set; } = new();

    /// <summary>
    /// Optional description or notes about the deal.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Marks records created by TenantSeeder for bulk deletion of demo data.
    /// </summary>
    public bool IsSeedData { get; set; } = false;

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation: Deal has many linked contacts (many-to-many via DealContact)
    public ICollection<DealContact> DealContacts { get; set; } = new List<DealContact>();

    // Navigation: Deal has many linked products (many-to-many via DealProduct)
    public ICollection<DealProduct> DealProducts { get; set; } = new List<DealProduct>();
}
