using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for DuplicateMatchingConfig.
/// Maps to "duplicate_matching_configs" table with snake_case columns.
/// Unique constraint on (TenantId, EntityType) ensures one config per entity type per tenant.
/// </summary>
public class DuplicateMatchingConfigConfiguration : IEntityTypeConfiguration<DuplicateMatchingConfig>
{
    public void Configure(EntityTypeBuilder<DuplicateMatchingConfig> builder)
    {
        builder.ToTable("duplicate_matching_configs");

        builder.HasKey(d => d.Id);

        builder.Property(d => d.Id)
            .HasColumnName("id");

        builder.Property(d => d.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(d => d.EntityType)
            .HasColumnName("entity_type")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(d => d.AutoDetectionEnabled)
            .HasColumnName("auto_detection_enabled")
            .HasDefaultValue(true);

        builder.Property(d => d.SimilarityThreshold)
            .HasColumnName("similarity_threshold")
            .HasDefaultValue(70);

        builder.Property(d => d.MatchingFields)
            .HasColumnName("matching_fields")
            .HasColumnType("jsonb")
            .HasDefaultValueSql("'[]'::jsonb");

        builder.Property(d => d.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(d => d.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Unique constraint: one config per entity type per tenant
        builder.HasIndex(d => new { d.TenantId, d.EntityType })
            .IsUnique()
            .HasDatabaseName("idx_dup_matching_configs_tenant_entity");

        builder.HasIndex(d => d.TenantId)
            .HasDatabaseName("idx_dup_matching_configs_tenant");
    }
}
