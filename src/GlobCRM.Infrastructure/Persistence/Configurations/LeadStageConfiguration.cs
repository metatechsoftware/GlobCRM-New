using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for LeadStage.
/// Maps to "lead_stages" table with snake_case columns.
/// Tenant-scoped with composite index on (tenant_id, sort_order).
/// </summary>
public class LeadStageConfiguration : IEntityTypeConfiguration<LeadStage>
{
    public void Configure(EntityTypeBuilder<LeadStage> builder)
    {
        builder.ToTable("lead_stages");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id)
            .HasColumnName("id");

        builder.Property(s => s.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(s => s.Name)
            .HasColumnName("name")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(s => s.SortOrder)
            .HasColumnName("sort_order")
            .IsRequired();

        builder.Property(s => s.Color)
            .HasColumnName("color")
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(s => s.IsConverted)
            .HasColumnName("is_converted")
            .HasDefaultValue(false);

        builder.Property(s => s.IsLost)
            .HasColumnName("is_lost")
            .HasDefaultValue(false);

        builder.Property(s => s.IsSeedData)
            .HasColumnName("is_seed_data")
            .HasDefaultValue(false);

        builder.Property(s => s.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(s => s.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Indexes
        builder.HasIndex(s => new { s.TenantId, s.SortOrder })
            .HasDatabaseName("idx_lead_stages_tenant_sort_order");
    }
}
