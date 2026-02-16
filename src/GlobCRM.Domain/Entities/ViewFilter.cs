namespace GlobCRM.Domain.Entities;

/// <summary>
/// JSONB-mapped value type representing a filter condition in a saved view.
/// Stored as a JSONB array on SavedView.Filters, not as a separate table.
/// </summary>
public class ViewFilter
{
    /// <summary>Field identifier (core field name or custom field GUID string).</summary>
    public string FieldId { get; set; } = string.Empty;

    /// <summary>
    /// Filter operator. Supported values:
    /// "equals", "contains", "gt", "lt", "gte", "lte", "in", "between".
    /// </summary>
    public string Operator { get; set; } = string.Empty;

    /// <summary>
    /// Filter value. Format depends on operator:
    /// - "in": comma-separated values
    /// - "between": "min,max"
    /// - Others: single value as string
    /// </summary>
    public string? Value { get; set; }
}
