using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for Organization (tenant catalog).
/// </summary>
public class OrganizationConfiguration : IEntityTypeConfiguration<Organization>
{
    public void Configure(EntityTypeBuilder<Organization> builder)
    {
        builder.ToTable("organizations");

        builder.HasKey(o => o.Id);

        builder.Property(o => o.Id)
            .HasColumnName("id")
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(o => o.Name)
            .HasColumnName("name")
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(o => o.Subdomain)
            .HasColumnName("subdomain")
            .IsRequired()
            .HasMaxLength(63);

        builder.Property(o => o.Industry)
            .HasColumnName("industry")
            .HasMaxLength(100);

        builder.Property(o => o.CompanySize)
            .HasColumnName("company_size")
            .HasMaxLength(50);

        builder.Property(o => o.IsActive)
            .HasColumnName("is_active")
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(o => o.UserLimit)
            .HasColumnName("user_limit")
            .IsRequired()
            .HasDefaultValue(10);

        builder.Property(o => o.SetupCompleted)
            .HasColumnName("setup_completed")
            .IsRequired()
            .HasDefaultValue(false);

        builder.Property(o => o.DefaultLanguage)
            .HasColumnName("default_language")
            .HasMaxLength(5)
            .HasDefaultValue("en");

        builder.Property(o => o.LogoUrl)
            .HasColumnName("logo_url")
            .HasMaxLength(500);

        builder.Property(o => o.Address)
            .HasColumnName("address")
            .HasMaxLength(500);

        builder.Property(o => o.Phone)
            .HasColumnName("phone")
            .HasMaxLength(50);

        builder.Property(o => o.Email)
            .HasColumnName("email")
            .HasMaxLength(255);

        builder.Property(o => o.Website)
            .HasColumnName("website")
            .HasMaxLength(500);

        builder.Property(o => o.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired()
            .HasDefaultValueSql("NOW()");

        builder.Property(o => o.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired()
            .HasDefaultValueSql("NOW()");

        // Unique index on subdomain for fast lookup and uniqueness enforcement
        builder.HasIndex(o => o.Subdomain)
            .IsUnique()
            .HasDatabaseName("idx_organizations_subdomain");

        // Navigation: Organization has many Users
        builder.HasMany(o => o.Users)
            .WithOne(u => u.Organization)
            .HasForeignKey(u => u.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        // Navigation: Organization has many Invitations
        builder.HasMany(o => o.Invitations)
            .WithOne()
            .HasForeignKey(i => i.TenantId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
