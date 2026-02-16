using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for Company.
/// Maps to "companies" table with snake_case columns, JSONB custom fields,
/// GIN index, and tenant/owner indexes.
/// </summary>
public class CompanyConfiguration : IEntityTypeConfiguration<Company>
{
    public void Configure(EntityTypeBuilder<Company> builder)
    {
        builder.ToTable("companies");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .HasColumnName("id");

        builder.Property(c => c.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(c => c.Name)
            .HasColumnName("name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(c => c.Industry)
            .HasColumnName("industry")
            .HasMaxLength(100);

        builder.Property(c => c.Website)
            .HasColumnName("website")
            .HasMaxLength(500);

        builder.Property(c => c.Phone)
            .HasColumnName("phone")
            .HasMaxLength(50);

        builder.Property(c => c.Email)
            .HasColumnName("email")
            .HasMaxLength(200);

        builder.Property(c => c.Address)
            .HasColumnName("address")
            .HasMaxLength(500);

        builder.Property(c => c.City)
            .HasColumnName("city")
            .HasMaxLength(100);

        builder.Property(c => c.State)
            .HasColumnName("state")
            .HasMaxLength(100);

        builder.Property(c => c.Country)
            .HasColumnName("country")
            .HasMaxLength(100);

        builder.Property(c => c.PostalCode)
            .HasColumnName("postal_code")
            .HasMaxLength(20);

        builder.Property(c => c.Size)
            .HasColumnName("size")
            .HasMaxLength(50);

        builder.Property(c => c.Description)
            .HasColumnName("description");

        builder.Property(c => c.OwnerId)
            .HasColumnName("owner_id");

        builder.Property(c => c.CustomFields)
            .HasColumnName("custom_fields")
            .HasColumnType("jsonb")
            .HasDefaultValueSql("'{}'::jsonb");

        builder.Property(c => c.IsSeedData)
            .HasColumnName("is_seed_data")
            .HasDefaultValue(false);

        builder.Property(c => c.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(c => c.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Relationships
        builder.HasOne(c => c.Owner)
            .WithMany()
            .HasForeignKey(c => c.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(c => c.Contacts)
            .WithOne(ct => ct.Company)
            .HasForeignKey(ct => ct.CompanyId)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes
        builder.HasIndex(c => c.TenantId)
            .HasDatabaseName("idx_companies_tenant");

        builder.HasIndex(c => new { c.TenantId, c.Name })
            .HasDatabaseName("idx_companies_tenant_name");

        builder.HasIndex(c => c.CustomFields)
            .HasMethod("gin")
            .HasDatabaseName("idx_companies_custom_fields_gin");

        builder.HasIndex(c => c.OwnerId)
            .HasDatabaseName("idx_companies_owner");
    }
}
