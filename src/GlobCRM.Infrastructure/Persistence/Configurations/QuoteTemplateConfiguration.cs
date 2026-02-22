using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for QuoteTemplate.
/// Maps to "quote_templates" table with snake_case columns, JSONB design storage,
/// proper indexes for tenant queries, and a partial unique index enforcing one default per tenant.
/// </summary>
public class QuoteTemplateConfiguration : IEntityTypeConfiguration<QuoteTemplate>
{
    public void Configure(EntityTypeBuilder<QuoteTemplate> builder)
    {
        builder.ToTable("quote_templates");

        builder.HasKey(qt => qt.Id);

        builder.Property(qt => qt.Id)
            .HasColumnName("id");

        builder.Property(qt => qt.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(qt => qt.Name)
            .HasColumnName("name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(qt => qt.DesignJson)
            .HasColumnName("design_json")
            .HasColumnType("jsonb");

        builder.Property(qt => qt.HtmlBody)
            .HasColumnName("html_body")
            .HasColumnType("text");

        builder.Property(qt => qt.IsDefault)
            .HasColumnName("is_default")
            .HasDefaultValue(false);

        builder.Property(qt => qt.PageSize)
            .HasColumnName("page_size")
            .HasMaxLength(20)
            .HasDefaultValue("A4");

        builder.Property(qt => qt.PageOrientation)
            .HasColumnName("page_orientation")
            .HasMaxLength(20)
            .HasDefaultValue("portrait");

        builder.Property(qt => qt.PageMarginTop)
            .HasColumnName("page_margin_top")
            .HasMaxLength(20);

        builder.Property(qt => qt.PageMarginRight)
            .HasColumnName("page_margin_right")
            .HasMaxLength(20);

        builder.Property(qt => qt.PageMarginBottom)
            .HasColumnName("page_margin_bottom")
            .HasMaxLength(20);

        builder.Property(qt => qt.PageMarginLeft)
            .HasColumnName("page_margin_left")
            .HasMaxLength(20);

        builder.Property(qt => qt.ThumbnailPath)
            .HasColumnName("thumbnail_path")
            .HasMaxLength(500);

        builder.Property(qt => qt.OwnerId)
            .HasColumnName("owner_id");

        builder.Property(qt => qt.IsSeedData)
            .HasColumnName("is_seed_data")
            .HasDefaultValue(false);

        builder.Property(qt => qt.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(qt => qt.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Relationships
        builder.HasOne(qt => qt.Owner)
            .WithMany()
            .HasForeignKey(qt => qt.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes
        builder.HasIndex(qt => qt.TenantId)
            .HasDatabaseName("idx_quote_templates_tenant");

        // Partial unique index: only one default template per tenant
        builder.HasIndex(qt => new { qt.TenantId, qt.IsDefault })
            .IsUnique()
            .HasFilter("is_default = true")
            .HasDatabaseName("idx_quote_templates_tenant_default");

        builder.HasIndex(qt => qt.OwnerId)
            .HasDatabaseName("idx_quote_templates_owner");
    }
}
