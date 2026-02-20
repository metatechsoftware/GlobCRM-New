using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for RecentlyViewedEntity.
/// Maps to "recently_viewed_entities" table with snake_case columns,
/// composite indexes for fast per-user recency lookups and upsert uniqueness.
/// </summary>
public class RecentlyViewedEntityConfiguration : IEntityTypeConfiguration<RecentlyViewedEntity>
{
    public void Configure(EntityTypeBuilder<RecentlyViewedEntity> builder)
    {
        builder.ToTable("recently_viewed_entities");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Id)
            .HasColumnName("id");

        builder.Property(r => r.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(r => r.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        builder.Property(r => r.EntityType)
            .HasColumnName("entity_type")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(r => r.EntityId)
            .HasColumnName("entity_id")
            .IsRequired();

        builder.Property(r => r.EntityName)
            .HasColumnName("entity_name")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(r => r.ViewedAt)
            .HasColumnName("viewed_at")
            .IsRequired();

        // Relationships
        builder.HasOne(r => r.User)
            .WithMany()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        // Fast lookups: recently viewed per user, ordered by recency
        builder.HasIndex(r => new { r.TenantId, r.UserId, r.ViewedAt })
            .HasDatabaseName("idx_recently_viewed_tenant_user_viewed")
            .IsDescending(false, false, true);

        // Unique constraint for upsert pattern: one entry per entity per user
        builder.HasIndex(r => new { r.TenantId, r.UserId, r.EntityType, r.EntityId })
            .HasDatabaseName("idx_recently_viewed_tenant_user_entity_unique")
            .IsUnique();
    }
}
