using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for TeamMember.
/// Join entity between Team and ApplicationUser.
/// </summary>
public class TeamMemberConfiguration : IEntityTypeConfiguration<TeamMember>
{
    public void Configure(EntityTypeBuilder<TeamMember> builder)
    {
        builder.ToTable("team_members");

        builder.HasKey(tm => tm.Id);

        builder.Property(tm => tm.Id)
            .HasColumnName("id")
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(tm => tm.TeamId)
            .HasColumnName("team_id")
            .IsRequired();

        builder.Property(tm => tm.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        // Unique constraint: a user can only be in a team once
        builder.HasIndex(tm => new { tm.TeamId, tm.UserId })
            .IsUnique()
            .HasDatabaseName("ix_team_members_team_id_user_id");

        // Index for querying teams by user
        builder.HasIndex(tm => tm.UserId)
            .HasDatabaseName("idx_team_members_user");

        // Foreign key to ApplicationUser
        builder.HasOne(tm => tm.User)
            .WithMany()
            .HasForeignKey(tm => tm.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
