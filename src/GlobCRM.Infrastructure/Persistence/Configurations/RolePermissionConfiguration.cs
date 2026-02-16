using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for RolePermission.
/// Defines per-entity CRUD permissions with ownership scope.
/// </summary>
public class RolePermissionConfiguration : IEntityTypeConfiguration<RolePermission>
{
    public void Configure(EntityTypeBuilder<RolePermission> builder)
    {
        builder.ToTable("role_permissions");

        builder.HasKey(rp => rp.Id);

        builder.Property(rp => rp.Id)
            .HasColumnName("id")
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(rp => rp.RoleId)
            .HasColumnName("role_id")
            .IsRequired();

        builder.Property(rp => rp.EntityType)
            .HasColumnName("entity_type")
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(rp => rp.Operation)
            .HasColumnName("operation")
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(rp => rp.Scope)
            .HasColumnName("scope")
            .IsRequired()
            .HasConversion<short>();

        // Unique constraint: one scope per (role, entity_type, operation) combination
        builder.HasIndex(rp => new { rp.RoleId, rp.EntityType, rp.Operation })
            .IsUnique()
            .HasDatabaseName("ix_role_permissions_role_id_entity_type_operation");
    }
}
