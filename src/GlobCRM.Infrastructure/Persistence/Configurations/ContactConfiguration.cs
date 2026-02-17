using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for Contact.
/// Maps to "contacts" table with snake_case columns, JSONB custom fields,
/// nullable CompanyId FK, and GIN index on custom fields.
/// </summary>
public class ContactConfiguration : IEntityTypeConfiguration<Contact>
{
    public void Configure(EntityTypeBuilder<Contact> builder)
    {
        builder.ToTable("contacts");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .HasColumnName("id");

        builder.Property(c => c.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(c => c.FirstName)
            .HasColumnName("first_name")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(c => c.LastName)
            .HasColumnName("last_name")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(c => c.Email)
            .HasColumnName("email")
            .HasMaxLength(200);

        builder.Property(c => c.Phone)
            .HasColumnName("phone")
            .HasMaxLength(50);

        builder.Property(c => c.MobilePhone)
            .HasColumnName("mobile_phone")
            .HasMaxLength(50);

        builder.Property(c => c.JobTitle)
            .HasColumnName("job_title")
            .HasMaxLength(200);

        builder.Property(c => c.Department)
            .HasColumnName("department")
            .HasMaxLength(100);

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

        builder.Property(c => c.Description)
            .HasColumnName("description");

        builder.Property(c => c.CompanyId)
            .HasColumnName("company_id");

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

        // Ignore computed property (not stored in database)
        builder.Ignore(c => c.FullName);

        // Relationships
        builder.HasOne(c => c.Company)
            .WithMany(co => co.Contacts)
            .HasForeignKey(c => c.CompanyId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(c => c.Owner)
            .WithMany()
            .HasForeignKey(c => c.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes
        builder.HasIndex(c => c.TenantId)
            .HasDatabaseName("idx_contacts_tenant");

        builder.HasIndex(c => new { c.TenantId, c.LastName, c.FirstName })
            .HasDatabaseName("idx_contacts_tenant_name");

        builder.HasIndex(c => c.CompanyId)
            .HasDatabaseName("idx_contacts_company");

        builder.HasIndex(c => c.OwnerId)
            .HasDatabaseName("idx_contacts_owner");

        builder.HasIndex(c => c.CustomFields)
            .HasMethod("gin")
            .HasDatabaseName("idx_contacts_custom_fields_gin");

        // Full-text search: generated tsvector column with GIN index
        builder.HasGeneratedTsVectorColumn(
            c => c.SearchVector,
            "english",
            c => new { c.FirstName, c.LastName, c.Email, c.JobTitle });

        builder.Property(c => c.SearchVector)
            .HasColumnName("search_vector");

        builder.HasIndex(c => c.SearchVector)
            .HasMethod("GIN")
            .HasDatabaseName("idx_contacts_search_vector");
    }
}
