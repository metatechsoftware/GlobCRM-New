using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for SavedView.
/// Maps JSONB columns for column layout, filters, and sort configuration.
/// </summary>
public class SavedViewConfiguration : IEntityTypeConfiguration<SavedView>
{
    public void Configure(EntityTypeBuilder<SavedView> builder)
    {
        builder.ToTable("saved_views");

        builder.HasKey(v => v.Id);

        builder.Property(v => v.Id)
            .HasColumnName("id")
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(v => v.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(v => v.EntityType)
            .HasColumnName("entity_type")
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(v => v.Name)
            .HasColumnName("name")
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(v => v.OwnerId)
            .HasColumnName("owner_id");

        builder.Property(v => v.IsTeamDefault)
            .HasColumnName("is_team_default")
            .IsRequired()
            .HasDefaultValue(false);

        // JSONB columns for view configuration
        builder.Property(v => v.Columns)
            .HasColumnName("columns")
            .HasColumnType("jsonb")
            .HasDefaultValueSql("'[]'::jsonb");

        builder.Property(v => v.Filters)
            .HasColumnName("filters")
            .HasColumnType("jsonb")
            .HasDefaultValueSql("'[]'::jsonb");

        builder.Property(v => v.Sorts)
            .HasColumnName("sorts")
            .HasColumnType("jsonb")
            .HasDefaultValueSql("'[]'::jsonb");

        builder.Property(v => v.PageSize)
            .HasColumnName("page_size")
            .IsRequired()
            .HasDefaultValue(25);

        builder.Property(v => v.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired()
            .HasDefaultValueSql("NOW()");

        builder.Property(v => v.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired()
            .HasDefaultValueSql("NOW()");

        // FK: OwnerId to AspNetUsers with SET NULL on delete
        builder.HasOne(v => v.Owner)
            .WithMany()
            .HasForeignKey(v => v.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);

        // Composite index for tenant + entity type queries
        builder.HasIndex(v => new { v.TenantId, v.EntityType })
            .HasDatabaseName("idx_saved_views_tenant_entity");

        // Index on owner for user-specific view lookups
        builder.HasIndex(v => v.OwnerId)
            .HasDatabaseName("idx_saved_views_owner");
    }
}
