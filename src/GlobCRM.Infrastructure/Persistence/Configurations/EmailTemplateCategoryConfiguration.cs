using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for EmailTemplateCategory.
/// Maps to "email_template_categories" table with snake_case columns,
/// unique index on (tenant_id, name), and tenant_id index.
/// </summary>
public class EmailTemplateCategoryConfiguration : IEntityTypeConfiguration<EmailTemplateCategory>
{
    public void Configure(EntityTypeBuilder<EmailTemplateCategory> builder)
    {
        builder.ToTable("email_template_categories");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .HasColumnName("id");

        builder.Property(c => c.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(c => c.Name)
            .HasColumnName("name")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(c => c.SortOrder)
            .HasColumnName("sort_order")
            .IsRequired();

        builder.Property(c => c.IsSystem)
            .HasColumnName("is_system")
            .HasDefaultValue(false);

        builder.Property(c => c.IsSeedData)
            .HasColumnName("is_seed_data")
            .HasDefaultValue(false);

        builder.Property(c => c.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(c => c.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Indexes
        builder.HasIndex(c => c.TenantId)
            .HasDatabaseName("idx_email_template_categories_tenant_id");

        builder.HasIndex(c => new { c.TenantId, c.Name })
            .IsUnique()
            .HasDatabaseName("idx_email_template_categories_tenant_name");
    }
}
