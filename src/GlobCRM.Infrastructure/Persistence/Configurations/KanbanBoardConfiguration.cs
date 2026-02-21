using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for KanbanBoard.
/// Maps to "kanban_boards" table with snake_case columns, tenant-scoped indexes,
/// and SetNull FKs for CreatorId and TeamId.
/// Visibility stored as string to match JsonStringEnumConverter convention.
/// </summary>
public class KanbanBoardConfiguration : IEntityTypeConfiguration<KanbanBoard>
{
    public void Configure(EntityTypeBuilder<KanbanBoard> builder)
    {
        builder.ToTable("kanban_boards");

        builder.HasKey(b => b.Id);

        builder.Property(b => b.Id)
            .HasColumnName("id");

        builder.Property(b => b.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(b => b.Name)
            .HasColumnName("name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(b => b.Description)
            .HasColumnName("description")
            .HasMaxLength(2000);

        builder.Property(b => b.Color)
            .HasColumnName("color")
            .HasMaxLength(10);

        builder.Property(b => b.Visibility)
            .HasColumnName("visibility")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(b => b.CreatorId)
            .HasColumnName("creator_id");

        builder.Property(b => b.TeamId)
            .HasColumnName("team_id");

        builder.Property(b => b.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(b => b.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        builder.Property(b => b.IsSeedData)
            .HasColumnName("is_seed_data")
            .HasDefaultValue(false);

        // Relationships
        builder.HasOne(b => b.Creator)
            .WithMany()
            .HasForeignKey(b => b.CreatorId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(b => b.Team)
            .WithMany()
            .HasForeignKey(b => b.TeamId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(b => b.Columns)
            .WithOne(c => c.Board)
            .HasForeignKey(c => c.BoardId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(b => b.Labels)
            .WithOne(l => l.Board)
            .HasForeignKey(l => l.BoardId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        builder.HasIndex(b => new { b.TenantId, b.Name })
            .HasDatabaseName("idx_kanban_boards_tenant_name");

        builder.HasIndex(b => new { b.TenantId, b.CreatorId })
            .HasDatabaseName("idx_kanban_boards_tenant_creator");

        builder.HasIndex(b => new { b.TenantId, b.Visibility })
            .HasDatabaseName("idx_kanban_boards_tenant_visibility");
    }
}
