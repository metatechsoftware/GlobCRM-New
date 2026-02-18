using GlobCRM.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GlobCRM.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity type configuration for Note.
/// Maps to "notes" table with snake_case columns, tenant + entity + author indexes,
/// text column types for Body and PlainTextBody, and SetNull FK for AuthorId.
/// </summary>
public class NoteConfiguration : IEntityTypeConfiguration<Note>
{
    public void Configure(EntityTypeBuilder<Note> builder)
    {
        builder.ToTable("notes");

        builder.HasKey(n => n.Id);

        builder.Property(n => n.Id)
            .HasColumnName("id");

        builder.Property(n => n.TenantId)
            .HasColumnName("tenant_id")
            .IsRequired();

        builder.Property(n => n.Title)
            .HasColumnName("title")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(n => n.Body)
            .HasColumnName("body")
            .HasColumnType("text")
            .IsRequired();

        builder.Property(n => n.PlainTextBody)
            .HasColumnName("plain_text_body")
            .HasColumnType("text");

        builder.Property(n => n.EntityType)
            .HasColumnName("entity_type")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(n => n.EntityId)
            .HasColumnName("entity_id")
            .IsRequired();

        builder.Property(n => n.EntityName)
            .HasColumnName("entity_name")
            .HasMaxLength(200);

        builder.Property(n => n.AuthorId)
            .HasColumnName("author_id");

        builder.Property(n => n.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(n => n.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        builder.Property(n => n.IsSeedData)
            .HasColumnName("is_seed_data")
            .HasDefaultValue(false);

        // Relationships
        builder.HasOne(n => n.Author)
            .WithMany()
            .HasForeignKey(n => n.AuthorId)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes
        builder.HasIndex(n => new { n.TenantId, n.EntityType, n.EntityId })
            .HasDatabaseName("idx_notes_tenant_entity");

        builder.HasIndex(n => new { n.TenantId, n.AuthorId })
            .HasDatabaseName("idx_notes_tenant_author");
    }
}
