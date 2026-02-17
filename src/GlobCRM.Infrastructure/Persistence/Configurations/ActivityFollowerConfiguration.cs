using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for ActivityFollower.
/// Maps to "activity_followers" table with composite PK on (ActivityId, UserId),
/// cascade delete from both Activity and User.
/// </summary>
public class ActivityFollowerConfiguration : IEntityTypeConfiguration<ActivityFollower>
{
    public void Configure(EntityTypeBuilder<ActivityFollower> builder)
    {
        builder.ToTable("activity_followers");

        // Composite primary key
        builder.HasKey(f => new { f.ActivityId, f.UserId });

        builder.Property(f => f.ActivityId)
            .HasColumnName("activity_id");

        builder.Property(f => f.UserId)
            .HasColumnName("user_id");

        builder.Property(f => f.FollowedAt)
            .HasColumnName("followed_at")
            .IsRequired();

        // Relationships
        builder.HasOne(f => f.User)
            .WithMany()
            .HasForeignKey(f => f.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        builder.HasIndex(f => f.UserId)
            .HasDatabaseName("idx_activity_followers_user");
    }
}
