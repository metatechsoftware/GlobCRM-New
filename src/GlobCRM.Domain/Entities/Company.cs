namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a company/account in the CRM.
/// Companies are tenant-scoped with JSONB custom fields and optional ownership.
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class Company
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    // Core fields
    public string Name { get; set; } = string.Empty;
    public string? Industry { get; set; }
    public string? Website { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public string? PostalCode { get; set; }

    /// <summary>
    /// Company size category (e.g., "1-10", "11-50", "51-200", "201-500", "500+").
    /// </summary>
    public string? Size { get; set; }

    public string? Description { get; set; }

    // Ownership (for scope-based permission filtering: Own, Team, All)
    public Guid? OwnerId { get; set; }
    public ApplicationUser? Owner { get; set; }

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

    // Navigation: Company has many Contacts (one-to-many via Contact.CompanyId)
    public ICollection<Contact> Contacts { get; set; } = new List<Contact>();

    // Navigation: Company has many Deals (one-to-many via Deal.CompanyId)
    public ICollection<Deal> Deals { get; set; } = new List<Deal>();
}
