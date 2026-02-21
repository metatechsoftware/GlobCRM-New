using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for KanbanChecklistItem.
/// Maps to "kanban_checklist_items" table with snake_case columns.
/// No TenantId — inherits tenant isolation via Card -> Column -> Board chain.
/// Cascade delete from parent card.
/// </summary>
public class KanbanChecklistItemConfiguration : IEntityTypeConfiguration<KanbanChecklistItem>
{
    public void Configure(EntityTypeBuilder<KanbanChecklistItem> builder)
    {
        builder.ToTable("kanban_checklist_items");

        builder.HasKey(ci => ci.Id);

        builder.Property(ci => ci.Id)
            .HasColumnName("id");

        builder.Property(ci => ci.CardId)
            .HasColumnName("card_id")
            .IsRequired();

        builder.Property(ci => ci.Text)
            .HasColumnName("text")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(ci => ci.IsChecked)
            .HasColumnName("is_checked")
            .HasDefaultValue(false)
            .IsRequired();

        builder.Property(ci => ci.SortOrder)
            .HasColumnName("sort_order")
            .IsRequired();

        builder.Property(ci => ci.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(ci => ci.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Indexes
        builder.HasIndex(ci => new { ci.CardId, ci.SortOrder })
            .HasDatabaseName("idx_kanban_checklist_items_card_sort");
    }
}
