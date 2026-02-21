using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for KanbanCardLabel (join table).
/// Maps to "kanban_card_labels" table with composite primary key (CardId, LabelId).
/// No TenantId — inherits tenant isolation via Label -> Board chain.
/// Cascade delete from both Card and Label.
/// </summary>
public class KanbanCardLabelConfiguration : IEntityTypeConfiguration<KanbanCardLabel>
{
    public void Configure(EntityTypeBuilder<KanbanCardLabel> builder)
    {
        builder.ToTable("kanban_card_labels");

        builder.HasKey(cl => new { cl.CardId, cl.LabelId });

        builder.Property(cl => cl.CardId)
            .HasColumnName("card_id")
            .IsRequired();

        builder.Property(cl => cl.LabelId)
            .HasColumnName("label_id")
            .IsRequired();

        // Relationships
        builder.HasOne(cl => cl.Card)
            .WithMany(c => c.Labels)
            .HasForeignKey(cl => cl.CardId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(cl => cl.Label)
            .WithMany(l => l.CardLabels)
            .HasForeignKey(cl => cl.LabelId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
