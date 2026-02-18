using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for Lead.
/// Maps to "leads" table with snake_case columns, JSONB custom fields with GIN index,
/// full-text search vector, and proper FK constraints for stage, source, and owner.
/// </summary>
public class LeadConfiguration : IEntityTypeConfiguration<Lead>
{
    public void Configure(EntityTypeBuilder<Lead> builder)
    {
        builder.ToTable("leads");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Id)
            .HasColumnName("id");

        builder.Property(l => l.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(l => l.FirstName)
            .HasColumnName("first_name")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(l => l.LastName)
            .HasColumnName("last_name")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(l => l.Email)
            .HasColumnName("email")
            .HasMaxLength(200);

        builder.Property(l => l.Phone)
            .HasColumnName("phone")
            .HasMaxLength(50);

        builder.Property(l => l.MobilePhone)
            .HasColumnName("mobile_phone")
            .HasMaxLength(50);

        builder.Property(l => l.JobTitle)
            .HasColumnName("job_title")
            .HasMaxLength(200);

        builder.Property(l => l.CompanyName)
            .HasColumnName("company_name")
            .HasMaxLength(300);

        builder.Property(l => l.LeadStageId)
            .HasColumnName("lead_stage_id")
            .IsRequired();

        builder.Property(l => l.LeadSourceId)
            .HasColumnName("lead_source_id");

        builder.Property(l => l.Temperature)
            .HasColumnName("temperature")
            .IsRequired();

        builder.Property(l => l.OwnerId)
            .HasColumnName("owner_id");

        builder.Property(l => l.IsConverted)
            .HasColumnName("is_converted")
            .HasDefaultValue(false);

        builder.Property(l => l.ConvertedAt)
            .HasColumnName("converted_at");

        builder.Property(l => l.ConvertedByUserId)
            .HasColumnName("converted_by_user_id");

        builder.Property(l => l.ConvertedContactId)
            .HasColumnName("converted_contact_id");

        builder.Property(l => l.ConvertedCompanyId)
            .HasColumnName("converted_company_id");

        builder.Property(l => l.ConvertedDealId)
            .HasColumnName("converted_deal_id");

        builder.Property(l => l.CustomFields)
            .HasColumnName("custom_fields")
            .HasColumnType("jsonb")
            .HasDefaultValueSql("'{}'::jsonb");

        builder.Property(l => l.Description)
            .HasColumnName("description");

        builder.Property(l => l.IsSeedData)
            .HasColumnName("is_seed_data")
            .HasDefaultValue(false);

        builder.Property(l => l.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(l => l.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Ignore computed property (not stored in database)
        builder.Ignore(l => l.FullName);

        // Relationships
        builder.HasOne(l => l.Stage)
            .WithMany()
            .HasForeignKey(l => l.LeadStageId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(l => l.Source)
            .WithMany()
            .HasForeignKey(l => l.LeadSourceId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(l => l.Owner)
            .WithMany()
            .HasForeignKey(l => l.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(l => l.LeadConversion)
            .WithOne(lc => lc.Lead)
            .HasForeignKey<LeadConversion>(lc => lc.LeadId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        builder.HasIndex(l => l.TenantId)
            .HasDatabaseName("idx_leads_tenant_id");

        builder.HasIndex(l => l.LeadStageId)
            .HasDatabaseName("idx_leads_stage_id");

        builder.HasIndex(l => l.LeadSourceId)
            .HasDatabaseName("idx_leads_source_id");

        builder.HasIndex(l => l.OwnerId)
            .HasDatabaseName("idx_leads_owner_id");

        builder.HasIndex(l => l.IsConverted)
            .HasDatabaseName("idx_leads_is_converted");

        builder.HasIndex(l => l.CustomFields)
            .HasMethod("gin")
            .HasDatabaseName("idx_leads_custom_fields_gin");

        // Full-text search: generated tsvector column with GIN index
        builder.HasGeneratedTsVectorColumn(
            l => l.SearchVector,
            "english",
            l => new { l.FirstName, l.LastName, l.Email, l.CompanyName });

        builder.Property(l => l.SearchVector)
            .HasColumnName("search_vector");

        builder.HasIndex(l => l.SearchVector)
            .HasMethod("GIN")
            .HasDatabaseName("idx_leads_search_vector");
    }
}
