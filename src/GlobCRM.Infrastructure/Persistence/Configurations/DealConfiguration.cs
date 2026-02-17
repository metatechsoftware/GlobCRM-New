using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for Deal.
/// Maps to "deals" table with snake_case columns, JSONB custom fields with GIN index,
/// and proper FK constraints for pipeline, stage, owner, and company.
/// </summary>
public class DealConfiguration : IEntityTypeConfiguration<Deal>
{
    public void Configure(EntityTypeBuilder<Deal> builder)
    {
        builder.ToTable("deals");

        builder.HasKey(d => d.Id);

        builder.Property(d => d.Id)
            .HasColumnName("id");

        builder.Property(d => d.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(d => d.Title)
            .HasColumnName("title")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(d => d.Value)
            .HasColumnName("value")
            .HasPrecision(18, 2);

        builder.Property(d => d.Probability)
            .HasColumnName("probability")
            .HasPrecision(3, 2);

        builder.Property(d => d.ExpectedCloseDate)
            .HasColumnName("expected_close_date");

        builder.Property(d => d.ActualCloseDate)
            .HasColumnName("actual_close_date");

        builder.Property(d => d.PipelineId)
            .HasColumnName("pipeline_id")
            .IsRequired();

        builder.Property(d => d.PipelineStageId)
            .HasColumnName("pipeline_stage_id")
            .IsRequired();

        builder.Property(d => d.OwnerId)
            .HasColumnName("owner_id");

        builder.Property(d => d.CompanyId)
            .HasColumnName("company_id");

        builder.Property(d => d.CustomFields)
            .HasColumnName("custom_fields")
            .HasColumnType("jsonb")
            .HasDefaultValueSql("'{}'::jsonb");

        builder.Property(d => d.Description)
            .HasColumnName("description");

        builder.Property(d => d.IsSeedData)
            .HasColumnName("is_seed_data")
            .HasDefaultValue(false);

        builder.Property(d => d.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(d => d.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Relationships
        builder.HasOne(d => d.Stage)
            .WithMany()
            .HasForeignKey(d => d.PipelineStageId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(d => d.Owner)
            .WithMany()
            .HasForeignKey(d => d.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(d => d.Company)
            .WithMany(c => c.Deals)
            .HasForeignKey(d => d.CompanyId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(d => d.DealContacts)
            .WithOne(dc => dc.Deal)
            .HasForeignKey(dc => dc.DealId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(d => d.DealProducts)
            .WithOne(dp => dp.Deal)
            .HasForeignKey(dp => dp.DealId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        builder.HasIndex(d => d.TenantId)
            .HasDatabaseName("idx_deals_tenant");

        builder.HasIndex(d => d.OwnerId)
            .HasDatabaseName("idx_deals_owner");

        builder.HasIndex(d => d.PipelineId)
            .HasDatabaseName("idx_deals_pipeline");

        builder.HasIndex(d => d.CompanyId)
            .HasDatabaseName("idx_deals_company");

        builder.HasIndex(d => d.ExpectedCloseDate)
            .HasDatabaseName("idx_deals_expected_close_date");

        builder.HasIndex(d => d.CustomFields)
            .HasMethod("gin")
            .HasDatabaseName("idx_deals_custom_fields_gin");
    }
}
