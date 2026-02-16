namespace GlobCRM.Domain.Entities;

/// <summary>
/// Represents a contact/person in the CRM.
/// Contacts are tenant-scoped with a nullable FK to Company (many-to-one).
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class Contact
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    // Core fields
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? MobilePhone { get; set; }
    public string? JobTitle { get; set; }
    public string? Department { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public string? PostalCode { get; set; }
    public string? Description { get; set; }

    // Company link (CONT-03: nullable FK, many-to-one -- NOT a join table)
    public Guid? CompanyId { get; set; }
    public Company? Company { get; set; }

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

    /// <summary>
    /// Computed full name from first and last name.
    /// </summary>
    public string FullName => $"{FirstName} {LastName}".Trim();
}
