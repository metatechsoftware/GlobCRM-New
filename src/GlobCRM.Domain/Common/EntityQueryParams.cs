namespace GlobCRM.Domain.Common;

/// <summary>
/// Query parameters for entity list operations with server-side
/// filtering, sorting, and pagination support.
/// Defined in Domain so repository interfaces can reference it.
/// </summary>
public class EntityQueryParams
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 25;
    public string? SortField { get; set; }
    public string SortDirection { get; set; } = "asc";
    public string? Search { get; set; }
    public List<FilterParam>? Filters { get; set; }
}

/// <summary>
/// A single filter parameter for entity list queries.
/// FieldId can be a core field name (e.g., "name", "industry") or
/// a custom field definition GUID for JSONB containment filtering.
/// </summary>
public class FilterParam
{
    public string FieldId { get; set; } = string.Empty;
    public string Operator { get; set; } = "equals";
    public string? Value { get; set; }
}
