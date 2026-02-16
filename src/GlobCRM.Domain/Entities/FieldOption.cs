namespace GlobCRM.Domain.Entities;

/// <summary>
/// JSONB-mapped value type representing a single option for Dropdown or MultiSelect fields.
/// Stored as a JSONB array on CustomFieldDefinition.Options, not as a separate table.
/// </summary>
public class FieldOption
{
    /// <summary>Internal value stored in the database.</summary>
    public string Value { get; set; } = string.Empty;

    /// <summary>Display label shown to users.</summary>
    public string Label { get; set; } = string.Empty;

    /// <summary>Optional color for chip/badge display (e.g., "#FF5733").</summary>
    public string? Color { get; set; }

    /// <summary>Display order within the option list.</summary>
    public int SortOrder { get; set; }
}
