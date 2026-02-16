using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for Product.
/// Maps to "products" table with snake_case columns, JSONB custom fields,
/// decimal precision for UnitPrice, and filtered unique index on SKU per tenant.
/// </summary>
public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("products");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id)
            .HasColumnName("id");

        builder.Property(p => p.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(p => p.Name)
            .HasColumnName("name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(p => p.Description)
            .HasColumnName("description");

        builder.Property(p => p.UnitPrice)
            .HasColumnName("unit_price")
            .HasPrecision(18, 4);

        builder.Property(p => p.SKU)
            .HasColumnName("sku")
            .HasMaxLength(50);

        builder.Property(p => p.Category)
            .HasColumnName("category")
            .HasMaxLength(100);

        builder.Property(p => p.IsActive)
            .HasColumnName("is_active")
            .HasDefaultValue(true);

        builder.Property(p => p.CustomFields)
            .HasColumnName("custom_fields")
            .HasColumnType("jsonb")
            .HasDefaultValueSql("'{}'::jsonb");

        builder.Property(p => p.IsSeedData)
            .HasColumnName("is_seed_data")
            .HasDefaultValue(false);

        builder.Property(p => p.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(p => p.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Indexes
        builder.HasIndex(p => p.TenantId)
            .HasDatabaseName("idx_products_tenant");

        builder.HasIndex(p => new { p.TenantId, p.SKU })
            .IsUnique()
            .HasDatabaseName("idx_products_tenant_sku")
            .HasFilter("sku IS NOT NULL");

        builder.HasIndex(p => p.CustomFields)
            .HasMethod("gin")
            .HasDatabaseName("idx_products_custom_fields_gin");
    }
}
