using System.Text.Json;
using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for DashboardWidget.
/// Maps to "dashboard_widgets" table with snake_case columns, JSONB config column,
/// string-stored WidgetType enum, and cascade delete from parent Dashboard.
/// Child entity -- no TenantId (inherits tenant isolation via Dashboard FK).
/// </summary>
public class DashboardWidgetConfiguration : IEntityTypeConfiguration<DashboardWidget>
{
    public void Configure(EntityTypeBuilder<DashboardWidget> builder)
    {
        builder.ToTable("dashboard_widgets");

        builder.HasKey(w => w.Id);

        builder.Property(w => w.Id)
            .HasColumnName("id")
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(w => w.DashboardId)
            .HasColumnName("dashboard_id")
            .IsRequired();

        builder.Property(w => w.Type)
            .HasColumnName("type")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(w => w.Title)
            .HasColumnName("title")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(w => w.X)
            .HasColumnName("x")
            .IsRequired();

        builder.Property(w => w.Y)
            .HasColumnName("y")
            .IsRequired();

        builder.Property(w => w.Cols)
            .HasColumnName("cols")
            .HasDefaultValue(2)
            .IsRequired();

        builder.Property(w => w.Rows)
            .HasColumnName("rows")
            .HasDefaultValue(2)
            .IsRequired();

        // JSONB column for widget-specific configuration
        builder.Property(w => w.Config)
            .HasColumnName("config")
            .HasColumnType("jsonb")
            .HasConversion(
                v => v == null ? null : JsonSerializer.Serialize(v, JsonSerializerOptions.Default),
                v => v == null ? null : JsonSerializer.Deserialize<Dictionary<string, object>>(v, JsonSerializerOptions.Default));

        builder.Property(w => w.SortOrder)
            .HasColumnName("sort_order")
            .IsRequired();

        // Indexes
        builder.HasIndex(w => w.DashboardId)
            .HasDatabaseName("idx_dashboard_widgets_dashboard");
    }
}
