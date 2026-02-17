using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for DealProduct.
/// Maps to "deal_products" table with composite PK on (DealId, ProductId),
/// cascade delete from both sides, and decimal precision for UnitPrice.
/// </summary>
public class DealProductConfiguration : IEntityTypeConfiguration<DealProduct>
{
    public void Configure(EntityTypeBuilder<DealProduct> builder)
    {
        builder.ToTable("deal_products");

        // Composite primary key
        builder.HasKey(dp => new { dp.DealId, dp.ProductId });

        builder.Property(dp => dp.DealId)
            .HasColumnName("deal_id");

        builder.Property(dp => dp.ProductId)
            .HasColumnName("product_id");

        builder.Property(dp => dp.Quantity)
            .HasColumnName("quantity")
            .HasDefaultValue(1);

        builder.Property(dp => dp.UnitPrice)
            .HasColumnName("unit_price")
            .HasPrecision(18, 4);

        builder.Property(dp => dp.LinkedAt)
            .HasColumnName("linked_at")
            .IsRequired();

        // Relationships
        builder.HasOne(dp => dp.Product)
            .WithMany()
            .HasForeignKey(dp => dp.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        builder.HasIndex(dp => dp.ProductId)
            .HasDatabaseName("idx_deal_products_product");
    }
}
