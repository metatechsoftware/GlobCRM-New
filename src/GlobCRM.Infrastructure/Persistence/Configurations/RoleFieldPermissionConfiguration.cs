using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for RoleFieldPermission.
/// Defines field-level access control per entity type within a role.
/// </summary>
public class RoleFieldPermissionConfiguration : IEntityTypeConfiguration<RoleFieldPermission>
{
    public void Configure(EntityTypeBuilder<RoleFieldPermission> builder)
    {
        builder.ToTable("role_field_permissions");

        builder.HasKey(rfp => rfp.Id);

        builder.Property(rfp => rfp.Id)
            .HasColumnName("id")
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(rfp => rfp.RoleId)
            .HasColumnName("role_id")
            .IsRequired();

        builder.Property(rfp => rfp.EntityType)
            .HasColumnName("entity_type")
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(rfp => rfp.FieldName)
            .HasColumnName("field_name")
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(rfp => rfp.AccessLevel)
            .HasColumnName("access_level")
            .IsRequired()
            .HasDefaultValue(FieldAccessLevel.Editable)
            .HasConversion<short>();

        // Unique constraint: one access level per (role, entity_type, field_name) combination
        builder.HasIndex(rfp => new { rfp.RoleId, rfp.EntityType, rfp.FieldName })
            .IsUnique()
            .HasDatabaseName("ix_role_field_permissions_role_id_entity_type_field_name");
    }
}
