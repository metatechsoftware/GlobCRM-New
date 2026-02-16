using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for CustomFieldSection.
/// Sections group custom fields on entity forms for better UX.
/// </summary>
public class CustomFieldSectionConfiguration : IEntityTypeConfiguration<CustomFieldSection>
{
    public void Configure(EntityTypeBuilder<CustomFieldSection> builder)
    {
        builder.ToTable("custom_field_sections");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id)
            .HasColumnName("id")
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(s => s.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(s => s.EntityType)
            .HasColumnName("entity_type")
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(s => s.Name)
            .HasColumnName("name")
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(s => s.SortOrder)
            .HasColumnName("sort_order")
            .IsRequired();

        builder.Property(s => s.IsCollapsedByDefault)
            .HasColumnName("is_collapsed_by_default")
            .IsRequired()
            .HasDefaultValue(false);

        builder.Property(s => s.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired()
            .HasDefaultValueSql("NOW()");

        // Unique constraint: (tenant_id, entity_type, name)
        builder.HasIndex(s => new { s.TenantId, s.EntityType, s.Name })
            .IsUnique()
            .HasDatabaseName("idx_custom_field_sections_tenant_entity_name");

        // Composite index for tenant + entity type queries
        builder.HasIndex(s => new { s.TenantId, s.EntityType })
            .HasDatabaseName("idx_custom_field_sections_tenant_entity");
    }
}
