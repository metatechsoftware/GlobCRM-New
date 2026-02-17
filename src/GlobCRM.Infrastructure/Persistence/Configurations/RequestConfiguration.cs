using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for Request.
/// Maps to "requests" table with snake_case columns, JSONB custom fields with GIN index,
/// string conversions for Status/Priority enums, and proper FK constraints.
/// Follows ActivityConfiguration pattern.
/// </summary>
public class RequestConfiguration : IEntityTypeConfiguration<Request>
{
    public void Configure(EntityTypeBuilder<Request> builder)
    {
        builder.ToTable("requests");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Id)
            .HasColumnName("id");

        builder.Property(r => r.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(r => r.Subject)
            .HasColumnName("subject")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(r => r.Description)
            .HasColumnName("description")
            .HasMaxLength(5000);

        builder.Property(r => r.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(r => r.Priority)
            .HasColumnName("priority")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(r => r.Category)
            .HasColumnName("category")
            .HasMaxLength(200);

        builder.Property(r => r.OwnerId)
            .HasColumnName("owner_id");

        builder.Property(r => r.AssignedToId)
            .HasColumnName("assigned_to_id");

        builder.Property(r => r.ContactId)
            .HasColumnName("contact_id");

        builder.Property(r => r.CompanyId)
            .HasColumnName("company_id");

        builder.Property(r => r.ResolvedAt)
            .HasColumnName("resolved_at");

        builder.Property(r => r.ClosedAt)
            .HasColumnName("closed_at");

        builder.Property(r => r.CustomFields)
            .HasColumnName("custom_fields")
            .HasColumnType("jsonb")
            .HasDefaultValueSql("'{}'::jsonb");

        builder.Property(r => r.IsSeedData)
            .HasColumnName("is_seed_data")
            .HasDefaultValue(false);

        builder.Property(r => r.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(r => r.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Relationships
        builder.HasOne(r => r.Owner)
            .WithMany()
            .HasForeignKey(r => r.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(r => r.AssignedTo)
            .WithMany()
            .HasForeignKey(r => r.AssignedToId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(r => r.Contact)
            .WithMany(c => c.Requests)
            .HasForeignKey(r => r.ContactId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(r => r.Company)
            .WithMany(c => c.Requests)
            .HasForeignKey(r => r.CompanyId)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes
        builder.HasIndex(r => r.TenantId)
            .HasDatabaseName("idx_requests_tenant");

        builder.HasIndex(r => r.ContactId)
            .HasDatabaseName("idx_requests_contact");

        builder.HasIndex(r => r.CompanyId)
            .HasDatabaseName("idx_requests_company");

        builder.HasIndex(r => r.OwnerId)
            .HasDatabaseName("idx_requests_owner");

        builder.HasIndex(r => r.AssignedToId)
            .HasDatabaseName("idx_requests_assigned_to");

        builder.HasIndex(r => r.CustomFields)
            .HasMethod("gin")
            .HasDatabaseName("idx_requests_custom_fields_gin");
    }
}
