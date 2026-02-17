using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for QuoteStatusHistory.
/// Maps to "quote_status_history" table with snake_case columns,
/// cascade delete from Quote, and string conversions for status enums.
/// Child entity -- no TenantId (inherits tenant isolation via Quote FK).
/// Follows ActivityStatusHistoryConfiguration pattern exactly.
/// </summary>
public class QuoteStatusHistoryConfiguration : IEntityTypeConfiguration<QuoteStatusHistory>
{
    public void Configure(EntityTypeBuilder<QuoteStatusHistory> builder)
    {
        builder.ToTable("quote_status_history");

        builder.HasKey(h => h.Id);

        builder.Property(h => h.Id)
            .HasColumnName("id");

        builder.Property(h => h.QuoteId)
            .HasColumnName("quote_id")
            .IsRequired();

        builder.Property(h => h.FromStatus)
            .HasColumnName("from_status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(h => h.ToStatus)
            .HasColumnName("to_status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(h => h.ChangedById)
            .HasColumnName("changed_by_id");

        builder.Property(h => h.ChangedAt)
            .HasColumnName("changed_at")
            .IsRequired();

        // Relationships
        builder.HasOne(h => h.Quote)
            .WithMany(q => q.StatusHistories)
            .HasForeignKey(h => h.QuoteId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(h => h.ChangedBy)
            .WithMany()
            .HasForeignKey(h => h.ChangedById)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes
        builder.HasIndex(h => h.QuoteId)
            .HasDatabaseName("idx_quote_status_history_quote");
    }
}
