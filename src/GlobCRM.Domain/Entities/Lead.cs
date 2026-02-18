using GlobCRM.Domain.Enums;
using NpgsqlTypes;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a lead/prospect in the CRM.
/// Leads are tenant-scoped with pipeline stage tracking, source attribution,
/// temperature scoring, ownership for RBAC, and conversion tracking.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class Lead
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    // Person fields
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? MobilePhone { get; set; }
    public string? JobTitle { get; set; }

    /// <summary>
    /// Company name as a string (NOT FK). Leads may reference non-existent companies.
    /// </summary>
    public string? CompanyName { get; set; }

    // Pipeline: stage FK
    /// <summary>
    /// Current stage of the lead in the pipeline (required).
    /// </summary>
    public Guid LeadStageId { get; set; }

    /// <summary>
    /// Navigation property to the current lead stage.
    /// </summary>
    public LeadStage Stage { get; set; } = null!;

    // Source: optional FK
    /// <summary>
    /// Source that generated this lead (optional).
    /// Set to null if the source is deleted (SET NULL on delete).
    /// </summary>
    public Guid? LeadSourceId { get; set; }

    /// <summary>
    /// Navigation property to the lead source.
    /// </summary>
    public LeadSource? Source { get; set; }

    /// <summary>
    /// Temperature/warmth level of the lead. Defaults to Warm.
    /// </summary>
    public LeadTemperature Temperature { get; set; } = LeadTemperature.Warm;

    // Ownership (for scope-based permission filtering: Own, Team, All)
    /// <summary>
    /// User who owns this lead. Used for scope-based permission filtering.
    /// Set to null if the owner is deleted (SET NULL on delete).
    /// </summary>
    public Guid? OwnerId { get; set; }

    /// <summary>
    /// Navigation property to the lead owner.
    /// </summary>
    public ApplicationUser? Owner { get; set; }

    // Conversion tracking
    /// <summary>
    /// Whether this lead has been converted to a contact/company/deal.
    /// Converted leads become read-only (NOT soft-deleted).
    /// </summary>
    public bool IsConverted { get; set; }

    /// <summary>
    /// Timestamp when the lead was converted.
    /// </summary>
    public DateTimeOffset? ConvertedAt { get; set; }

    /// <summary>
    /// User who performed the conversion.
    /// </summary>
    public Guid? ConvertedByUserId { get; set; }

    /// <summary>
    /// Contact created from this lead during conversion.
    /// </summary>
    public Guid? ConvertedContactId { get; set; }

    /// <summary>
    /// Company created/linked during conversion.
    /// </summary>
    public Guid? ConvertedCompanyId { get; set; }

    /// <summary>
    /// Deal created during conversion.
    /// </summary>
    public Guid? ConvertedDealId { get; set; }

    /// <summary>
    /// Custom fields stored as JSONB. Keys are custom field definition IDs.
    /// </summary>
    public Dictionary<string, object?> CustomFields { get; set; } = new();

    /// <summary>
    /// Optional description or notes about the lead.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// PostgreSQL tsvector column for full-text search across FirstName, LastName, Email, CompanyName.
    /// Generated and maintained by the database via HasGeneratedTsVectorColumn.
    /// </summary>
    public NpgsqlTsVector SearchVector { get; set; } = null!;

    /// <summary>
    /// Marks records created by TenantSeeder for bulk deletion of demo data.
    /// </summary>
    public bool IsSeedData { get; set; } = false;

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Computed full name from first and last name.
    /// </summary>
    public string FullName => $"{FirstName} {LastName}".Trim();

    // Navigation: Lead has one optional LeadConversion
    public LeadConversion? LeadConversion { get; set; }
}
