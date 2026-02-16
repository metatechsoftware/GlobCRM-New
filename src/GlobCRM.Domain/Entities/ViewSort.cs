namespace GlobCRM.Domain.Entities;

/// <summary>
/// JSONB-mapped value type representing a sort configuration in a saved view.
/// Stored as a JSONB array on SavedView.Sorts, not as a separate table.
/// </summary>
public class ViewSort
{
    /// <summary>Field identifier (core field name or custom field GUID string).</summary>
    public string FieldId { get; set; } = string.Empty;

    /// <summary>Sort direction: "asc" or "desc".</summary>
    public string Direction { get; set; } = "asc";

    /// <summary>Priority order when multiple sorts are applied (lower = higher priority).</summary>
    public int SortOrder { get; set; }
}
