using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for FeedComment.
/// Maps to "feed_comments" table with cascade delete from FeedItem
/// and SetNull delete from Author. No TenantId -- inherits isolation via FeedItem FK.
/// </summary>
public class FeedCommentConfiguration : IEntityTypeConfiguration<FeedComment>
{
    public void Configure(EntityTypeBuilder<FeedComment> builder)
    {
        builder.ToTable("feed_comments");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .HasColumnName("id");

        builder.Property(c => c.FeedItemId)
            .HasColumnName("feed_item_id")
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
        builder.HasIndex(c => new { c.FeedItemId, c.CreatedAt })
            .HasDatabaseName("idx_feed_comments_item_created");
    }
}
