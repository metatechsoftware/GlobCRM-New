using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// Core report builder entity. Stores the full report definition as JSONB,
/// including selected fields, filter tree, groupings, and chart configuration.
/// Reports are tenant-scoped with optional sharing and ownership for access control.
///
/// Triple-layer tenant isolation: TenantId property + global query filter + RLS policy.
/// </summary>
public class Report
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Tenant (organization) ID for multi-tenancy isolation.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Human-readable name for this report (e.g., "Q4 Sales Pipeline").
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional description of the report purpose and content.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Optional FK to ReportCategory for organizing reports into groups.
    /// </summary>
    public Guid? CategoryId { get; set; }

    /// <summary>
    /// Navigation property to the report's category.
    /// </summary>
    public ReportCategory? Category { get; set; }

    /// <summary>
    /// The target CRM entity type this report queries ("Contact", "Deal", "Company", etc.).
    /// </summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>
    /// Full report definition stored as a single JSONB document.
    /// Contains selected fields, filter tree, groupings, and chart configuration.
    /// </summary>
    public ReportDefinition Definition { get; set; } = new();

    /// <summary>
    /// User who owns this report. Null for system/seed reports.
    /// </summary>
    public Guid? OwnerId { get; set; }

    /// <summary>
    /// Navigation property to the report owner.
    /// </summary>
    public ApplicationUser? Owner { get; set; }

    /// <summary>
    /// When true, all users in the tenant can view this report.
    /// When false, only the owner can access it.
    /// </summary>
    public bool IsShared { get; set; } = false;

    /// <summary>
    /// Marks records created by TenantSeeder for bulk deletion of demo data.
    /// </summary>
    public bool IsSeedData { get; set; } = false;

    /// <summary>
    /// Chart visualization type for this report.
    /// </summary>
    public ReportChartType ChartType { get; set; } = ReportChartType.Table;

    /// <summary>
    /// When the report was last executed (null if never).
    /// </summary>
    public DateTimeOffset? LastRunAt { get; set; }

    /// <summary>
    /// Row count from the last execution (null if never run).
    /// </summary>
    public int? LastRunRowCount { get; set; }

    // Audit timestamps
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>
/// The complete report definition stored as a single JSONB document.
/// Contains selected fields, filter tree, groupings, and chart configuration.
/// </summary>
public class ReportDefinition
{
    /// <summary>
    /// Selected columns/fields to include in the report output.
    /// </summary>
    public List<ReportField> Fields { get; set; } = [];

    /// <summary>
    /// Nested AND/OR filter tree for report data filtering.
    /// Null means no filters applied (return all records).
    /// </summary>
    public ReportFilterGroup? FilterGroup { get; set; }

    /// <summary>
    /// Group-by fields for aggregated reports.
    /// Empty list means no grouping (flat record list).
    /// </summary>
    public List<ReportGrouping> Groupings { get; set; } = [];

    /// <summary>
    /// Chart visualization configuration. Null uses default settings.
    /// </summary>
    public ReportChartConfig? ChartConfig { get; set; }
}

/// <summary>
/// A selected field (column) in the report output.
/// </summary>
public class ReportField
{
    /// <summary>
    /// Field identifier (e.g., "name", "related.Company.name", "custom_field_name").
    /// </summary>
    public string FieldId { get; set; } = string.Empty;

    /// <summary>
    /// Display label for the column header.
    /// </summary>
    public string Label { get; set; } = string.Empty;

    /// <summary>
    /// Field type: "system", "custom", "formula", "related".
    /// </summary>
    public string FieldType { get; set; } = string.Empty;

    /// <summary>
    /// Aggregation function for grouped reports. Null for non-grouped fields.
    /// </summary>
    public AggregationType? Aggregation { get; set; }

    /// <summary>
    /// Column display order (lower = leftmost).
    /// </summary>
    public int SortOrder { get; set; }
}

/// <summary>
/// Recursive filter group supporting nested AND/OR filter trees.
/// </summary>
public class ReportFilterGroup
{
    /// <summary>
    /// Logic operator combining conditions and child groups.
    /// </summary>
    public FilterLogic Logic { get; set; } = FilterLogic.And;

    /// <summary>
    /// Filter conditions within this group.
    /// </summary>
    public List<ReportFilterCondition> Conditions { get; set; } = [];

    /// <summary>
    /// Nested child filter groups for complex expressions.
    /// </summary>
    public List<ReportFilterGroup> Groups { get; set; } = [];
}

/// <summary>
/// A single filter condition comparing a field against a value.
/// </summary>
public class ReportFilterCondition
{
    /// <summary>
    /// The entity field to filter on.
    /// </summary>
    public string FieldId { get; set; } = string.Empty;

    /// <summary>
    /// Comparison operator: equals, not_equals, contains, not_contains,
    /// greater_than, less_than, between, is_empty, is_not_empty.
    /// </summary>
    public string Operator { get; set; } = string.Empty;

    /// <summary>
    /// The value to compare against (null for is_empty/is_not_empty).
    /// </summary>
    public string? Value { get; set; }

    /// <summary>
    /// Upper bound value for "between" operator.
    /// </summary>
    public string? ValueTo { get; set; }
}

/// <summary>
/// A group-by field configuration for aggregated reports.
/// </summary>
public class ReportGrouping
{
    /// <summary>
    /// The field to group by.
    /// </summary>
    public string FieldId { get; set; } = string.Empty;

    /// <summary>
    /// For date fields: truncation level (day, week, month, quarter, year).
    /// Null for non-date fields.
    /// </summary>
    public string? DateTruncation { get; set; }
}

/// <summary>
/// Chart visualization configuration.
/// </summary>
public class ReportChartConfig
{
    /// <summary>
    /// Chart type override (can differ from Report.ChartType for dual views).
    /// </summary>
    public ReportChartType ChartType { get; set; } = ReportChartType.Bar;

    /// <summary>
    /// Named color scheme (e.g., "default", "vibrant", "pastel").
    /// </summary>
    public string? ColorScheme { get; set; }

    /// <summary>
    /// Whether to show the chart legend.
    /// </summary>
    public bool ShowLegend { get; set; } = true;

    /// <summary>
    /// Whether to show data labels on chart elements.
    /// </summary>
    public bool ShowDataLabels { get; set; } = false;
}
