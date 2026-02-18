using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for LeadConversion.
/// Maps to "lead_conversions" table with snake_case columns.
/// One-to-one with Lead (unique index on LeadId).
/// </summary>
public class LeadConversionConfiguration : IEntityTypeConfiguration<LeadConversion>
{
    public void Configure(EntityTypeBuilder<LeadConversion> builder)
    {
        builder.ToTable("lead_conversions");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .HasColumnName("id");

        builder.Property(c => c.LeadId)
            .HasColumnName("lead_id")
            .IsRequired();

        builder.Property(c => c.ContactId)
            .HasColumnName("contact_id")
            .IsRequired();

        builder.Property(c => c.CompanyId)
            .HasColumnName("company_id");

        builder.Property(c => c.DealId)
            .HasColumnName("deal_id");

        builder.Property(c => c.ConvertedByUserId)
            .HasColumnName("converted_by_user_id")
            .IsRequired();

        builder.Property(c => c.ConvertedAt)
            .HasColumnName("converted_at")
            .IsRequired();

        builder.Property(c => c.Notes)
            .HasColumnName("notes");

        // Relationships
        // Lead FK is configured in LeadConfiguration (one-to-one via HasOne/WithOne)

        builder.HasOne(c => c.Contact)
            .WithMany()
            .HasForeignKey(c => c.ContactId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(c => c.Company)
            .WithMany()
            .HasForeignKey(c => c.CompanyId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(c => c.Deal)
            .WithMany()
            .HasForeignKey(c => c.DealId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(c => c.ConvertedByUser)
            .WithMany()
            .HasForeignKey(c => c.ConvertedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        // Indexes
        builder.HasIndex(c => c.LeadId)
            .IsUnique()
            .HasDatabaseName("idx_lead_conversions_lead_id");
    }
}
