using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for KanbanLabel.
/// Maps to "kanban_labels" table with snake_case columns.
/// No TenantId — inherits tenant isolation via KanbanBoard FK.
/// Cascade delete from parent board.
/// </summary>
public class KanbanLabelConfiguration : IEntityTypeConfiguration<KanbanLabel>
{
    public void Configure(EntityTypeBuilder<KanbanLabel> builder)
    {
        builder.ToTable("kanban_labels");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Id)
            .HasColumnName("id");

        builder.Property(l => l.BoardId)
            .HasColumnName("board_id")
            .IsRequired();

        builder.Property(l => l.Name)
            .HasColumnName("name")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(l => l.Color)
            .HasColumnName("color")
            .HasMaxLength(10)
            .IsRequired();

        builder.Property(l => l.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        // Indexes
        builder.HasIndex(l => l.BoardId)
            .HasDatabaseName("idx_kanban_labels_board");
    }
}
