using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for ActivityLink.
/// Maps to "activity_links" table with cascade delete from Activity.
/// Polymorphic link -- no FK to target entities.
/// Unique index on (ActivityId, EntityType, EntityId) prevents duplicate links.
/// </summary>
public class ActivityLinkConfiguration : IEntityTypeConfiguration<ActivityLink>
{
    public void Configure(EntityTypeBuilder<ActivityLink> builder)
    {
        builder.ToTable("activity_links");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Id)
            .HasColumnName("id");

        builder.Property(l => l.ActivityId)
            .HasColumnName("activity_id")
            .IsRequired();

        builder.Property(l => l.EntityType)
            .HasColumnName("entity_type")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(l => l.EntityId)
            .HasColumnName("entity_id")
            .IsRequired();

        builder.Property(l => l.EntityName)
            .HasColumnName("entity_name")
            .HasMaxLength(500);

        builder.Property(l => l.LinkedAt)
            .HasColumnName("linked_at")
            .IsRequired();

        // Indexes
        builder.HasIndex(l => new { l.ActivityId, l.EntityType, l.EntityId })
            .IsUnique()
            .HasDatabaseName("idx_activity_links_activity_entity");
    }
}
