using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for UserRoleAssignment.
/// Join entity between ApplicationUser and Role (direct role assignment).
/// </summary>
public class UserRoleAssignmentConfiguration : IEntityTypeConfiguration<UserRoleAssignment>
{
    public void Configure(EntityTypeBuilder<UserRoleAssignment> builder)
    {
        builder.ToTable("user_role_assignments");

        builder.HasKey(ura => ura.Id);

        builder.Property(ura => ura.Id)
            .HasColumnName("id")
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(ura => ura.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        builder.Property(ura => ura.RoleId)
            .HasColumnName("role_id")
            .IsRequired();

        // Unique constraint: a user can only have a role assigned once
        builder.HasIndex(ura => new { ura.UserId, ura.RoleId })
            .IsUnique()
            .HasDatabaseName("ix_user_role_assignments_user_id_role_id");

        // Index for querying role assignments by user
        builder.HasIndex(ura => ura.UserId)
            .HasDatabaseName("idx_user_role_assignments_user");

        // Foreign key to ApplicationUser (cascade delete when user deleted)
        builder.HasOne(ura => ura.User)
            .WithMany()
            .HasForeignKey(ura => ura.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Foreign key to Role (cascade delete when role deleted)
        builder.HasOne(ura => ura.Role)
            .WithMany()
            .HasForeignKey(ura => ura.RoleId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
