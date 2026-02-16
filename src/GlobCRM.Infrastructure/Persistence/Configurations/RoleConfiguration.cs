using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for Role.
/// Roles are tenant-scoped with unique (tenant_id, name) constraint.
/// </summary>
public class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> builder)
    {
        builder.ToTable("roles");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Id)
            .HasColumnName("id")
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(r => r.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(r => r.Name)
            .HasColumnName("name")
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(r => r.Description)
            .HasColumnName("description")
            .HasMaxLength(500);

        builder.Property(r => r.IsSystem)
            .HasColumnName("is_system")
            .IsRequired()
            .HasDefaultValue(false);

        builder.Property(r => r.IsTemplate)
            .HasColumnName("is_template")
            .IsRequired()
            .HasDefaultValue(false);

        builder.Property(r => r.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired()
            .HasDefaultValueSql("NOW()");

        builder.Property(r => r.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired()
            .HasDefaultValueSql("NOW()");

        // Unique constraint: one role name per tenant
        builder.HasIndex(r => new { r.TenantId, r.Name })
            .IsUnique()
            .HasDatabaseName("ix_roles_tenant_id_name");

        // Index for tenant-scoped queries
        builder.HasIndex(r => r.TenantId)
            .HasDatabaseName("idx_roles_tenant");

        // Foreign key to Organization (tenant)
        builder.HasOne(r => r.Organization)
            .WithMany()
            .HasForeignKey(r => r.TenantId)
            .OnDelete(DeleteBehavior.Restrict);

        // Navigation: Role has many Permissions (cascade delete)
        builder.HasMany(r => r.Permissions)
            .WithOne(rp => rp.Role)
            .HasForeignKey(rp => rp.RoleId)
            .OnDelete(DeleteBehavior.Cascade);

        // Navigation: Role has many FieldPermissions (cascade delete)
        builder.HasMany(r => r.FieldPermissions)
            .WithOne(rfp => rfp.Role)
            .HasForeignKey(rfp => rfp.RoleId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
