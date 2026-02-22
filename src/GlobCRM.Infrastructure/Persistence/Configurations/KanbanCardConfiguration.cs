using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for KanbanCard.
/// Maps to "kanban_cards" table with snake_case columns.
/// No TenantId — inherits tenant isolation via Column -> Board chain.
/// Cascade delete from parent column. Assignees managed via KanbanCardAssignee join table.
/// </summary>
public class KanbanCardConfiguration : IEntityTypeConfiguration<KanbanCard>
{
    public void Configure(EntityTypeBuilder<KanbanCard> builder)
    {
        builder.ToTable("kanban_cards");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .HasColumnName("id");

        builder.Property(c => c.ColumnId)
            .HasColumnName("column_id")
            .IsRequired();

        builder.Property(c => c.Title)
            .HasColumnName("title")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(c => c.Description)
            .HasColumnName("description")
            .HasColumnType("text");

        builder.Property(c => c.DueDate)
            .HasColumnName("due_date");

        builder.Property(c => c.SortOrder)
            .HasColumnName("sort_order")
            .IsRequired();

        builder.Property(c => c.IsArchived)
            .HasColumnName("is_archived")
            .HasDefaultValue(false)
            .IsRequired();

        builder.Property(c => c.LinkedEntityType)
            .HasColumnName("linked_entity_type")
            .HasMaxLength(50);

        builder.Property(c => c.LinkedEntityId)
            .HasColumnName("linked_entity_id");

        builder.Property(c => c.LinkedEntityName)
            .HasColumnName("linked_entity_name")
            .HasMaxLength(200);

        builder.Property(c => c.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(c => c.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Relationships
        builder.HasMany(c => c.ChecklistItems)
            .WithOne(ci => ci.Card)
            .HasForeignKey(ci => ci.CardId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(c => c.Comments)
            .WithOne(cm => cm.Card)
            .HasForeignKey(cm => cm.CardId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        builder.HasIndex(c => new { c.ColumnId, c.SortOrder })
            .HasDatabaseName("idx_kanban_cards_column_sort");

        builder.HasIndex(c => new { c.ColumnId, c.IsArchived })
            .HasDatabaseName("idx_kanban_cards_column_archived");

        builder.HasIndex(c => new { c.LinkedEntityType, c.LinkedEntityId })
            .HasDatabaseName("idx_kanban_cards_linked_entity");
    }
}
