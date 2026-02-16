namespace GlobCRM.Domain.Entities;

/// <summary>
/// JSONB-mapped value type representing a column configuration in a saved view.
/// Stored as a JSONB array on SavedView.Columns, not as a separate table.
/// </summary>
public class ViewColumn
{
    /// <summary>
    /// Core field name or CustomFieldDefinition.Id as string.
    /// Core fields use their property name (e.g., "firstName", "email").
    /// Custom fields use the GUID string of the CustomFieldDefinition.
    /// </summary>
    public string FieldId { get; set; } = string.Empty;

    /// <summary>Whether this column references a custom field (vs. a core entity field).</summary>
    public bool IsCustomField { get; set; }

    /// <summary>Column width in pixels.</summary>
    public int Width { get; set; } = 150;

    /// <summary>Display order of this column in the table.</summary>
    public int SortOrder { get; set; }

    /// <summary>Whether this column is visible in the table.</summary>
    public bool Visible { get; set; } = true;
}
