using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Metadata definition for an admin-created custom field.
/// Each definition belongs to a tenant and entity type, and specifies the field type,
/// validation rules (JSONB), dropdown options (JSONB), and optional section grouping.
/// Supports soft delete for data preservation.
/// </summary>
public class CustomFieldDefinition
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Tenant that owns this field definition.</summary>
    public Guid TenantId { get; set; }

    /// <summary>Entity type this field applies to (e.g., "Contact", "Company").</summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>Internal snake_case name used as the storage key.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Display label shown to users in forms and tables.</summary>
    public string Label { get; set; } = string.Empty;

    /// <summary>The data type of this custom field.</summary>
    public CustomFieldType FieldType { get; set; }

    /// <summary>Display order among fields for the same entity type.</summary>
    public int SortOrder { get; set; }

    /// <summary>Optional section grouping. Null means the field is in the default (ungrouped) area.</summary>
    public Guid? SectionId { get; set; }

    /// <summary>Validation rules stored as JSONB.</summary>
    public CustomFieldValidation Validation { get; set; } = new();

    /// <summary>
    /// Dropdown/MultiSelect options stored as JSONB array.
    /// Null for non-option field types.
    /// </summary>
    public List<FieldOption>? Options { get; set; }

    /// <summary>
    /// Target entity type for Relation fields (e.g., "Company" when a Contact relates to a Company).
    /// Null for non-Relation field types.
    /// </summary>
    public string? RelationEntityType { get; set; }

    /// <summary>
    /// Formula expression string (only for Formula field type).
    /// e.g., "[value] * [probability] / 100"
    /// </summary>
    public string? FormulaExpression { get; set; }

    /// <summary>
    /// Expected result type for the formula: "number", "text", or "date".
    /// Used for display formatting on the frontend.
    /// </summary>
    public string? FormulaResultType { get; set; }

    /// <summary>
    /// Cached list of field reference names this formula depends on.
    /// Used for topological sorting and circular dependency validation.
    /// Stored as JSONB array.
    /// </summary>
    public List<string>? DependsOnFieldIds { get; set; }

    /// <summary>
    /// When true, this custom field is shown in entity preview sidebars.
    /// Defaults to false. Managed by admin in custom field settings.
    /// </summary>
    public bool ShowInPreview { get; set; } = false;

    /// <summary>Soft delete flag. When true, the field is hidden but data is preserved.</summary>
    public bool IsDeleted { get; set; } = false;

    /// <summary>Timestamp of soft deletion. Null if not deleted.</summary>
    public DateTimeOffset? DeletedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation properties
    public CustomFieldSection? Section { get; set; }
}
