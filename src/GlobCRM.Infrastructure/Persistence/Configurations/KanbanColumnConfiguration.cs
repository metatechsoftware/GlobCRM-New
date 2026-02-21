using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for KanbanColumn.
/// Maps to "kanban_columns" table with snake_case columns.
/// No TenantId — inherits tenant isolation via KanbanBoard FK.
/// Cascade delete from parent board.
/// </summary>
public class KanbanColumnConfiguration : IEntityTypeConfiguration<KanbanColumn>
{
    public void Configure(EntityTypeBuilder<KanbanColumn> builder)
    {
        builder.ToTable("kanban_columns");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .HasColumnName("id");

        builder.Property(c => c.BoardId)
            .HasColumnName("board_id")
            .IsRequired();

        builder.Property(c => c.Name)
            .HasColumnName("name")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(c => c.SortOrder)
            .HasColumnName("sort_order")
            .IsRequired();

        builder.Property(c => c.WipLimit)
            .HasColumnName("wip_limit");

        builder.Property(c => c.Color)
            .HasColumnName("color")
            .HasMaxLength(10);

        builder.Property(c => c.IsCollapsed)
            .HasColumnName("is_collapsed")
            .HasDefaultValue(false)
            .IsRequired();

        builder.Property(c => c.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(c => c.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Indexes
        builder.HasIndex(c => new { c.BoardId, c.SortOrder })
            .HasDatabaseName("idx_kanban_columns_board_sort");
    }
}
