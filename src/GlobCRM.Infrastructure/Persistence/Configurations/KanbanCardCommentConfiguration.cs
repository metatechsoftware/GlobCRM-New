using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for KanbanCardComment.
/// Maps to "kanban_card_comments" table with snake_case columns.
/// No TenantId — inherits tenant isolation via Card -> Column -> Board chain.
/// Cascade delete from parent card. Self-referencing ParentCommentId uses Restrict
/// to prevent cascade cycles.
/// </summary>
public class KanbanCardCommentConfiguration : IEntityTypeConfiguration<KanbanCardComment>
{
    public void Configure(EntityTypeBuilder<KanbanCardComment> builder)
    {
        builder.ToTable("kanban_card_comments");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .HasColumnName("id");

        builder.Property(c => c.CardId)
            .HasColumnName("card_id")
            .IsRequired();

        builder.Property(c => c.Content)
            .HasColumnName("content")
            .HasMaxLength(5000)
            .IsRequired();

        builder.Property(c => c.AuthorId)
            .HasColumnName("author_id");

        builder.Property(c => c.ParentCommentId)
            .HasColumnName("parent_comment_id");

        builder.Property(c => c.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(c => c.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Relationships
        builder.HasOne(c => c.Author)
            .WithMany()
            .HasForeignKey(c => c.AuthorId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(c => c.ParentComment)
            .WithMany(c => c.Replies)
            .HasForeignKey(c => c.ParentCommentId)
            .OnDelete(DeleteBehavior.Restrict);

        // Indexes
        builder.HasIndex(c => new { c.CardId, c.CreatedAt })
            .HasDatabaseName("idx_kanban_card_comments_card_created");
    }
}
