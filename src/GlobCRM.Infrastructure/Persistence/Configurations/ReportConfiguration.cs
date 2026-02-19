using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for Report.
/// Maps to "reports" table with snake_case columns, JSONB definition
/// with nested owned types, and composite indexes for fast queries.
/// </summary>
public class ReportConfiguration : IEntityTypeConfiguration<Report>
{
    public void Configure(EntityTypeBuilder<Report> builder)
    {
        builder.ToTable("reports");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Id)
            .HasColumnName("id");

        builder.Property(r => r.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(r => r.Name)
            .HasColumnName("name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(r => r.Description)
            .HasColumnName("description")
            .HasMaxLength(1000);

        builder.Property(r => r.CategoryId)
            .HasColumnName("category_id");

        builder.Property(r => r.EntityType)
            .HasColumnName("entity_type")
            .HasMaxLength(50)
            .IsRequired();

        // JSONB definition column — stores full ReportDefinition as owned JSON
        builder.OwnsOne(r => r.Definition, d =>
        {
            d.ToJson("definition");
            d.OwnsMany(def => def.Fields);
            d.OwnsOne(def => def.FilterGroup, fg =>
            {
                fg.OwnsMany(g => g.Conditions);
                fg.OwnsMany(g => g.Groups, childGroup =>
                {
                    childGroup.OwnsMany(cg => cg.Conditions);
                    // Support one level of nesting (groups within groups)
                    childGroup.OwnsMany(cg => cg.Groups, grandChild =>
                    {
                        grandChild.OwnsMany(gc => gc.Conditions);
                    });
                });
            });
            d.OwnsMany(def => def.Groupings);
            d.OwnsOne(def => def.ChartConfig);
        });

        builder.Property(r => r.OwnerId)
            .HasColumnName("owner_id");

        builder.Property(r => r.IsShared)
            .HasColumnName("is_shared")
            .HasDefaultValue(false);

        builder.Property(r => r.IsSeedData)
            .HasColumnName("is_seed_data")
            .HasDefaultValue(false);

        builder.Property(r => r.ChartType)
            .HasColumnName("chart_type")
            .HasMaxLength(20)
            .HasConversion<string>();

        builder.Property(r => r.LastRunAt)
            .HasColumnName("last_run_at");

        builder.Property(r => r.LastRunRowCount)
            .HasColumnName("last_run_row_count");

        builder.Property(r => r.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(r => r.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // FK to ReportCategory (optional, set null on delete)
        builder.HasOne(r => r.Category)
            .WithMany(c => c.Reports)
            .HasForeignKey(r => r.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        // FK to ApplicationUser Owner (optional, set null on delete)
        builder.HasOne(r => r.Owner)
            .WithMany()
            .HasForeignKey(r => r.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes
        // Composite index for entity-type queries within a tenant
        builder.HasIndex(r => new { r.TenantId, r.EntityType })
            .HasDatabaseName("ix_reports_tenant_entity_type");

        // Composite index for access filtering (owner's reports + shared reports)
        builder.HasIndex(r => new { r.TenantId, r.OwnerId, r.IsShared })
            .HasDatabaseName("ix_reports_tenant_owner_shared");

        // Tenant-only index for general listing
        builder.HasIndex(r => r.TenantId)
            .HasDatabaseName("ix_reports_tenant");
    }
}
