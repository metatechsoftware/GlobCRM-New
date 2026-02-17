using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for FeedItem.
/// Maps to "feed_items" table with snake_case columns, string-mapped FeedItemType enum,
/// indexes for paged feed and entity-scoped queries, and FK to ApplicationUser.
/// </summary>
public class FeedItemConfiguration : IEntityTypeConfiguration<FeedItem>
{
    public void Configure(EntityTypeBuilder<FeedItem> builder)
    {
        builder.ToTable("feed_items");

        builder.HasKey(f => f.Id);

        builder.Property(f => f.Id)
            .HasColumnName("id");

        builder.Property(f => f.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(f => f.Type)
            .HasColumnName("type")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(f => f.Content)
            .HasColumnName("content")
            .IsRequired();

        builder.Property(f => f.EntityType)
            .HasColumnName("entity_type")
            .HasMaxLength(100);

        builder.Property(f => f.EntityId)
            .HasColumnName("entity_id");

        builder.Property(f => f.AuthorId)
            .HasColumnName("author_id");

        builder.Property(f => f.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(f => f.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Relationships
        builder.HasOne(f => f.Author)
            .WithMany()
            .HasForeignKey(f => f.AuthorId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(f => f.Comments)
            .WithOne(c => c.FeedItem)
            .HasForeignKey(c => c.FeedItemId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        builder.HasIndex(f => new { f.TenantId, f.CreatedAt })
            .HasDatabaseName("idx_feed_items_tenant_created")
            .IsDescending(false, true);

        builder.HasIndex(f => new { f.EntityType, f.EntityId })
            .HasDatabaseName("idx_feed_items_entity");
    }
}
