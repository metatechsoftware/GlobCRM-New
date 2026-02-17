using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for ActivityComment.
/// Maps to "activity_comments" table with cascade delete from Activity
/// and SetNull delete from Author.
/// </summary>
public class ActivityCommentConfiguration : IEntityTypeConfiguration<ActivityComment>
{
    public void Configure(EntityTypeBuilder<ActivityComment> builder)
    {
        builder.ToTable("activity_comments");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .HasColumnName("id");

        builder.Property(c => c.ActivityId)
            .HasColumnName("activity_id")
            .IsRequired();

        builder.Property(c => c.Content)
            .HasColumnName("content")
            .IsRequired();

        builder.Property(c => c.AuthorId)
            .HasColumnName("author_id");

        builder.Property(c => c.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(c => c.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Relationships
        builder.HasOne(c => c.Author)
            .WithMany()
            .HasForeignKey(c => c.AuthorId)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes
        builder.HasIndex(c => c.ActivityId)
            .HasDatabaseName("idx_activity_comments_activity");
    }
}
