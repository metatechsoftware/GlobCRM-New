using GlobCRM.Domain.Enums;

namespace GlobCRM.Domain.Entities;

/// <summary>
/// A widget on a dashboard for displaying CRM metrics and data.
/// Child entity -- inherits tenant isolation via Dashboard FK (no TenantId).
/// Stores gridster2 position (X,Y) and size (Cols,Rows) for layout.
/// Config stored as JSONB for widget-specific configuration (metric, groupBy, chartType, etc.).
/// </summary>
public class DashboardWidget
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Parent dashboard this widget belongs to.</summary>
    public Guid DashboardId { get; set; }

    /// <summary>Widget visualization type (KpiCard, BarChart, etc.).</summary>
    public WidgetType Type { get; set; }

    /// <summary>Display title for the widget.</summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>Gridster2 X position (column).</summary>
    public int X { get; set; }

    /// <summary>Gridster2 Y position (row).</summary>
    public int Y { get; set; }

    /// <summary>Gridster2 column span (width). Default 2.</summary>
    public int Cols { get; set; } = 2;

    /// <summary>Gridster2 row span (height). Default 2.</summary>
    public int Rows { get; set; } = 2;

    /// <summary>
    /// Widget-specific configuration stored as JSONB.
    /// Contains metric type, groupBy, chartType, color, date range, etc.
    /// </summary>
    public Dictionary<string, object>? Config { get; set; }

    /// <summary>Display order within the dashboard.</summary>
    public int SortOrder { get; set; }

    // Navigation properties
    public Dashboard Dashboard { get; set; } = null!;
}
