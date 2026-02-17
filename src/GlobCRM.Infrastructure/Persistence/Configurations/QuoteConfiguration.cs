using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for Quote.
/// Maps to "quotes" table with snake_case columns, JSONB custom fields with GIN index,
/// string conversion for Status enum, and proper FK constraints for entity links and versioning.
/// </summary>
public class QuoteConfiguration : IEntityTypeConfiguration<Quote>
{
    public void Configure(EntityTypeBuilder<Quote> builder)
    {
        builder.ToTable("quotes");

        builder.HasKey(q => q.Id);

        builder.Property(q => q.Id)
            .HasColumnName("id");

        builder.Property(q => q.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(q => q.QuoteNumber)
            .HasColumnName("quote_number")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(q => q.Title)
            .HasColumnName("title")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(q => q.Description)
            .HasColumnName("description")
            .HasMaxLength(5000);

        builder.Property(q => q.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(q => q.IssueDate)
            .HasColumnName("issue_date")
            .HasColumnType("date");

        builder.Property(q => q.ExpiryDate)
            .HasColumnName("expiry_date")
            .HasColumnType("date");

        builder.Property(q => q.VersionNumber)
            .HasColumnName("version_number")
            .HasDefaultValue(1);

        builder.Property(q => q.OriginalQuoteId)
            .HasColumnName("original_quote_id");

        builder.Property(q => q.DealId)
            .HasColumnName("deal_id");

        builder.Property(q => q.ContactId)
            .HasColumnName("contact_id");

        builder.Property(q => q.CompanyId)
            .HasColumnName("company_id");

        builder.Property(q => q.OwnerId)
            .HasColumnName("owner_id");

        builder.Property(q => q.Subtotal)
            .HasColumnName("subtotal")
            .HasPrecision(18, 2);

        builder.Property(q => q.DiscountTotal)
            .HasColumnName("discount_total")
            .HasPrecision(18, 2);

        builder.Property(q => q.TaxTotal)
            .HasColumnName("tax_total")
            .HasPrecision(18, 2);

        builder.Property(q => q.GrandTotal)
            .HasColumnName("grand_total")
            .HasPrecision(18, 2);

        builder.Property(q => q.Notes)
            .HasColumnName("notes")
            .HasMaxLength(5000);

        builder.Property(q => q.CustomFields)
            .HasColumnName("custom_fields")
            .HasColumnType("jsonb")
            .HasDefaultValueSql("'{}'::jsonb");

        builder.Property(q => q.IsSeedData)
            .HasColumnName("is_seed_data")
            .HasDefaultValue(false);

        builder.Property(q => q.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(q => q.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Relationships
        builder.HasOne(q => q.OriginalQuote)
            .WithMany()
            .HasForeignKey(q => q.OriginalQuoteId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(q => q.Deal)
            .WithMany()
            .HasForeignKey(q => q.DealId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(q => q.Contact)
            .WithMany(c => c.Quotes)
            .HasForeignKey(q => q.ContactId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(q => q.Company)
            .WithMany(c => c.Quotes)
            .HasForeignKey(q => q.CompanyId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(q => q.Owner)
            .WithMany()
            .HasForeignKey(q => q.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(q => q.LineItems)
            .WithOne(li => li.Quote)
            .HasForeignKey(li => li.QuoteId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(q => q.StatusHistories)
            .WithOne(h => h.Quote)
            .HasForeignKey(h => h.QuoteId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        builder.HasIndex(q => q.TenantId)
            .HasDatabaseName("idx_quotes_tenant");

        builder.HasIndex(q => q.DealId)
            .HasDatabaseName("idx_quotes_deal");

        builder.HasIndex(q => q.ContactId)
            .HasDatabaseName("idx_quotes_contact");

        builder.HasIndex(q => q.CompanyId)
            .HasDatabaseName("idx_quotes_company");

        builder.HasIndex(q => q.OwnerId)
            .HasDatabaseName("idx_quotes_owner");

        builder.HasIndex(q => q.OriginalQuoteId)
            .HasDatabaseName("idx_quotes_original");

        builder.HasIndex(q => q.CustomFields)
            .HasMethod("gin")
            .HasDatabaseName("idx_quotes_custom_fields_gin");
    }
}
