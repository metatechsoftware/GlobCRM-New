namespace GlobCRM.Domain.Entities;

/// <summary>
/// Admin-defined section for grouping custom fields on entity forms.
/// Each section belongs to a specific entity type within a tenant.
/// </summary>
public class CustomFieldSection
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Tenant that owns this section.</summary>
    public Guid TenantId { get; set; }

    /// <summary>Entity type this section applies to (e.g., "Contact", "Company").</summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>Display name of the section.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Display order among sections for the same entity type.</summary>
    public int SortOrder { get; set; }

    /// <summary>Whether the section is collapsed by default on the form.</summary>
    public bool IsCollapsedByDefault { get; set; } = false;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation properties
    public ICollection<CustomFieldDefinition> Fields { get; set; } = new List<CustomFieldDefinition>();
}
