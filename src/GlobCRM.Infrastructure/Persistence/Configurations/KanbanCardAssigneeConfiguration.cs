using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for KanbanCardAssignee (join table).
/// Maps to "kanban_card_assignees" table with composite primary key (CardId, UserId).
/// No TenantId — inherits tenant isolation via Card -> Column -> Board chain.
/// Cascade delete from Card, Cascade delete from User.
/// </summary>
public class KanbanCardAssigneeConfiguration : IEntityTypeConfiguration<KanbanCardAssignee>
{
    public void Configure(EntityTypeBuilder<KanbanCardAssignee> builder)
    {
        builder.ToTable("kanban_card_assignees");

        builder.HasKey(ca => new { ca.CardId, ca.UserId });

        builder.Property(ca => ca.CardId)
            .HasColumnName("card_id")
            .IsRequired();

        builder.Property(ca => ca.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        // Relationships
        builder.HasOne(ca => ca.Card)
            .WithMany(c => c.Assignees)
            .HasForeignKey(ca => ca.CardId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(ca => ca.User)
            .WithMany()
            .HasForeignKey(ca => ca.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
