using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for QuoteLineItem.
/// Maps to "quote_line_items" table with snake_case columns,
/// proper decimal precision for pricing/percentages, and cascade delete from Quote.
/// Child entity -- no TenantId (inherits tenant isolation via Quote FK).
/// </summary>
public class QuoteLineItemConfiguration : IEntityTypeConfiguration<QuoteLineItem>
{
    public void Configure(EntityTypeBuilder<QuoteLineItem> builder)
    {
        builder.ToTable("quote_line_items");

        builder.HasKey(li => li.Id);

        builder.Property(li => li.Id)
            .HasColumnName("id");

        builder.Property(li => li.QuoteId)
            .HasColumnName("quote_id")
            .IsRequired();

        builder.Property(li => li.ProductId)
            .HasColumnName("product_id");

        builder.Property(li => li.Description)
            .HasColumnName("description")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(li => li.SortOrder)
            .HasColumnName("sort_order");

        builder.Property(li => li.Quantity)
            .HasColumnName("quantity")
            .HasPrecision(18, 4)
            .HasDefaultValue(1m);

        builder.Property(li => li.UnitPrice)
            .HasColumnName("unit_price")
            .HasPrecision(18, 4);

        builder.Property(li => li.DiscountPercent)
            .HasColumnName("discount_percent")
            .HasPrecision(5, 2);

        builder.Property(li => li.TaxPercent)
            .HasColumnName("tax_percent")
            .HasPrecision(5, 2);

        builder.Property(li => li.LineTotal)
            .HasColumnName("line_total")
            .HasPrecision(18, 2);

        builder.Property(li => li.DiscountAmount)
            .HasColumnName("discount_amount")
            .HasPrecision(18, 2);

        builder.Property(li => li.TaxAmount)
            .HasColumnName("tax_amount")
            .HasPrecision(18, 2);

        builder.Property(li => li.NetTotal)
            .HasColumnName("net_total")
            .HasPrecision(18, 2);

        // Relationships
        builder.HasOne(li => li.Product)
            .WithMany()
            .HasForeignKey(li => li.ProductId)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes
        builder.HasIndex(li => li.QuoteId)
            .HasDatabaseName("idx_quote_line_items_quote");

        builder.HasIndex(li => li.ProductId)
            .HasDatabaseName("idx_quote_line_items_product");
    }
}
